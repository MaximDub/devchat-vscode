import { types, flow, Instance } from "mobx-state-tree";
import messageUtil from '@/util/MessageUtil';
import { ChatContext } from '@/views/stores/InputStore';
import { features } from "process";

interface Context {
    content: string;
    role: string;
}

interface Entry {
    hash: string;
    type: string,
    user: string;
    date: string;
    request: string;
    response: string;
    context: Context[];
}

interface LoadHistoryMessage {
    command: string;
    entries: Entry[];
}

export const fetchHistoryMessages = async (params) => {
    const { pageIndex } = params;
    return new Promise<{ pageIndex: number, entries: Entry[] }>((resolve, reject) => {
        try {
            messageUtil.sendMessage({ command: 'historyMessages', page: pageIndex });
            messageUtil.registerHandler('loadHistoryMessages', (message: LoadHistoryMessage) => {
                resolve({
                    pageIndex: pageIndex,
                    entries: message.entries
                });
            });
        } catch (e) {
            reject(e);
        }
    });
};

export const deleteMessage = async (messageHash: string) => {
    return new Promise<{ hash: string }>((resolve, reject) => {
        try {
            messageUtil.sendMessage({ command: 'deleteChatMessage', hash: messageHash });
            messageUtil.registerHandler('deletedChatMessage', (message) => {
                resolve({
                    hash: message.hash
                });
            });
        } catch (e) {
            reject(e);
        }
    });
};

export const Message = types.model({
    index: types.maybe(types.number),
    hash: types.maybe(types.string),
    type: types.enumeration(['user', 'bot', 'system']),
    message: types.string,
    contexts: types.maybe(types.array(ChatContext)),
});

