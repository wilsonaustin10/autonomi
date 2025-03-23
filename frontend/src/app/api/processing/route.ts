import { extractInteractiveElements, getProcessedText } from "@/app/api/processing/getProcessedText";
import { NextRequest, NextResponse } from "next/server";

/**
 * This route is used to process the HTML text and extract the interactive elements.
 * @param req - The request object
 *  @param req.content - The HTML text to process
 *  @param req.url - The URL of the HTML text
 * @returns The processed HTML text and the interactive elements
 * - @param html: The processed HTML text
 * - @param interactiveElements: The interactive elements
 */
export async function POST(req: NextRequest) {
    const { content, url } = await req.json();

    const html = await getProcessedText(content, url);
    const interactiveElements = await extractInteractiveElements(content);

    return NextResponse.json({ html, interactiveElements });
}