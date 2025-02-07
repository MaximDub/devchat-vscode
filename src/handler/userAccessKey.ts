/*
Update config
*/

import * as vscode from 'vscode';
import { regInMessage, regOutMessage } from '../util/reg_messages';
import { UiUtilWrapper } from '../util/uiUtil';
import { MessageHandler } from './messageHandler';
import { ApiKeyManager } from '../util/apiKey';

regInMessage({command: 'getUserAccessKey'});
regOutMessage({command: 'getUserAccessKey', accessKey: "DC.xxx", keyType: "DevChat", endPoint: "https://xxx"});
export async function getUserAccessKey(message: any, panel: vscode.WebviewPanel|vscode.WebviewView): Promise<void> {
	const workspaceDir = UiUtilWrapper.workspaceFoldersFirstPath();
		const llmModelData = await ApiKeyManager.llmModel();
		if (!llmModelData || !llmModelData.api_key) {
			MessageHandler.sendMessage(panel, {"command": "getUserAccessKey", "accessKey": "", "keyType": "", "endPoint": ""});
			return;
		}

		let keyType: string = "others";
		if (llmModelData.api_key?.startsWith("DC.")) {
			keyType = "DevChat";
		}

		let openAiApiBase = llmModelData.api_base;
		if (!openAiApiBase) {
			openAiApiBase = "";
		}
		MessageHandler.sendMessage(panel, {"command": "getUserAccessKey", "accessKey": llmModelData.api_key, "keyType": keyType, "endPoint": openAiApiBase});
}