export const ChatStore = types.model('Chat', {
    generating: false,
    responsed: false,
    currentMessage: '',
    hasDone: false,
    errorMessage: '',
    messages: types.array(Message),
    pageIndex: 0,
    isLastPage: false,
    isBottom: true,
    isTop: false,
    scrollBottom: 0,
    chatModel: 'GPT-3.5',
    chatPanelWidth: 300,
    rechargeSite: 'https://devchat.ai/pricing/',
    features: types.optional(types.frozen(), {})
})
    .actions(self => {

        const helpMessage = (originalMessage = false) => {

            let helps = `
Do you want to write some code or have a question about the project? Simply right-click on your chosen files or code snippets and add them to DevChat. Feel free to ask me anything or let me help you with coding.
    
Don't forget to check out the "+" button on the left of the input to add more context. To see a list of workflows you can run in the context, just type "/". Happy prompting!

To get started, here are some of the things that I can do for you:

[/code(default): write code based on your prompt](#code)

[/commit_message: compose a commit message based on your code changes](#commit_message)

[/release_note: draft a release note based on your latest commits](#release_note)

${self.features['ask-code'] ? '[/ask-code: ask me questions about your codebase](#ask_code)' : ''}

You can configure DevChat from [Settings](#settings).`;

            self.messages.push(
                Message.create({
                    type: 'user',
                    message: originalMessage ? "How do I use DevChat?" : '/help'
                }));
            self.messages.push(
                Message.create({
                    type: 'bot',
                    message: helps
                }));
        };

        return {
            helpMessage,
            updateChatPanelWidth: (width: number) => {
                self.chatPanelWidth = width;
            },
            changeChatModel: (chatModel: string) => {
                self.chatModel = chatModel;
            },
            updateFeatures: (features: any) => {
                self.features = features;
            },
            startGenerating: (text: string, chatContexts) => {
                self.generating = true;
                self.responsed = false;
                self.hasDone = false;
                self.errorMessage = '';
                self.currentMessage = '';
                let lastNonEmptyHash;
                for (let i = self.messages.length - 1; i >= 0; i--) {
                    if (self.messages[i].hash) {
                        lastNonEmptyHash = self.messages[i].hash;
                        break;
                    }
                }
                // Process and send the message to the extension
                const contextInfo = chatContexts.map((item, index: number) => {
                    const { file, path, content, command } = item;
                    return {
                        file,
                        context: {
                            path: path,
                            command: command,
                            content: content,
                        }
                    };
                });
                messageUtil.sendMessage({
                    command: 'sendMessage',
                    text: text,
                    contextInfo: contextInfo,
                    parent_hash: lastNonEmptyHash === 'message' ? null : lastNonEmptyHash
                });
            },
            startSystemMessage: () => {
                self.generating = true;
                self.responsed = false;
                self.hasDone = false;
                self.errorMessage = '';
                self.currentMessage = '';
            },
            reGenerating: () => {
                self.generating = true;
                self.responsed = false;
                self.hasDone = false;
                self.errorMessage = '';
                self.currentMessage = '';
                self.messages.pop();
                messageUtil.sendMessage({
                    command: 'regeneration'
                });
            },
            stopGenerating: (hasDone: boolean, hash: string = '', message: string = '') => {
                self.generating = false;
                self.responsed = false;
                self.hasDone = hasDone;
                const messagesLength = self.messages.length;
                if (hasDone) {
                    if (messagesLength > 1) {
                        self.messages[messagesLength - 2].hash = hash;
                        self.messages[messagesLength - 1].hash = hash;
                    } else if (messagesLength > 0) {
                        self.messages[messagesLength - 1].hash = hash;
                    }
                } else {
                    self.messages[messagesLength - 1].message = message;
                }
            },
            startResponsing: (message: string) => {
                self.responsed = true;
                self.currentMessage = message;
            },
            newMessage: (message: IMessage) => {
                self.messages.push(message);
            },
            addMessages: (messages: IMessage[]) => {
                self.messages.push(...messages);
            },
            updateLastMessage: (message: string) => {
                if (self.messages.length > 0) {
                    self.messages[self.messages.length - 1].message = message;
                }
            },
            shiftMessage: () => {
                self.messages.splice(0, 1);
            },
            popMessage: () => {
                self.messages.pop();
            },
            clearMessages: () => {
                self.messages.length = 0;
            },
            happendError: (errorMessage: string) => {
                self.errorMessage = errorMessage;
            },
            onMessagesTop: () => {
                self.isTop = true;
                self.isBottom = false;
            },
            onMessagesBottom: () => {
                self.isTop = false;
                self.isBottom = true;
            },
            onMessagesMiddle: () => {
                self.isTop = false;
                self.isBottom = false;
            },
            goScrollBottom: () => {
                self.scrollBottom++;
            },
            fetchHistoryMessages: flow(function* (params: { pageIndex: number }) {
                const { pageIndex, entries } = yield fetchHistoryMessages(params);
                if (entries.length > 0) {
                    self.pageIndex = pageIndex;
                    const messages = entries
                        .map((entry, index) => {
                            const { hash, user, date, request, response, context } = entry;
                            const chatContexts = context?.map(({ content }) => {
                                return JSON.parse(content);
                            });
                            return [
                                { type: 'user', message: request, contexts: chatContexts, date: date, hash: hash },
                                { type: 'bot', message: response, date: date, hash: hash },
                            ];
                        })
                        .flat();
                    if (self.pageIndex === 0) {
                        self.messages.push(...messages);
                    } else if (self.pageIndex > 0) {
                        self.messages.concat(...messages);
                    }
                } else {
                    self.isLastPage = true;
                    if (self.messages.length === 0) {
                        helpMessage(true);
                    }
                }
            }),
            deleteMessage: flow(function* (messageHash: string) {
                const { hash } = yield deleteMessage(messageHash);
                const index = self.messages.findIndex((item: any) => item.hash === hash);
                if (index > -1) {
                    self.messages.splice(index);
                }
            })
        };
    });


export type IMessage = Instance<typeof Message>;