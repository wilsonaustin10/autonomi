'use server'

import { chromium } from 'playwright';
import { BrowserPool } from '@/lib/browser-pool';

const browserPool = new BrowserPool();
const SCREENSHOT_QUALITY = 100;
const SCREENSHOT_TYPE = 'jpeg';
const IS_SCREENSHOT_FULL_PAGE = true;
const CLICKABLE_ELEMENTS_SELECTOR = 'a, button, input[type="submit"], [role="button"]';

function formatUrl(input: string): string {
  try {
    new URL(input)
    return input
  } catch {
    try {
      if (input.includes("localhost")) {
        return `http://${input}`
      }
      const urlWithProtocol = `https://${input}`
      new URL(urlWithProtocol)
      return urlWithProtocol
    } catch {
      throw new Error(`Invalid URL: ${input}`)
    }
  }
}

export async function navigateTo(url: string, sessionId: string) {
  try {
    const { page } = await browserPool.getBrowser(sessionId);
    const formattedUrl = formatUrl(url)
    console.log("Navigating to ", formattedUrl)
    await page.goto(formattedUrl);
    const screenshot = await page.screenshot({
      type: SCREENSHOT_TYPE,
      quality: SCREENSHOT_QUALITY,
      fullPage: IS_SCREENSHOT_FULL_PAGE
    });
    const content = await page.content();
    const title = await page.title();

    // Extract clickable elements for mapping
    const clickableElements = await getClickableElements(sessionId);


    // Extract form elements
    const formElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('input:not([type="submit"]), textarea, select');
      return Array.from(elements).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id,
          name: el.getAttribute('name'),
          type: el.getAttribute('type') || 'text',
          placeholder: el.getAttribute('placeholder') || '',
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        };
      });
    });

    return {
      success: true,
      screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
      content,  // Still send content for potential parsing
      url: page.url(),
      title,
      clickableElements,
      formElements
    };
  } catch (error) {
    console.error('Navigation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function performAction(action: string, selector: string, value: string | undefined, sessionId: string) {
  try {
    const { page } = await browserPool.getBrowser(sessionId);

        // Extract clickable elements for mapping
        const clickableElements = await getClickableElements(sessionId)


        // Extract form elements
        const formElements = await getFormElements(sessionId);
    switch (action) {
      case 'click':
        await page.click(selector);
        // Wait for navigation or network idle
        // Use a more flexible waiting approach with timeout
        // Either wait for navigation or timeout after a reasonable period
        await Promise.race([
          page.waitForNavigation({ timeout: 5000 }).catch(() => {}),
          page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {}),
          new Promise(resolve => setTimeout(resolve, 2000)) // Fallback timeout
        ]);
        break;
      case 'fill':
        if (value) await page.fill(selector, value);
        break;
      case 'extract':
        const text = await page.textContent(selector);
        // Take a screenshot after the action
        const screenshot = await page.screenshot({
          type: SCREENSHOT_TYPE,
          quality: SCREENSHOT_QUALITY,
          fullPage: IS_SCREENSHOT_FULL_PAGE
        });

        return {
          success: true,
          screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
          content: await page.content(),
          url: page.url(),
          extractedText: text,
          // Re-extract clickable elements
          clickableElements,
          formElements,
        };
      case 'back':
        await page.goBack();
        break;
      case 'forward':
        await page.goForward();
        break;
      case 'reload':
        await page.reload();
        break;
    }

    // Take a screenshot after the action
    const screenshot = await page.screenshot({
      type: SCREENSHOT_TYPE,
      quality: SCREENSHOT_QUALITY,
      fullPage: IS_SCREENSHOT_FULL_PAGE
    });

    return {
      success: true,
      screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
      content: await page.content(),
      url: page.url(),
      // Re-extract clickable elements
      clickableElements,
      formElements,
    };
  } catch (error) {
    console.error('Action error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// SSE endpoint for browser events
export async function* browserEvents(sessionId: string) {
  try {
    const { page } = await browserPool.getBrowser(sessionId);

    // Set up event listeners on the page
    await page.evaluate(() => {
      // This code runs in the browser
      window.addEventListener('click', (e) => {
        // Report clicks to the server
        console.log('BROWSER_EVENT', JSON.stringify({
          type: 'click',
          target: e.target.outerHTML
        }));
      });
    });

    // Create a stream of console messages
    const events = [];
    page.on('console', msg => {
      if (msg.text().startsWith('BROWSER_EVENT')) {
        events.push(msg.text().substring(14)); // Remove the BROWSER_EVENT prefix
      }
    });

    // Yield events as they come in
    while (true) {
      if (events.length > 0) {
        yield events.shift();
      } else {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    yield JSON.stringify({ error: error.message });
  }
} 

export async function getClickableElements(sessionId: string) {
  const { page } = await browserPool.getBrowser(sessionId);
  const clickableElements = await page.evaluate(() => {
    const elements = document.querySelectorAll('a, button, input[type="submit"], textarea, select, [role="button"]');
    return Array.from(elements).map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        text: el.textContent?.trim() || '',
        href: el.getAttribute('href') || '',
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        index: index + 1, // 1-ased index for nth-of-type css selector
      };
    });
  });
  return clickableElements;
}

export async function getFormElements(sessionId: string) {
  const { page } = await browserPool.getBrowser(sessionId);
  await page.evaluate(() => {
    const elements = document.querySelectorAll('input:not([type="submit"]), textarea, select');
    return Array.from(elements).map(el => {
      const rect = el.getBoundingClientRect();
      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        name: el.getAttribute('name'),
        type: el.getAttribute('type') || 'text',
        placeholder: el.getAttribute('placeholder') || '',
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    });
  });
}