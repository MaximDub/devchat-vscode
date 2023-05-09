
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import DevChat, { ChatResponse } from '../toolwrapper/devchat';
import CommandManager from '../command/commandManager';
import { logger } from '../util/logger';
import { MessageHandler } from './messageHandler';


// Add this function to messageHandler.ts
function parseMessage(message: string): { context: string[]; instruction: string[]; reference: string[]; text: string } {
	const contextRegex = /\[context\|(.*?)\]/g;
	const instructionRegex = /\[instruction\|(.*?)\]/g;
	const referenceRegex = /\[reference\|(.*?)\]/g;

	const contextPaths = [];
	const instructionPaths = [];
	const referencePaths = [];

	let match;

	// 提取 context
	while ((match = contextRegex.exec(message)) !== null) {
		contextPaths.push(match[1]);
	}

	// 提取 instruction
	while ((match = instructionRegex.exec(message)) !== null) {
		instructionPaths.push(match[1]);
	}

	// 提取 reference
	while ((match = referenceRegex.exec(message)) !== null) {
		referencePaths.push(match[1]);
	}

	// 移除标签，保留纯文本
	const text = message
		.replace(contextRegex, '')
		.replace(instructionRegex, '')
		.replace(referenceRegex, '')
		.trim();

	return { context: contextPaths, instruction: instructionPaths, reference: referencePaths, text };
}

function getInstructionFiles(): string[] {
	const instructionFiles: string[] = [];
	const workspaceDir = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
	if (workspaceDir) {
		const chatInstructionsPath = path.join(workspaceDir, '.chat', 'instructions', 'default');
		try {
			// 读取 chatInstructionsPath 目录下的所有文件和目录
			const files = fs.readdirSync(chatInstructionsPath);
			// 过滤出文件，忽略目录
			for (const file of files) {
				const filePath = path.join(chatInstructionsPath, file);
				const fileStats = fs.statSync(filePath);
				if (fileStats.isFile()) {
					instructionFiles.push(filePath);
				}
			}
		} catch (error) {
			logger.channel()?.error(`Error reading instruction files: ${error}`);
			logger.channel()?.show();
		}
	}
	return instructionFiles;
}



// message: { command: 'sendMessage', text: 'xxx', parent_hash: 'xxx'}
// return message: 
//     { command: 'receiveMessage', text: 'xxxx', hash: 'xxx', user: 'xxx', date: 'xxx'}
//     { command: 'receiveMessagePartial', text: 'xxxx', user: 'xxx', date: 'xxx'}
export async function sendMessage(message: any, panel: vscode.WebviewPanel): Promise<void> {
	const devChat = new DevChat();

	const newText2 = await CommandManager.getInstance().processText(message.text);
	const parsedMessage = parseMessage(newText2);
	const chatOptions: any = {};

	logger.channel()?.info(`parent_hash: ${message.parent_hash}`)
	if (message.parent_hash) {
		chatOptions.parent = message.parent_hash;
	}

	if (parsedMessage.context.length > 0) {
		chatOptions.context = parsedMessage.context;
	}

	chatOptions.header = getInstructionFiles();
	if (parsedMessage.instruction.length > 0) {
		chatOptions.header = parsedMessage.instruction;
	}

	if (parsedMessage.reference.length > 0) {
		chatOptions.reference = parsedMessage.reference;
	}

	const onData = (partialResponse: ChatResponse) => {
		MessageHandler.sendMessage(panel, { command: 'receiveMessagePartial', text: partialResponse.response, user: partialResponse.user, date: partialResponse.date }, false);
	};

	const chatResponse = await devChat.chat(parsedMessage.text, chatOptions, onData);
	
	MessageHandler.sendMessage(panel, { command: 'receiveMessage', text: chatResponse.response, hash: chatResponse['prompt-hash'], user: chatResponse.user, date: chatResponse.date, isError: chatResponse.isError });
	return;
}



