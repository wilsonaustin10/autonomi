import { NextRequest } from "next/server";
import { streamText } from "ai";
import {openai} from '@ai-sdk/openai'

export async function POST(req: NextRequest) {
    try {
        const {messages } = await req.json()
        const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

        const stream = streamText({
            model: openai(model),
            system: "You are a helpful assistant that can help with Playwright automation.",
            messages: [
                ...messages,
            ]
        });
        return stream.toDataStreamResponse();

    } catch (error) {
        console.error("Error in chat API:", error)
        return new Response("Internal Server Error", {status: 500})
    }
}