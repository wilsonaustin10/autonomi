'use client'

import { useEffect, useRef, useState } from "react"
import ChatMessage, { type ChatMessageType } from "./ChatMessage"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { generateChatResponse } from "../actions/openai-client"
import { Message } from "../actions/types"

type P = {
    initialMessages: Message[];
}

export default function ChatBox({ initialMessages }: P) {
    const [messages, setMessages] = useState<Message[]>(initialMessages)
    const [inputMessage, setInputMessage] = useState<string>("")
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const currentResponseRef = useRef<string>("");

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!inputMessage.trim() || isLoading) return;
        setMessages(prevMessages => [...prevMessages, { content: inputMessage, role: "user" }])
        setInputMessage("")
        setIsLoading(true);

        currentResponseRef.current = "";
        try {
            // Note: You MUST use the synchronous API to update the messages here, or it will override the previous user message
            setMessages(prevMessages => [...prevMessages, { content: "", role: "assistant" }])
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ messages: [...messages, { content: inputMessage, role: "user" }] })
            })
            if (!response.ok) {
                console.error("Failed to generate chat response")
                return;
            }

            const processStream = async () => {

                const reader = response.body?.getReader();
                if (!reader) {
                    console.error("No reader found")
                    return;
                }

                const decoder = new TextDecoder();
                let done = false
                let lastContent = ""
                try {
                    while (!done) {
                        const { value, done: doneReading } = await reader.read();
                        done = doneReading;
                        if (value) {
                            const chunk = decoder.decode(value, { stream: true });

                            // The format appears to be 0:"text" without quotes around the key
                            const regex = /0:"([^"]*)"/g;
                            let match: RegExpExecArray | null;

                            const tokensFromChunk: string[] = [];
                            while ((match = regex.exec(chunk)) !== null) {
                                tokensFromChunk.push(match[1]);
                            }
                            if (tokensFromChunk.length > 0) {
                                const newContent = tokensFromChunk.join("");
                                currentResponseRef.current += newContent

                                const latestContent = currentResponseRef.current;
                                if (latestContent !== lastContent) {
                                    lastContent = latestContent;
                                    setMessages(prevMessages => {
                                        const updatedMessages = [...prevMessages];
                                        const lastIndex = updatedMessages.length - 1;

                                        // Only update if the last message is from the assistant
                                        if (lastIndex >= 0 && updatedMessages[lastIndex].role === 'assistant') {
                                            updatedMessages[lastIndex] = {
                                                ...updatedMessages[lastIndex],
                                                content: latestContent
                                            };
                                        }

                                        return updatedMessages;
                                    });
                                }
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }
                
            }
            
            await processStream()
            console.log(messages)
        } catch (error) {
            console.error("Error generating chat response:", error)
        } finally {
            setIsLoading(false)
        }
    }
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto flex flex-col gap-2" style={{ scrollBehavior: "smooth", maxHeight: "calc(100% -70%" }}>
                {messages.map((message, index) => (
                    <ChatMessage key={index} {...message} />
                ))}
            </div>
            <form onSubmit={handleSendMessage} className="border-t p-4 flex gap-2">
                <Input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your message here..." />
                <Button type="submit">Send</Button>
            </form>
        </div>
    )
}
