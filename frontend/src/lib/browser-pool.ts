import { chromium, Browser, Page } from 'playwright-core';

// Initialize once and persist between renders
export let browserPool: BrowserPool;

// Track session initialization status and last URLs
const initializedSessions = new Set<string>();
const sessionUrls = new Map<string, string>();

export async function getBrowserPool() {
  if (!browserPool) {
    browserPool = new BrowserPool();
    // Add initialization handling
    await browserPool.init();
  }
  return browserPool;
}

export class BrowserPool {
  private browsers: Map<string, { browser: Browser, page: Page, lastUsed: number, currentUrl?: string }> = new Map();
  private maxInstances: number;
  private initialized: boolean = false;

  constructor(maxInstances = 10) {
    this.maxInstances = maxInstances;
    console.log("Browser pool initialized with max instances:", maxInstances);
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Test browser creation to ensure the environment is properly set up
      const testBrowser = await chromium.launch({
        headless: true,
        args: [
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--disable-features=BlockInsecurePrivateNetworkRequests',
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--window-size=1280,800',
        ]
      });
      await testBrowser.close();
      this.initialized = true;
      console.log("Browser pool successfully initialized");
    } catch (error) {
      console.error("Browser pool initialization failed:", error);
      throw error;
    }
  }

  async getBrowser(id: string): Promise<{ browser: Browser, page: Page }> {
    // Check if browser exists
    const existing = this.browsers.get(id);
    if (existing) {
      console.debug(`Retrieving existing browser for id ${id}`);
      existing.lastUsed = Date.now();
      
      // Check if the page is still usable
      try {
        // Try a simple operation to verify the page is still valid
        await existing.page.evaluate(() => document.title);
        
        // Update the sessionUrls map with the current URL
        try {
          const currentUrl = await existing.page.url();
          sessionUrls.set(id, currentUrl);
          console.log(`Session ${id} is at URL: ${currentUrl}`);
        } catch (e) {
          console.warn(`Could not get URL for session ${id}`);
        }
        
        return { browser: existing.browser, page: existing.page };
      } catch (error) {
        console.warn(`Browser session ${id} is invalid, recreating...`);
        // We'll save the last known URL before removing the browser
        const lastKnownUrl = existing.currentUrl || sessionUrls.get(id);
        if (lastKnownUrl) {
          console.log(`Saving last known URL for session ${id}: ${lastKnownUrl}`);
        }
        
        // Remove the broken browser
        this.browsers.delete(id);
        // Continue to create a new one, and we'll use the saved URL
      }
    }

    // Clean up if needed
    if (this.browsers.size >= this.maxInstances) {
      await this.cleanup(true);
    }

    // Create new browser
    console.log(`Creating new browser instance for session ${id}`);
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-features=BlockInsecurePrivateNetworkRequests',
        '--disable-blink-features=AutomationControlled', // particularly important as it prevents websites from detecting that the browser is being controlled programmatically.
        '--no-sandbox',
        '--window-size=1280,800',
      ]
    });

    // Options are important to bypass security and bot filters
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      hasTouch: false,
      javaScriptEnabled: true,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      geolocation: { longitude: -73.935242, latitude: 40.730610 }, // New York
      permissions: ['geolocation'],
      colorScheme: 'light',
      httpCredentials: undefined,
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();

    // If this session was previously initialized, try to restore the URL
    let restoredUrl = false;
    if (initializedSessions.has(id)) {
      // First check our in-memory session URL map
      const lastSessionUrl = sessionUrls.get(id);
      if (lastSessionUrl && lastSessionUrl !== 'about:blank') {
        console.log(`Restoring session ${id} to URL from session map: ${lastSessionUrl}`);
        try {
          await page.goto(lastSessionUrl, { timeout: 10000 });
          restoredUrl = true;
        } catch (error) {
          console.warn(`Failed to restore session URL from map for ${id}:`, error);
        }
      }
      
      // If not found in map, try localStorage as fallback
      if (!restoredUrl) {
        try {
          const lastUrl = typeof window !== 'undefined' ? 
            window.localStorage.getItem('lastBrowserUrl') : null;
            
          if (lastUrl && lastUrl !== 'about:blank') {
            console.log(`Restoring session ${id} to URL from localStorage: ${lastUrl}`);
            await page.goto(lastUrl, { timeout: 10000 });
            restoredUrl = true;
          }
        } catch (error) {
          console.warn(`Failed to restore session URL from localStorage for ${id}:`, error);
        }
      }
    } else {
      // Mark this session as initialized for future reference
      initializedSessions.add(id);
    }
    
    // If we couldn't restore a URL and no URL is set, use about:blank
    if (!restoredUrl) {
      console.log(`No previous URL found for session ${id}, starting fresh`);
    }

    // Create the browser instance and store its initial state
    const browserState: { browser: Browser, page: Page, lastUsed: number, currentUrl?: string } = { 
      browser, 
      page, 
      lastUsed: Date.now() 
    };
    
    // Store the initial URL
    try {
      const currentUrl = await page.url();
      browserState.currentUrl = currentUrl;
      sessionUrls.set(id, currentUrl);
    } catch (error) {
      console.warn(`Failed to get initial URL for session ${id}:`, error);
    }
    
    this.browsers.set(id, browserState);
    return { browser, page };
  }

  async releaseBrowser(id: string) {
    const instance = this.browsers.get(id);
    if (instance) {
      try {
        // Save the current URL before closing
        try {
          const currentUrl = await instance.page.url();
          sessionUrls.set(id, currentUrl);
        } catch (e) {
          console.warn(`Could not save URL before releasing browser ${id}`);
        }
        
        await instance.browser.close();
      } catch (error) {
        console.warn(`Error closing browser ${id}:`, error);
      }
      this.browsers.delete(id);
    }
  }

  async updateBrowserState(id: string, page: Page): Promise<void> {
    const existing = this.browsers.get(id);
    if (existing) {
      existing.lastUsed = Date.now();
      existing.page = page;
      
      // Store current URL in both the browser instance and our session map
      try {
        const currentUrl = await page.url();
        existing.currentUrl = currentUrl;
        sessionUrls.set(id, currentUrl);
        
        // Update localStorage if we're in a browser environment
        if (typeof window !== 'undefined' && currentUrl && currentUrl !== 'about:blank') {
          window.localStorage.setItem('lastBrowserUrl', currentUrl);
          console.log(`Stored URL in localStorage: ${currentUrl}`);
        }
      } catch (error) {
        console.warn(`Failed to update URL for session ${id}:`, error);
      }
      
      this.browsers.set(id, existing);
    }
  }

  private async cleanup(force = false) {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [id, { browser, lastUsed }] of this.browsers.entries()) {
      if (force || now - lastUsed > maxAge) {
        try {
          await browser.close();
        } catch (error) {
          console.warn(`Error closing browser during cleanup:`, error);
        }
        this.browsers.delete(id);
        if (!force) break;
      }
    }
  }
} 