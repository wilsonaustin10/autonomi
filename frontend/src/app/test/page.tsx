
'use client'

import { Button } from "@/components/ui/button";
import { processStream } from "@/lib/llm-text";
import { Message } from "@/types/messages";

import { useRef, useState } from "react";
import ChatMessage from "../components/ChatMessage";

export default function TestPage() {
    async function getHtmlData(url: string) {
        const response = await fetch(url);
        const html = await response.text();
        return html;
    }
    const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
        // console.log(e.clientX, e.clientY)
        // const rect = e.currentTarget.getBoundingClientRect();
        // console.log(rect.left, rect.top, rect.width, rect.height);

        const html = await getHtmlData("https://www.google.com");
        console.log("Making the call")
        const response = await fetch("/api/processing", {
            method: "POST",
            body: JSON.stringify({ content: html, url: "https://www.google.com" })
        });
        console.log("done the call")
        const {html: shortenedHtml, interactiveElements} = await response.json();
        console.log("shortened html", shortenedHtml.length, shortenedHtml);
        console.log("interactive elements", interactiveElements);
        // console.log("full html", html.length, html);
    }

    const currentResponseRef = useRef<string>("");
    const [messages, setMessages] = useState<Message[]>([]);
    const handleButtonClick = async () => {

        const sessionId = crypto.randomUUID();
        const response = await fetch("/api/computer-use", {
            method: "POST",
            body: JSON.stringify({
                messageHistory: [],
                userMessage: "What is the top post on Reddit today?",
                sessionId
            })
        })
        
        const data = await response.json()
        if (data.success) {
            console.log(data.response);
        }
    }

    return (
        <div className="w-screen h-[100vh] flex items-center justify-center" onClick={handleClick}>
            <div className="w-10 h-10 bg-red-500" onClick={handleClick}></div>
            <Button className="" onClick={handleButtonClick}>Balls</Button>
            <div>
                {messages.map((message, index) => (
                    <ChatMessage key={index} {...message} />
                ))}
            </div>
        </div>
    )
}
