import { NextRequest } from "next/server";
import { executeTaskLoop, getPageInfo } from "./task";

/**
 * Handles the computer use API request.
 * @param req - The request object containing the messages and sessionId.
 * - @param req.messageHistory - The message history: string[]
 * - @param req.userMessage - The user message: string
 * - @param req.sessionId - The session ID: string
 * @returns A response from the OpenAI model.
 */

export async function POST(req: NextRequest) {
    try {
        const { messageHistory, userMessage, sessionId } = await req.json();
        const model = process.env.COMPUTER_USE_MODEL || "gpt-4o-mini";

        const response = await executeTaskLoop(model, userMessage, sessionId)
        
        const pageInfo = await getPageInfo(sessionId);
        return Response.json({
            response,
            pageInfo
        });
    } catch (error) {
        console.error("Error generating computer use response:", error)
        return new Response("Internal Server Error", {status: 500})
    } 
}