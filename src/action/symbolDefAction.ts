
import { Action, CustomActions } from './customAction';

import { CommandResult } from '../util/commonUtil';
import { logger } from '../util/logger';


export class SymbolDefAction implements Action {
	name: string;
	description: string;
	type: string[];
	action: string;
	handler: string[];
	args: { "name": string, "description": string, "type": string, "as"?: string, "from": string }[];

	constructor() {
		this.name = 'symbol_def';
		this.description = 'Retrieve the definition information related to the symbol';
		this.type = ['symbol'];
		this.action = 'symbol_def';
		this.handler = [];
		this.args = [
			{"name": "symbol", "description": "The symbol variable specifies the symbol for which definition information is to be retrieved.", "type": "string", "from": "content.content.symbol"},
		];
	}

	async handlerAction(args: {[key: string]: any}): Promise<CommandResult> {
		try {
			const symbolName = args.symbol;

			// get reference information

			return {exitCode: 0, stdout: "", stderr: ""};
		} catch (error) {
			logger.channel()?.error(`${this.name} handle error: ${error}`);
			logger.channel()?.show();
			return {exitCode: -1, stdout: '', stderr: `${this.name} handle error: ${error}`};
		}
	}
};