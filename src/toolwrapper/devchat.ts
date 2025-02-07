// devchat.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

import { logger } from '../util/logger';
import { CommandRun } from "../util/commonUtil";
import ExtensionContextHolder from '../util/extensionContext';
import { UiUtilWrapper } from '../util/uiUtil';
import { ApiKeyManager } from '../util/apiKey';
import { exitCode } from 'process';
import * as yaml from 'yaml';


const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

export interface ChatOptions {
	parent?: string;
	reference?: string[];
	header?: string[];
	functions?: string;
	role?: string;
	function_name?: string;
	context?: string[];
}

export interface LogOptions {
	skip?: number;
	maxCount?: number;
	topic?: string;
}

export interface LogEntry {
	hash: string;
	parent: string;
	user: string;
	date: string;
	request: string;
	response: string;
	context: Array<{
		content: string;
		role: string;
	}>;
}

export interface CommandEntry {
	name: string;
	description: string;
}

// define TopicEntry interface
/*
[
	{
		root_prompt: LogEntry,
		latest_time: 1689849274,
		hidden: false,
		title: null
	}
]
*/
export interface TopicEntry {
	root_prompt: LogEntry;
	latest_time: number;
	hidden: boolean;
	title: string | null;
}

export interface ChatResponse {
	"prompt-hash": string;
	user: string;
	date: string;
	response: string;
	finish_reason: string;
	isError: boolean;
}


class DevChat {
	private commandRun: CommandRun;

	constructor() {
		this.commandRun = new CommandRun();
	}

	public stop() {
		this.commandRun.stop();
	}

	async buildArgs(options: ChatOptions): Promise<string[]> {
		let args = ["prompt"];

		if (options.reference) {
			for (const reference of options.reference) {
				args.push("-r", reference);
			}
		}
		if (options.header) {
			for (const header of options.header) {
				args.push("-i", header);
			}
		}
		if (options.context) {
			for (const context of options.context) {
				args.push("-c", context);
			}
		}

		const isEnableFunctionCalling = UiUtilWrapper.getConfiguration('DevChat', 'EnableFunctionCalling');
		if (options.functions && isEnableFunctionCalling) {
			args.push("-f", options.functions);
		}

		if (options.function_name) {
			args.push("-n", options.function_name);
		}

		if (options.parent) {
			args.push("-p", options.parent);
		}

		const llmModelData = await ApiKeyManager.llmModel();
		if (llmModelData && llmModelData.model) {
			args.push("-m", llmModelData.model);
		}

		return args;
	}

	private parseOutData(stdout: string, isPartial: boolean): ChatResponse {
		const responseLines = stdout.trim().split("\n");

		if (responseLines.length < 2) {
			return {
				"prompt-hash": "",
				user: "",
				date: "",
				response: "",
				finish_reason: "",
				isError: isPartial ? false : true,
			};
		}

		const userLine = responseLines.shift()!;
		const user = (userLine.match(/User: (.+)/)?.[1]) ?? "";

		const dateLine = responseLines.shift()!;
		const date = (dateLine.match(/Date: (.+)/)?.[1]) ?? "";


		let promptHashLine = "";
		for (let i = responseLines.length - 1; i >= 0; i--) {
			if (responseLines[i].startsWith("prompt")) {
				promptHashLine = responseLines[i];
				responseLines.splice(i, 1);
				break;
			}
		}

		let finishReasonLine = "";
		for (let i = responseLines.length - 1; i >= 0; i--) {
			if (responseLines[i].startsWith("finish_reason:")) {
				finishReasonLine = responseLines[i];
				responseLines.splice(i, 1);
				break;
			}
		}

		if (!promptHashLine) {
			return {
				"prompt-hash": "",
				user: user,
				date: date,
				response: responseLines.join("\n"),
				finish_reason: "",
				isError: isPartial ? false : true,
			};
		}

		const finishReason = finishReasonLine.split(" ")[1];
		const promptHash = promptHashLine.split(" ")[1];
		const response = responseLines.join("\n");

		return {
			"prompt-hash": promptHash,
			user,
			date,
			response,
			finish_reason: finishReason,
			isError: false,
		};
	}

