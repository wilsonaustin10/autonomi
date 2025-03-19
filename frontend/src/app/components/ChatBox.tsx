'use client'

import { useState } from "react"
import ChatMessage, { type ChatMessageType } from "./ChatMessage"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type P = {
    initialMessages: ChatMessageType[];
}

export default function ChatBox({initialMessages}: P) {
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages)
  const [inputMessage, setInputMessage] = useState<string>("")

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessages([...messages, {message: inputMessage, sender: "user"}])
    setInputMessage("")
  }
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto flex flex-col gap-2" style={{scrollBehavior: "smooth", maxHeight: "calc(100% -70%"}}>
        {messages.map((message, index) => (
          <ChatMessage key={index} {...message} />
        ))}
      </div>
      <form onSubmit={handleSendMessage} className="border-t p-4 flex gap-2">
        <Input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message here..."/>
        <Button type="submit">Send</Button>
      </form>
    </div>
  )
}
