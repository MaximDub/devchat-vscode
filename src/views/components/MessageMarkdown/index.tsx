import { Button, Anchor } from "@mantine/core";
import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { okaidia } from "react-syntax-highlighter/dist/esm/styles/prism";
import CodeButtons from "./CodeButtons";
import { observer } from "mobx-react-lite";
import { useMst } from "@/views/stores/RootStore";
import { Message } from "@/views/stores/ChatStore";
import messageUtil from '@/util/MessageUtil';

interface IProps {
    messageText: string
}

const MessageMarkdown = observer((props: IProps) => {
    const { messageText } = props;
    const { chat } = useMst();

    const LanguageCorner = (props: any) => {
        const { language } = props;

        return (<div style={{ position: 'absolute', top: 0, left: 0 }}>
            {language && (
                <div style={{
                    backgroundColor: '#333',
                    color: '#fff',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.2rem',
                    fontSize: '0.8rem',
                }}>
                    {language}
                </div>
            )}
        </div>);
    };

    const handleExplain = (value: string | undefined) => {
        console.log(value);
        switch (value) {
            case "#ask_code":
                chat.addMessages([
                    Message.create({
                        type: 'user',
                        message: 'Explain /ask_code'
                    }),
                    Message.create({
                        type: 'bot',
                        message: `***/ask_code***

If you would like to ask questions related to your own codebase, you can enable and use the /ask_code feature of DevChat.

While /ask_code is being enabled, DevChat will need to index your codebase before you can use this feature. Indexing usually takes a while, depending on the size of your codebase, your computing power and the network. Once it’s done, you can ask questions about your codebase by typing the “/ask_code” command, followed by your question.

Example questions:
(Here we only show example questions from a few popular open-source projects’ codebases.)

How do I access POST form fields in Express?
How do I pass command line arguments to a Node.js program?
How do I print the value of a tensor object in TensorFlow?
How do I force Kubernetes to re-pull an image in Kubernetes?
How do I set focus on an input field after rendering in React?

How to index your codebase?

\`Please check DevChat.ask_code settings\` before enabling the feature, because once indexing has been started, changing the settings will not affect the process anymore, unless if you terminate it and re-index.

To enable, you can enter \`DevChat:Start AskCode Index\` in the Command Palette or click on the button to start indexing now.
              
<button value="settings">Settings</button>
<button value="start_indexing">Start Indexing</button>
                        `
                    }),
                ]);
        }
        chat.goScrollBottom();
    };
    const handleButton = (value: string | number | readonly string[] | undefined) => {
        switch (value) {
            case "settings": messageUtil.sendMessage({ command: 'doCommand', content: ['workbench.action.openSettings', 'DevChat'] }); break;
            case "start_indexing": messageUtil.sendMessage({ command: 'doCommand', content: ['DevChat.AskCodeIndexStart'] }); break;
            case "setting_openai_key": messageUtil.sendMessage({ command: 'doCommand', content: ['workbench.action.openSettings', 'DevChat: Api_key_OpenAI'] }); break;
            case "setting_devchat_key": messageUtil.sendMessage({ command: 'doCommand', content: ['workbench.action.openSettings', 'DevChat: Access_key_DevChat'] }); break;
        }
    };

    return <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        components={{
            code({ node, inline, className, children, ...props }) {

                const match = /language-(\w+)/.exec(className || '');
                const value = String(children).replace(/\n$/, '');

                return !inline && match ? (
                    <div style={{ position: 'relative' }}>
                        <LanguageCorner language={match[1]} />
                        <CodeButtons language={match[1]} code={value} />
                        <SyntaxHighlighter {...props} language={match[1]} customStyle={{ padding: '3em 1em 1em 2em', }} style={okaidia} PreTag="div">
                            {value}
                        </SyntaxHighlighter>
                    </div >
                ) : (
                    <code {...props} className={className}>
                        {children}
                    </code>
                );
            },
            button({ node, className, children, value, ...props }) {
                return (
                    <Button
                        size='xs'
                        sx={{
                            backgroundColor: 'var(--vscode-button-background)',
                        }}
                        styles={{
                            icon: {
                                color: 'var(--vscode-button-foreground)'
                            },
                            label: {
                                color: 'var(--vscode-button-foreground)',
                                fontSize: 'var(--vscode-editor-font-size)',
                            }
                        }}
                        onClick={() => {
                            handleButton(value);
                        }}>
                        {children}
                    </Button>
                );
            },
            a({ node, className, children, href, ...props }) {
                const customAnchors = ["#code",
                    "#commit_message",
                    "#release_note",
                    "#ask_code",
                    "#extension"].filter((item) => item === href);
                return customAnchors.length > 0
                    ? <Anchor href={href} onClick={() => {
                        handleExplain(href);
                    }}>
                        {children}
                    </Anchor>
                    : <a {...props} href={href} className={className}>
                        {children}
                    </a>;
            }
        }}>
        {messageText}
    </ReactMarkdown >;
});

export default MessageMarkdown;