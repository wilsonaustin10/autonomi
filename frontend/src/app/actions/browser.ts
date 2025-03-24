'use server'

import { chromium, Page } from 'playwright';
import { BrowserPool, getBrowserPool } from '@/lib/browser-pool';
import { DEFAULT_FALLBACK_TIMEOUT, DEFAULT_NETWORK_IDLE_TIMEOUT, defaultLogPrefix } from './constants';
import { formatUrl } from '@/lib/utils';
import { getBrowserHistory } from './browser-history';
import { BrowserActions } from '../api/computer-use/actions';
import { PageInfo } from '@/types/prompts';
import { extractInteractiveElements } from '../api/processing/getProcessedText';

const SCREENSHOT_QUALITY = 100;
const SCREENSHOT_TYPE = 'jpeg';
const IS_SCREENSHOT_FULL_PAGE = false;
const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;

type ActionResult = PageInfo & {
  success: boolean;
  error?: string;
  isLoginPage?: boolean;
}

// Login form detection function
async function detectLoginForm(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      // Look for password fields
      const hasPasswordField = document.querySelector('input[type="password"]') !== null;
      
      // Look for common login form indicators
      const loginKeywords = ['login', 'sign in', 'log in', 'signin', 'username', 'password', 'email']
      const pageText = document.body.innerText.toLowerCase();
      const hasLoginKeywords = loginKeywords.some(keyword => pageText.includes(keyword));
      
      // Check for forms with common login-related attributes
      const forms = Array.from(document.forms);
      const hasLoginForm = forms.some(form => {
        const formId = (form.id || '').toLowerCase();
        const formClass = (form.className || '').toLowerCase();
        const formAction = (form.action || '').toLowerCase();
        
        return formId.includes('login') || 
               formClass.includes('login') || 
               formAction.includes('login') ||
               formAction.includes('signin') ||
               formAction.includes('auth');
      });
      
      return hasPasswordField && (hasLoginKeywords || hasLoginForm);
    });
  } catch (error) {
    console.error('Error detecting login form:', error);
    return false;
  }
}

