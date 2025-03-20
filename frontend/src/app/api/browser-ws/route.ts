import { NextRequest } from 'next/server';
import { chromium, Browser, Page } from 'playwright-core';
import { BrowserPool } from '@/lib/browser-pool';

// Initialize browser pool
const browserPool = new BrowserPool();

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get('id') || Math.random().toString(36).substring(2, 15);

  // This is needed for WebSockets in Edge Runtime
  const upgradeHeader = req.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  // Set up WebSocket handlers
  socket.onopen = async () => {
    console.log(`WebSocket connection opened: ${connectionId}`);
    
    try {
      // Get browser instance from pool
      const { page } = await browserPool.getBrowser(connectionId);
      
      // Navigate to default page
      await page.goto('https://example.com');
      
      // Send initial content
      const content = await page.content();
      socket.send(JSON.stringify({
        type: 'content',
        html: content,
        url: page.url()
      }));
    } catch (error) {
      console.error('Error initializing browser:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: `Error initializing browser: ${error.message}`
      }));
    }
  };
  
  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      const { page } = await browserPool.getBrowser(connectionId);
      
      switch (data.action) {
        case 'navigate':
          socket.send(JSON.stringify({
            type: 'log',
            message: `Navigating to ${data.url}`
          }));
          
          await page.goto(data.url, { timeout: 30000 });
          break;
          
        // Other actions (click, fill, etc.) as in the previous example
        // ...
      }
      
      // Send updated content
      const updatedContent = await page.content();
      socket.send(JSON.stringify({
        type: 'content',
        html: updatedContent,
        url: page.url()
      }));
    } catch (error) {
      console.error('Error processing browser action:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  };
  
  socket.onclose = async () => {
    console.log(`WebSocket connection closed: ${connectionId}`);
    await browserPool.releaseBrowser(connectionId);
  };
  
  return response;
} 