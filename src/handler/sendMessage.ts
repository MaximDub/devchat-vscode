
import * as vscode from 'vscode';
import { MessageHandler } from './messageHandler';
import { regInMessage, regOutMessage } from '../util/reg_messages';
import { stopDevChatBase, sendMessageBase, deleteChatMessageBase } from './sendMessageBase';
import { UiUtilWrapper } from '../util/uiUtil';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';


let _lastMessage: any = undefined;

export function createTempFile(content: string): string {
    // Generate a unique file name
    const fileName = path.join(os.tmpdir(), `temp_${Date.now()}.txt`);

    // Write the content to the file
    fs.writeFileSync(fileName, content);

    return fileName;
}

export function deleteTempFiles(fileName: string): void {
    // Delete the file
    fs.unlinkSync(fileName);
}

regInMessage({command: 'sendMessage', text: '', parent_hash: undefined});
regOutMessage({ command: 'receiveMessage', text: 'xxxx', hash: 'xxx', user: 'xxx', date: 'xxx'});
regOutMessage({ command: 'receiveMessagePartial', text: 'xxxx', user: 'xxx', date: 'xxx'});
// message: { command: 'sendMessage', text: 'xxx', hash: 'xxx'}
// return message: 
//     { command: 'receiveMessage', text: 'xxxx', hash: 'xxx', user: 'xxx', date: 'xxx'}
//     { command: 'receiveMessagePartial', text: 'xxxx', user: 'xxx', date: 'xxx'}
export async function sendMessage(message: any, panel: vscode.WebviewPanel|vscode.WebviewView, function_name: string|undefined = undefined): Promise<void> {
    _lastMessage = [message, function_name];

    // Add a new field to store the names of temporary files
    let tempFiles: string[] = [];

    // Handle the contextInfo field in the message
    if (Array.isArray(message.contextInfo)) {
        for (let context of message.contextInfo) {
            if (typeof context === 'object' && context !== null && 'context' in context) {
                // If the file name is not present, create a temporary file
                if (!context.file) {
                    try {
                        const contextStr = JSON.stringify(context.context);
                        context.file = createTempFile(contextStr);
                        // Add the file name to the tempFiles array
                        tempFiles.push(context.file);
                    } catch (err) {
                        console.error('Failed to create temporary file:', err);
                        throw err;
                    }
                }
                // Insert the file name into the text field
                message.text += ` [context|${context.file}]`;
            }
        }
    }
	// clear message.contextInfo
	message.contextInfo = undefined;

    const responseMessage = await sendMessageBase(message, (data: { command: string, text: string, user: string, date: string}) => {
        MessageHandler.sendMessage(panel, data, false);
    }, function_name);
    if (responseMessage) {
        MessageHandler.sendMessage(panel, responseMessage);
    }

    // Delete all temporary files created
    for (let file of tempFiles) {
        deleteTempFiles(file);
    }
}


// regeneration last message again
regInMessage({command: 'regeneration'});
export async function regeneration(message: any, panel: vscode.WebviewPanel|vscode.WebviewView): Promise<void> {
	// call sendMessage to send last message again
	if (_lastMessage) {
		sendMessage(_lastMessage[0], panel, _lastMessage[1]);
	}
}

regInMessage({command: 'stopDevChat'});
export async function stopDevChat(message: any, panel: vscode.WebviewPanel|vscode.WebviewView): Promise<void> {
	stopDevChatBase(message);
}

regInMessage({command: 'deleteChatMessage', hash: 'xxx'});
regOutMessage({ command: 'deletedChatMessage', hash: 'xxxx'});
export async function deleteChatMessage(message: any, panel: vscode.WebviewPanel|vscode.WebviewView): Promise<void> {
	// prompt user to confirm
	const confirm = await vscode.window.showWarningMessage(
		`Are you sure to delete this message?`,
		{ modal: true },
		'Delete'
	);
	if (confirm !== 'Delete') {
		return;
	}
	
	const deleted = await deleteChatMessageBase(message);
	if (deleted) {
		MessageHandler.sendMessage(panel, { command: 'deletedChatMessage', hash: message.hash });
	} else {
		UiUtilWrapper.showErrorMessage('Delete message failed!');
	}
}



