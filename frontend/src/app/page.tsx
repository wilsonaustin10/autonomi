'use client'

import { useEffect, useState } from "react";
import ChatBox from "./components/ChatBox";
import { Message } from "./actions/types";
import InteractiveBrowser from "./components/InteractiveBrowser";

export default function Home() {
  const [status, setStatus] = useState<string>("")
  const [initialMessages, setInitialMessages] = useState<Message[]>([
    {role: "assistant", content: "Hello, I'm the AutonoM3 Agent Building Assistant. How can I help you today?"}
  ])

  return (
    <div className="flex flex-col min-h-screen">
      <h1 className="text-4xl text-center leading-loose font-bold">AutonoM3 Agent Building</h1>>
      <div className="flex-1 grid md:grid-cols-5 gap-4 p-4">
        <div className="md:col-span-2 bg-gray-100 border border-1 p-4">
          <ChatBox initialMessages={initialMessages} />

        </div>
        <div className="md:col-span-3 bg-gray-100">
          <InteractiveBrowser/>
        </div>
      </div>
    </div>
  );
}
