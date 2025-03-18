'use server'

import OpenAI from "openai"
import { ChatResponse, Message, ResponseType } from "./types";


// Default model to use
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
// Model for Computer Use
const COMPUTER_USE_MODEL = process.env.OPENAI_COMPUTER_USE_MODEL || 'gpt-4o';

let openai: OpenAI;

export function getOpenAiClient(): OpenAI {
    if (!openai) {
        try {

            openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                // Adding a longer timeout to prevent quick timeouts
                timeout: 60000, // Increased timeout for complex tasks
                maxRetries: 5,  // Increased retries
            })
        } catch (error) {
            console.error("Failed to create OpenAI client", error);
        }
    }
    return openai;
}

export async function generateChatResponse(userMessage: string, history: Message[]): Promise<ChatResponse> {
    const client = getOpenAiClient();
    if (!userMessage || userMessage.trim() === '') {
        return {
            type: ResponseType.Error,
            message: "Please provide a valid message or task."
        };
    }

    try {

        const response = client.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [
                {
                    role: "system",
                    content: 'You are an assistant that helps with Playwright automation. Provide helpful, concise responses.'
                },
                ...history,
                {
                    role: "user",
                    content: userMessage
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
        })

        return {
            type: ResponseType.Success,
            message: response.choices[0].message.content.trim() || 'No response from OpenAI'
        }
    } catch (error) {
        console.error("Error generating chat response", error);
        return {
            type: ResponseType.Error,
            message: "An error occurred while generating the response."
        }
    }
}