	async chat(content: string, options: ChatOptions = {}, onData: (data: ChatResponse) => void): Promise<ChatResponse> {
		const llmModelData = await ApiKeyManager.llmModel();
		if (!llmModelData) {
			return {
				"prompt-hash": "",
				user: "",
				date: "",
				response: `Error: no valid llm model is selected!`,
				finish_reason: "",
				isError: true,
			};
		}

		const args = await this.buildArgs(options);
		args.push("--");
		args.push(content);

		const workspaceDir = UiUtilWrapper.workspaceFoldersFirstPath();
		let openaiApiKey = await ApiKeyManager.getApiKey();
		if (!openaiApiKey) {
			logger.channel()?.error('The OpenAI key is invalid!');
			logger.channel()?.show();
		}

		const openaiStream = UiUtilWrapper.getConfiguration('DevChat', 'OpenAI.stream');
		
		const openAiApiBaseObject = llmModelData.api_base? { OPENAI_API_BASE: llmModelData.api_base } : {};
		const activeLlmModelKey = llmModelData.api_key;

		let devChat: string | undefined = UiUtilWrapper.getConfiguration('DevChat', 'DevChatPath');
		if (!devChat) {
			devChat = 'devchat';
		}

		const reduceModelData = Object.keys(llmModelData)
			.filter(key => key !== 'api_key' && key !== 'provider' && key !== 'model' && key !== 'api_base')
			.reduce((obj, key) => {
				obj[key] = llmModelData[key];
				return obj;
			}, {});
		let devchatConfig = {};
		devchatConfig[llmModelData.model] = {
			"provider": llmModelData.provider,
			"stream": openaiStream,
			...reduceModelData
		};

		let devchatModels = {
			"default_model": llmModelData.model,
			"models": devchatConfig};
		
		// write to config file
		const os = process.platform;
  		const userHome = os === 'win32' ? fs.realpathSync(process.env.USERPROFILE || '') : process.env.HOME;
  
		const configPath = path.join(userHome!, '.chat', 'config.yml');
		// write devchatConfig to configPath
		const yamlString = yaml.stringify(devchatModels);
		fs.writeFileSync(configPath, yamlString);

		try {

			let receviedStdout = "";
			const onStdoutPartial = (stdout: string) => {
				receviedStdout += stdout;
				const data = this.parseOutData(receviedStdout, true);
				onData(data);
			};

			const spawnAsyncOptions = {
				maxBuffer: 10 * 1024 * 1024, // Set maxBuffer to 10 MB
				cwd: workspaceDir,
				env: {
					PYTHONUTF8:1,
					...process.env,
					OPENAI_API_KEY: activeLlmModelKey,
					...openAiApiBaseObject
				},
			};

			logger.channel()?.info(`Running devchat with arguments: ${args.join(" ")}`);
			logger.channel()?.info(`Running devchat with environment: ${JSON.stringify(openAiApiBaseObject)}`);
			const { exitCode: code, stdout, stderr } = await this.commandRun.spawnAsync(devChat, args, spawnAsyncOptions, onStdoutPartial, undefined, undefined, undefined);

			if (stderr) {
				return {
					"prompt-hash": "",
					user: "",
					date: "",
					response: stderr,
					finish_reason: "",
					isError: true,
				};
			}

			const response = this.parseOutData(stdout, false);
			return response;
		} catch (error: any) {
			return {
				"prompt-hash": "",
				user: "",
				date: "",
				response: `Error: ${error.stderr}\nExit code: ${error.code}`,
				finish_reason: "",
				isError: true,
			};
		}
	}

