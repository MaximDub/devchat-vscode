import * as vscode from 'vscode';
import ChatContextManager from '../context/contextManager';
import {messageHandler} from './messageHandler';

async function addConext(message: any, panel: vscode.WebviewPanel): Promise<void> {
	const contextStr = await ChatContextManager.getInstance().processText(message.selected);
    panel.webview.postMessage({ command: 'appendContext', context: contextStr });  
	return;
}

messageHandler.registerHandler('addContext', addConext);

