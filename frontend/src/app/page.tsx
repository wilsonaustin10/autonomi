'use client'

import { useEffect, useState } from "react";
import ChatBox from "./components/ChatBox";
import { Message } from "./actions/types";

export default function Home() {
  const [status, setStatus] = useState<string>("")
  const [initialMessages, setInitialMessages] = useState<Message[]>([
    {role: "assistant", content: "Hello, I'm the AutonoM3 Agent Building Assistant. How can I help you today?"}
  ])

  return (
    <div>
      <h1 className="text-4xl text-center leading-loose font-bold">AutonoM3 Agent Building</h1>
      <div>
        {/* Browser loaded? */}
      </div>
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 h-96 bg-gray-100 border border-1 p-4">
          <ChatBox initialMessages={initialMessages} />

        </div>
        <div className="lg:col-span-3 h-96 bg-gray-100">
          Browser
        </div>
      </div>
    </div>
  );
}
