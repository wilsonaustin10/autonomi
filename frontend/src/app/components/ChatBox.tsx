'use client'

import { useEffect, useRef, useState } from "react"
import ChatMessage from "./ChatMessage"
import { Button } from "@/components/ui/button"
import { Message } from "../../types/messages"
import { Textarea } from "@/components/ui/textarea"
import { processStream } from "@/lib/llm-text"

type P = {
    initialMessages: Message[];
    sessionId: string;
    updateBrowserState: (result: any) => void;
}

export default function ChatBox({ initialMessages, sessionId, updateBrowserState }: P) {
    const [messages, setMessages] = useState<Message[]>(initialMessages)
    const [inputMessage, setInputMessage] = useState<string>("")
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const currentResponseRef = useRef<string>("");

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const handleSendMessage = async (e: React.FormEvent<HTMLButtonElement>) => {
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
                body: JSON.stringify(
                    {
                        messages,
                        inputMessage,
                        sessionId
                    }
                )
            })
            if (!response.ok) {
                console.error("Failed to generate chat response")
                return;
            }

            await processStream(response, currentResponseRef, setMessages)
        } catch (error) {
            console.error("Error generating chat response:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleComputerUse = async (e: React.FormEvent<HTMLButtonElement>) => {
        e.preventDefault()
        if (!inputMessage.trim() || isLoading) return;
        setMessages(prevMessages => [...prevMessages, { content: inputMessage, role: "user" }])
        setInputMessage("")
        setIsLoading(true);

        currentResponseRef.current = "";
        try {
            setMessages(prevMessages => [...prevMessages, { content: "", role: "assistant" }])
            const response = await fetch("/api/computer-use", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(
                    { 
                        messages,
                        userMessage: inputMessage,
                        sessionId
                    }
                )
            })
            const data = await response.json();
            console.log(data);

            updateBrowserState(data.pageInfo);
        } catch (error) {
            console.error("Error generating computer use response:", error)
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
            {/* <form onSubmit={handleSendMessage} className="border-t p-4 flex gap-2">
            </form> */}
                <Textarea
                    rows={1}
                    value={inputMessage}
                    className="cursor-pointer"
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your message here..." />
                <Button type="submit" onClick={handleSendMessage}>Send</Button>
                <Button type="submit" onClick={handleComputerUse}>computerUse</Button>
        </div>
    )
}