	async delete(hash: string): Promise<boolean> {
		const args = ["log", "--delete", hash];
		const devChat = this.getDevChatPath();
		const workspaceDir = UiUtilWrapper.workspaceFoldersFirstPath();
		const openaiApiKey = process.env.OPENAI_API_KEY;

		logger.channel()?.info(`Running devchat with arguments: ${args.join(" ")}`);
		const spawnOptions = {
			maxBuffer: 10 * 1024 * 1024, // Set maxBuffer to 10 MB
			cwd: workspaceDir,
			env: {
				...process.env,
				OPENAI_API_KEY: openaiApiKey,
			},
		};
		const { exitCode: code, stdout, stderr } = await this.commandRun.spawnAsync(devChat, args, spawnOptions, undefined, undefined, undefined, undefined);

		logger.channel()?.info(`Finish devchat with arguments: ${args.join(" ")}`);
		if (stderr) {
			logger.channel()?.error(`Error: ${stderr}`);
			logger.channel()?.show();
			return false;
		}
		if (stdout.indexOf('Failed to delete prompt') >= 0) {
			logger.channel()?.error(`Failed to delete prompt: ${hash}`);
			logger.channel()?.show();
			return false;
		}

		if (code !== 0) {
			logger.channel()?.error(`Exit code: ${code}`);
			logger.channel()?.show();
			return false;
		}
		return true;
	}

	async log(options: LogOptions = {}): Promise<LogEntry[]> {
		const args = this.buildLogArgs(options);
		const devChat = this.getDevChatPath();
		const workspaceDir = UiUtilWrapper.workspaceFoldersFirstPath();
		const openaiApiKey = process.env.OPENAI_API_KEY;

		logger.channel()?.info(`Running devchat with arguments: ${args.join(" ")}`);
		const spawnOptions = {
			maxBuffer: 10 * 1024 * 1024, // Set maxBuffer to 10 MB
			cwd: workspaceDir,
			env: {
				...process.env,
				OPENAI_API_KEY: openaiApiKey,
			},
		};
		const { exitCode: code, stdout, stderr } = await this.commandRun.spawnAsync(devChat, args, spawnOptions, undefined, undefined, undefined, undefined);

		logger.channel()?.info(`Finish devchat with arguments: ${args.join(" ")}`);
		if (stderr) {
			logger.channel()?.error(`Error: ${stderr}`);
			logger.channel()?.show();
			return [];
		}

		const logs = JSON.parse(stdout.trim()).reverse();
		for (const log of logs) {
			log.response = log.responses[0];
			delete log.responses;
		}
		return logs;
	}

	// command devchat run --list
	// output:
	// [
	// 	{
	// 	"name": "code",
	// 	"description": "Generate code with a general template embedded into the prompt."
	// 	},
	// 	{
	// 	"name": "code.py",
	// 	"description": "Generate code with a Python-specific template embedded into the prompt."
	// 	},
	// 	{
	// 	"name": "commit_message",
	// 	"description": "Generate a commit message for the given git diff."
	// 	},
	// 	{
	// 	"name": "release_note",
	// 	"description": "Generate a release note for the given commit log."
	// 	}
	// ]
	async commands(): Promise<CommandEntry[]> {
		const args = ["run", "--list"];
		const devChat = this.getDevChatPath();
		const workspaceDir = UiUtilWrapper.workspaceFoldersFirstPath();

		logger.channel()?.info(`Running devchat with arguments: ${args.join(" ")}`);
		const spawnOptions = {
			maxBuffer: 10 * 1024 * 1024, // Set maxBuffer to 10 MB
			cwd: workspaceDir,
			env: {
				...process.env
			},
		};

		const { exitCode: code, stdout, stderr } = await this.commandRun.spawnAsync(devChat, args, spawnOptions, undefined, undefined, undefined, undefined);
		logger.channel()?.info(`Finish devchat with arguments: ${args.join(" ")}`);
		if (stderr) {
			logger.channel()?.error(`Error: ${stderr}`);
			logger.channel()?.show();
			return [];
		}

		try {
			const commands = JSON.parse(stdout.trim());
			return commands;
		} catch (error) {
			logger.channel()?.error(`Error parsing JSON: ${error}`);
			logger.channel()?.show();
			return [];
		}
	}

