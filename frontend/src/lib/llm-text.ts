// 'use server'

import { Message } from "@/types/messages";
import { RefObject } from "react";

export const processStream = async (
  response: Response, 
  currentResponseRef: RefObject<string>, 
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) => {

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
                        setMessages((prevMessages: Message[]) => {
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
  

