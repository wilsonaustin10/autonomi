

export type ChatMessageType = {
    message: string;
    sender: "user" | "assistant";
}

export default function ChatMessage({message, sender}: ChatMessageType) {
  return (
    <div className={`flex ${sender === "user" ? "justify-end" : "justify-start"} mb-2`}>
        <div
            className={`max-w-[70%] px-2 py-1 rounded-lg ${
            sender === "user" 
                ? "bg-blue-500 text-white rounded-tr-none" 
                : "bg-gray-200 text-gray-800 rounded-tl-none"
            }`}
        >
            {message}
        </div>
    </div>
  )
}