	async commandPrompt(command: string): Promise<string> {
		const args = ["run", command];
		const devChat = this.getDevChatPath();
		const workspaceDir = UiUtilWrapper.workspaceFoldersFirstPath();

		logger.channel()?.info(`Running devchat with arguments: ${args.join(" ")}`);
		const spawnOptions = {
			maxBuffer: 10 * 1024 * 1024, // Set maxBuffer to 10 MB
			cwd: workspaceDir,
			env: {
				...process.env
			},
		};

		const { exitCode: code, stdout, stderr } = await this.commandRun.spawnAsync(devChat, args, spawnOptions, undefined, undefined, undefined, undefined);
		logger.channel()?.info(`Finish devchat with arguments: ${args.join(" ")}`);
		if (stderr) {
			logger.channel()?.error(`Error: ${stderr}`);
			logger.channel()?.show();
		}
		return stdout;
	}

	async updateSysCommand(): Promise<string> {
		const args = ["run", "--update-sys"];
		const devChat = this.getDevChatPath();
		const workspaceDir = UiUtilWrapper.workspaceFoldersFirstPath();

		logger.channel()?.info(`Running devchat with arguments: ${args.join(" ")}`);
		const spawnOptions = {
			maxBuffer: 10 * 1024 * 1024, // Set maxBuffer to 10 MB
			cwd: workspaceDir,
			env: {
				...process.env
			},
		};

		const { exitCode: code, stdout, stderr } = await this.commandRun.spawnAsync(devChat, args, spawnOptions, undefined, undefined, undefined, undefined);
		logger.channel()?.info(`Finish devchat with arguments: ${args.join(" ")}`);
		if (stderr) {
			logger.channel()?.error(`Error: ${stderr}`);
			logger.channel()?.show();
		}
		logger.channel()?.info(`${stdout}`);
		return stdout;
	}

	async topics(): Promise<TopicEntry[]> {
		const args = ["topic", "-l"];
		const devChat = this.getDevChatPath();
		const workspaceDir = UiUtilWrapper.workspaceFoldersFirstPath();
		
		logger.channel()?.info(`Running devchat with arguments: ${args.join(" ")}`);
		const spawnOptions = {
			maxBuffer: 10 * 1024 * 1024, // Set maxBuffer to 10 MB
			cwd: workspaceDir,
			env: {
				...process.env
			},
		};
		const { exitCode: code, stdout, stderr } = await this.commandRun.spawnAsync(devChat, args, spawnOptions, undefined, undefined, undefined, undefined);

		logger.channel()?.info(`Finish devchat with arguments: ${args.join(" ")}`);
		if (stderr) {
			logger.channel()?.error(`Error: ${stderr}`);
			logger.channel()?.show();
			return [];
		}

		try {
			const topics = JSON.parse(stdout.trim()).reverse();
			// convert responses to respose, and remove responses field
			// responses is in TopicEntry.root_prompt.responses
			for (const topic of topics) {
				if (topic.root_prompt.responses) {
					topic.root_prompt.response = topic.root_prompt.responses[0];
					delete topic.root_prompt.responses;
				}
			}
			return topics;
		} catch (error) {
			logger.channel()?.error(`Error parsing JSON: ${error}`);
			logger.channel()?.show();
			return [];
		}
	}

	private buildLogArgs(options: LogOptions): string[] {
		let args = ["log"];

		if (options.skip) {
			args.push('--skip', `${options.skip}`);
		}
		if (options.maxCount) {
			args.push('--max-count', `${options.maxCount}`);
		} else {
			const maxLogCount = UiUtilWrapper.getConfiguration('DevChat', 'maxLogCount');
			args.push('--max-count', `${maxLogCount}`);
		}

		if (options.topic) {
			args.push('--topic', `${options.topic}`);
		}

		return args;
	}

	private getDevChatPath(): string {
		let devChat: string | undefined = UiUtilWrapper.getConfiguration('DevChat', 'DevChatPath');
		if (!devChat) {
			devChat = 'devchat';
		}
		return devChat;
	}
}

export default DevChat;
