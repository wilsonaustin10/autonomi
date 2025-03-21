'use server'

import { chromium, Page } from 'playwright';
import { BrowserPool } from '@/lib/browser-pool';
import { DEFAULT_FALLBACK_TIMEOUT, DEFAULT_NETWORK_IDLE_TIMEOUT, defaultLogPrefix } from './constants';

const browserPool = new BrowserPool();
const SCREENSHOT_QUALITY = 100;
const SCREENSHOT_TYPE = 'jpeg';
const IS_SCREENSHOT_FULL_PAGE = true;

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
    console.debug(`${sessionId}: Navigating to ${formattedUrl}`)
    await page.goto(formattedUrl, {
      waitUntil: "domcontentloaded"
    });
    await browserPool.updateBrowserState(sessionId, page);

    await waitForPageStability(page, {
      logPrefix: `${sessionId}`
    })

    const screenshot = await page.screenshot({
      type: SCREENSHOT_TYPE,
      quality: SCREENSHOT_QUALITY,
      fullPage: IS_SCREENSHOT_FULL_PAGE
    });
    const content = await safeGetPageContent(page, `${sessionId}`)
    const title = await page.title();

    // Extract form elements
    const formElements = getFormElements(sessionId);

    const historyState = await getBrowserHistory(page);

    return {
      success: true,
      screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
      content,  // Still send content for potential parsing
      url: page.url(),
      title,
      formElements,
      historyState
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

    // Extract form elements
    const formElements = await getFormElements(sessionId);
    console.debug(`${sessionId}: Performing: ${action}`)

    switch (action) {
      case 'mouseClick':
        if (value) {
          const [x, y] = value.split(",").map(Number);
          console.log(`Attempting mouse click event on x-y coordinates (${x}, ${y})`)
          if (!isNaN(x) && !isNaN(y)) {
            await page.mouse.move(x, y)
            await page.mouse.click(x, y)

            await waitForPageStability(page, { logPrefix: `${sessionId}`});
          }
        }
        break;
      case 'click':
        await page.click(selector);
        // Wait for navigation or network idle
        // Use a more flexible waiting approach with timeout
        // Either wait for navigation or timeout after a reasonable period
        await waitForPageStability(page, { logPrefix: `${sessionId}`});
        break;
      case 'fill':
        if (value) {
          await page.fill(selector, value);
          await waitForPageStability(page, { logPrefix: `${sessionId}`});
        }
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
          formElements,
        };
      case 'back':
        await page.goBack();

        await waitForPageStability(page, { logPrefix: `${sessionId}`});
        break;
      case 'forward':
        await page.goForward();
        await waitForPageStability(page, { logPrefix: `${sessionId}`});
        break;
      case 'reload':
        await page.reload();
        await waitForPageStability(page, { logPrefix: `${sessionId}`});
        break;

      case 'refresh':
        // This is just a screenshot refresh without any page action
        // No need to do anything here, we'll just take a new screenshot below
        await waitForPageStability(page, { logPrefix: `${sessionId}`});
        break;

    }

    // Take a screenshot after the action
    const screenshot = await page.screenshot({
      type: SCREENSHOT_TYPE,
      quality: SCREENSHOT_QUALITY,
      fullPage: IS_SCREENSHOT_FULL_PAGE
    });

    const historyState = await getBrowserHistory(page);

    return {
      success: true,
      screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
      content: await page.content(),
      url: page.url(),
      formElements,
      historyState
    };
  } catch (error) {
    console.error('Action error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// TODO: Potentially unused
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

// TODO: Deprecate this
// export async function getClickableElements(sessionId: string) {
//   const { page } = await browserPool.getBrowser(sessionId);
//   const clickableElements = await page.evaluate(() => {
//     const elements = document.querySelectorAll('a, button, input, textarea, select, [role="button"]');
//     return Array.from(elements).map((el, index) => {
//       const rect = el.getBoundingClientRect();
//       return {
//         tagName: el.tagName.toLowerCase(),
//         id: el.id,
//         text: el.textContent?.trim() || '',
//         href: el.getAttribute('href') || '',
//         x: rect.left,
//         y: rect.top,
//         width: rect.width,
//         height: rect.height,
//         index: index + 1, // 1-ased index for nth-of-type css selector
//       };
//     });
//   });
//   return clickableElements;
// }

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

async function getBrowserHistory(page: Page) {
  console.log("GEtting browser history...start")
  return page.evaluate(() => {
    // Try to get the current index from history.state if available
    let currentIndex = 0;

    // Modern browsers often store the index in history.state
    if (window.history.state && window.history.state.idx !== undefined) {
      currentIndex = window.history.state.idx;
    }

    // Calculate if we can go forward or back based on index and length
    const historyLength = window.history.length;
    console.log("history state", window.history.state)
    const canGoBack = currentIndex > 0;
    const canGoForward = currentIndex < historyLength - 1;

    return {
      canGoBack,
      canGoForward,
      currentIndex,
      length: historyLength
    };
  });
}



type PageStabilityOptions = {
  networkIdleTimeout: number;
  fallbackTimeout: number;
  logPrefix: string;
}

async function waitForPageStability(page: Page, options: PageStabilityOptions) {
  const defaults: PageStabilityOptions = {
    networkIdleTimeout: DEFAULT_NETWORK_IDLE_TIMEOUT,
    fallbackTimeout: DEFAULT_FALLBACK_TIMEOUT,
    logPrefix: ''
  }
  const settings = {
    ...defaults,
    ...options
  }

  try {
    // Wait for network idle with a timeout
    await page.waitForLoadState('networkidle', { timeout: settings.networkIdleTimeout });
  } catch (error) {
    console.warn(`${settings.logPrefix}: Network didn't reach idle state, continuing anyway`);
  }

  // Ensure we don't wait indefinitely
  await new Promise(resolve => setTimeout(resolve, 100));

}


// New utility function to safely get page content
async function safeGetPageContent(page: Page, logPrefix = '') {
  try {
    return await page.content();
  } catch (error) {
    console.warn(`${logPrefix}: Could not get page content: ${error.message}`);
    return '';
  }
}