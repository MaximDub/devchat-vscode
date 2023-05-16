import * as vscode from 'vscode';
import DevChat, { LogOptions, LogEntry } from '../toolwrapper/devchat';
import { MessageHandler } from './messageHandler';
import messageHistory from '../util/messageHistory';
import { regInMessage, regOutMessage } from '../util/reg_messages';


interface LoadHistoryMessages {
	command: string;
	entries: Array<LogEntry>;
}

regInMessage({command: 'historyMessages', options: { skip: 0, maxCount: 0 }});
regOutMessage({command: 'loadHistoryMessages', entries: [{hash: '',user: '',date: '',request: '',response: '',context: [{content: '',role: ''}]}]});
export async function historyMessages(message: any, panel: vscode.WebviewPanel|vscode.WebviewView): Promise<void> {
	const devChat = new DevChat();

	const logOptions: LogOptions = message.options || {};
	const logEntries = await devChat.log(logOptions);
	
	const logEntriesFlat = logEntries.flat();
	// TODO handle context
    
	const logEntriesFlatFiltered = logEntriesFlat.map((entry) => {
        return {
			date: entry.date,
			hash: entry.hash,
			request: entry.request,
			text: entry.response,
			user: entry.user,
			parentHash: '',
		};
    });

	for (let i = 0; i < logEntriesFlat.length; i++) {
		let entryOld = logEntriesFlat[i];
		let entryNew = {
			date: entryOld.date,
			hash: entryOld.hash,
			request: entryOld.request,
			text: entryOld.response,
			user: entryOld.user,
			parentHash: '',
		};
		if (i > 0) {
			entryNew.parentHash = logEntriesFlat[i - 1].hash;
		}
		messageHistory.add(panel, entryNew);
	}

	const loadHistoryMessages: LoadHistoryMessages = {
		command: 'loadHistoryMessages',
		entries: logEntriesFlat,
	};

	MessageHandler.sendMessage(panel, loadHistoryMessages);
	return;
}


