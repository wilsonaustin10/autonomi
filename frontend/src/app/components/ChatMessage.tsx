import { Message } from "../../types/messages";



export default function ChatMessage({content, role}: Message) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"} mb-2`}>
        <div
            className={`max-w-[70%] px-2 py-1 rounded-lg ${
            role === "user" 
                ? "bg-blue-500 text-white rounded-tr-none" 
                : "bg-gray-200 text-gray-800 rounded-tl-none"
            }`}
        >
            {content.toString()}
        </div>
    </div>
  )
}
