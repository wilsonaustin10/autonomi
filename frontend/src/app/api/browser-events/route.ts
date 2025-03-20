import { browserEvents } from '@/app/actions/browser';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') || Math.random().toString(36).substring(2, 15);

  // Set up SSE headers
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Generate events
      for await (const event of browserEvents(sessionId)) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }
    },
    cancel() {
      // Clean up resources
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
} 