export async function navigateTo(url: string, sessionId: string): Promise<ActionResult> {
  try {
    const browserPool = await getBrowserPool();
    const { page } = await browserPool.getBrowser(sessionId);
    
    // Set viewport size
    await page.setViewportSize({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
    
    const formattedUrl = formatUrl(url)
    console.debug(`${sessionId}: Navigating to ${formattedUrl}`)
    await page.goto(formattedUrl, {
      waitUntil: "load"
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
    const {formElements, clickableElements} = await extractInteractiveElements(content);

    const historyState = await getBrowserHistory(page);
    
    // Detect if this is a login page
    const isLoginPage = await detectLoginForm(page);
    console.log(`${sessionId}: Login page detected: ${isLoginPage}`);

    return {
      success: true,
      screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
      content,  // Still send content for potential parsing
      url: page.url(),
      title,
      formElements,
      clickableElements,
      historyState,
      isLoginPage
    };
  } catch (error: any) {
    console.error('Navigation error:', error);
    return {
      success: false,
      error: error.message,
      url: '',
      title: '',
      content: '',
      formElements: [],
      clickableElements: [],
      historyState: { canGoBack: false, canGoForward: false, currentIndex: 0, length: 0 }
    };
  }
}

export async function performAction(action: string, selector: string, value: string | undefined, sessionId: string): Promise<ActionResult> {
  try {
    const browserPool = await getBrowserPool();
    const { page } = await browserPool.getBrowser(sessionId);
    const title = await page.title();
    const content = await safeGetPageContent(page, `${sessionId}`)

    // Extract form elements
    const {formElements, clickableElements} = await extractInteractiveElements(content);

    console.debug(`${sessionId}: Performing: ${action}`)

    switch (action) {
      case BrowserActions.MOUSE_CLICK:
        if (value) {
          const [x, y] = value.split(",").map(Number);
          console.debug(`Attempting mouse click event on x-y coordinates (${x}, ${y})`)
          if (!isNaN(x) && !isNaN(y)) {
            await page.mouse.move(x, y)
            await page.mouse.click(x, y)

            await waitForPageStability(page, { logPrefix: `${sessionId}` });
          }
        }
        break;
      case BrowserActions.CLICK_ELEMENT:
        await page.click(selector);
        // Wait for navigation or network idle
        // Use a more flexible waiting approach with timeout
        // Either wait for navigation or timeout after a reasonable period
        await waitForPageStability(page, { logPrefix: `${sessionId}` });
        break;
      case BrowserActions.FILL_INPUT:
        if (value) {
          console.log(`Filling input with selector "${selector}" with value "${value}"`);
          try {
            // First try to find the element
            const element = await page.$(selector);
            if (!element) {
              console.error(`Element with selector "${selector}" not found`);
              // Try to find elements that might match
              const allInputs = await page.$$('input, textarea, [contenteditable="true"]');
              console.log(`Found ${allInputs.length} input elements on the page`);
              
              // Element not found, throwing error
              throw new Error(`Element with selector "${selector}" not found`);
            }
            
            // Clear the input first
            await page.evaluate((sel) => {
              const el = document.querySelector(sel);
              if (el) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                  (el as HTMLInputElement).value = '';
                } else if (el.getAttribute('contenteditable') === 'true') {
                  el.textContent = '';
                }
              }
            }, selector);
            
            // Now fill it
            await page.fill(selector, value);
            console.log(`Successfully filled input with selector "${selector}"`);
          } catch (error: any) {
            console.error(`Error filling input: ${error.message}`);
            throw error;
          }
          await waitForPageStability(page, { logPrefix: `${sessionId}` });
        }
        break;
      case BrowserActions.PRESS:
        if (value) {
          if (selector) {
            await page.focus(selector)
          }
          await page.keyboard.press(value)  
          await waitForPageStability(page, { logPrefix: `${sessionId}` });
        }
        break;
      case BrowserActions.EXTRACT:
        const text = await page.textContent(selector);
        // Take a screenshot after the action
        const screenshot = await page.screenshot({
          type: SCREENSHOT_TYPE,
          quality: SCREENSHOT_QUALITY,
          fullPage: IS_SCREENSHOT_FULL_PAGE
        });
        const historyState = await getBrowserHistory(page);
        return {
          success: true,
          title,
          content: content,
          screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
          url: page.url(),
          // Re-extract clickable elements
          formElements,
          clickableElements,
          historyState
        };
      case BrowserActions.BACK:
        await page.goBack();

        await waitForPageStability(page, { logPrefix: `${sessionId}` });
        break;
      case BrowserActions.FORWARD:
        await page.goForward();
        await waitForPageStability(page, { logPrefix: `${sessionId}` });
        break;
      case BrowserActions.RELOAD:
        await page.reload();
        await waitForPageStability(page, { logPrefix: `${sessionId}` });
        break;

      case BrowserActions.REFRESH:
        // This is just a screenshot refresh without any page action
        // No need to do anything here, we'll just take a new screenshot below
        await waitForPageStability(page, { logPrefix: `${sessionId}` });
        break;

      case BrowserActions.FILL_LOGIN:
        if (value) {
          try {
            const credentials = JSON.parse(value);
            const { username, password } = credentials;
            
            // Find username/email field
            console.log(`${sessionId}: Filling login form with credentials`);
            
            // First try to identify username field
            const usernameFieldSelector = await page.evaluate(() => {
              // Common selectors for username/email fields
              const selectors = [
                'input[type="email"]',
                'input[name="email"]',
                'input[id*="email"]',
                'input[name="username"]',
                'input[id*="username"]',
                'input[autocomplete="username"]',
                'input:not([type="password"]):not([type="checkbox"]):not([type="hidden"]):not([type="submit"])'
              ];
              
              for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                  // Skip hidden fields
                  if ((el as HTMLElement).offsetParent === null) continue;
                  return selector;
                }
              }
              
              return null;
            });
            
            // Find password field
            const passwordFieldSelector = await page.evaluate(() => {
              const passwordField = document.querySelector('input[type="password"]');
              return passwordField ? 'input[type="password"]' : null;
            });
            
            if (usernameFieldSelector) {
              await page.fill(usernameFieldSelector, username);
              console.log(`${sessionId}: Filled username field`);
            } else {
              console.log(`${sessionId}: No username field found`);
            }
            
            if (passwordFieldSelector) {
              await page.fill(passwordFieldSelector, password);
              console.log(`${sessionId}: Filled password field`);
            } else {
              console.log(`${sessionId}: No password field found`);
            }
            
            // Try to find and click the submit button
            const submitButtonClicked = await page.evaluate(() => {
              // Common selectors for login buttons
              const buttonSelectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button[id*="login"]',
                'button[id*="signin"]',
                'button[class*="login"]',
                'button[class*="signin"]',
                'a[id*="login"]',
                'a[class*="login"]'
              ];
              
              for (const selector of buttonSelectors) {
                const buttons = document.querySelectorAll(selector);
                for (const button of buttons) {
                  if ((button as HTMLElement).offsetParent !== null) {
                    (button as HTMLElement).click();
                    return true;
                  }
                }
              }
              
              return false;
            });
            
            if (submitButtonClicked) {
              console.log(`${sessionId}: Clicked login submit button`);
            } else {
              // If no button found, try pressing Enter
              await page.keyboard.press('Enter');
              console.log(`${sessionId}: Pressed Enter to submit login form`);
            }
            
            // Use auth flow stability check for login pages
            await waitForPageStability(page, { 
              logPrefix: `${sessionId}`,
              isAuthFlow: true
            });
            
            // Additional wait for auth flows like LinkedIn
            console.log(`${sessionId}: Waiting additional time for authentication flow...`);
            await new Promise(resolve => setTimeout(resolve, 1500));
            
          } catch (error) {
            console.error(`Error filling login form: ${error}`);
          }
        }
        break;
    }

    // Take a screenshot after the action
    const screenshot = await page.screenshot({
      type: SCREENSHOT_TYPE,
      quality: SCREENSHOT_QUALITY,
      fullPage: IS_SCREENSHOT_FULL_PAGE
    });

    const historyState = await getBrowserHistory(page);
    
    // Check if it's a login page
    const isLoginPage = await detectLoginForm(page);

    return {
      success: true,
      title: title,
      screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
      content: content,
      url: page.url(),
      formElements,
      clickableElements,
      historyState,
      isLoginPage
    };
  } catch (error: any) {
    console.error('Action error:', error);
    return {
      success: false,
      error: error.message,
      url: '',
      title: '',
      content: '',
      formElements: [],
      clickableElements: [],
      historyState: { canGoBack: false, canGoForward: false, currentIndex: 0, length: 0 }
    };
  }
}


