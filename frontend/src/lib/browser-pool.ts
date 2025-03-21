import { chromium, Browser, Page } from 'playwright-core';

export class BrowserPool {
  private browsers: Map<string, { browser: Browser, page: Page, lastUsed: number }> = new Map();
  private maxInstances: number;

  constructor(maxInstances = 10) {
    this.maxInstances = maxInstances;
  }

  async getBrowser(id: string): Promise<{ browser: Browser, page: Page }> {
    // Check if browser exists
    const existing = this.browsers.get(id);
    if (existing) {
      console.debug(`Retrieving existing browser for id ${id}`)
      existing.lastUsed = Date.now();
      return { browser: existing.browser, page: existing.page };
    }

    // Clean up if needed
    if (this.browsers.size >= this.maxInstances) {
      await this.cleanup(true);
    }

    // Create new browser
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

    // Options are important o bypass security and bot filters
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

    this.browsers.set(id, { browser, page, lastUsed: Date.now() });
    return { browser, page };
  }

  async releaseBrowser(id: string) {
    const instance = this.browsers.get(id);
    if (instance) {
      await instance.browser.close();
      this.browsers.delete(id);
    }
  }

  async updateBrowserState(id: string, page: Page): Promise<void> {
    const existing = this.browsers.get(id);
    if (existing) {
      existing.lastUsed = Date.now();
      existing.page = page;
      this.browsers.set(id, existing);
    }
  }

  private async cleanup(force = false) {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [id, { browser, lastUsed }] of this.browsers.entries()) {
      if (force || now - lastUsed > maxAge) {
        await browser.close();
        this.browsers.delete(id);
        if (!force) break;
      }
    }
  }
} 