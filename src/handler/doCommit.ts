import * as vscode from 'vscode';
import DtmWrapper from '../toolwrapper/dtm';
import { regInMessage, regOutMessage } from '../util/reg_messages';


regInMessage({command: 'doCommit', content: ''});
export async function doCommit(message: any, panel: vscode.WebviewPanel|vscode.WebviewView): Promise<void> {
	const dtmWrapper = new DtmWrapper();

	const commitResult = await dtmWrapper.commit(message.content);
	if (commitResult.status === 0) {
		vscode.window.showInformationMessage('Commit successfully.');
	} else {
		vscode.window.showErrorMessage(`Error commit fail: ${commitResult.message} ${commitResult.log}`);
	}
	return;
}