type PageStabilityOptions = {
  networkIdleTimeout?: number;
  fallbackTimeout?: number;
  logPrefix?: string;
  isAuthFlow?: boolean;
}

async function waitForPageStability(page: Page, options: PageStabilityOptions) {
  const defaults: PageStabilityOptions = {
    networkIdleTimeout: DEFAULT_NETWORK_IDLE_TIMEOUT,
    fallbackTimeout: DEFAULT_FALLBACK_TIMEOUT,
    logPrefix: '',
    isAuthFlow: false
  }
  const settings = {
    ...defaults,
    ...options
  }

  const logPrefix = settings.logPrefix || defaultLogPrefix;
  
  // For auth flows, use a different strategy with shorter timeouts
  if (settings.isAuthFlow) {
    console.log(`${logPrefix}: Using auth flow stability strategy`);
    
    // First wait a short time for initial redirect
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // Wait for navigation with a shorter timeout
      await page.waitForLoadState('domcontentloaded', { 
        timeout: Math.min((settings.networkIdleTimeout || 5000) / 2, 5000) 
      });
    } catch (error) {
      console.warn(`${logPrefix}: DOM content not fully loaded during auth, continuing anyway`);
    }
    
    // Take a screenshot regardless to update the UI
    return;
  }

  // Standard page stability check
  try {
    // First wait for DOM content to be ready
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    } catch (err) {
      console.warn(`${logPrefix}: DOM content not loaded, continuing anyway`);
    }
    
    // Then try to wait for network idle with a timeout
    try {
      await page.waitForLoadState('networkidle', { timeout: settings.networkIdleTimeout });
    } catch (error) {
      console.warn(`${logPrefix}: Network didn't reach idle state, continuing anyway`);
      
      // If network idle timed out, use a fallback timeout
      await new Promise(resolve => setTimeout(resolve, Math.min(1000, settings.fallbackTimeout || 1000)));
    }
  } catch (error) {
    console.warn(`${logPrefix}: Error during page stability check: ${error}`);
    // Ensure we don't wait indefinitely - use fallback timeout
    await new Promise(resolve => setTimeout(resolve, Math.min(1000, settings.fallbackTimeout || 1000)));
  }
}


// New utility function to safely get page content
async function safeGetPageContent(page: Page, logPrefix = '') {
  try {
    return await page.content();
  } catch (error: any) {
    console.warn(`${logPrefix}: Could not get page content: ${error.message}`);
    return '';
  }
}