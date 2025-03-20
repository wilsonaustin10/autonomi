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
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined
    });
    const context = await browser.newContext();
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