'use server';
import { BrowserHistoryState } from '@/types/common';
import { Page } from 'playwright-core';

// TODO: Re-implement browser history to manually track history state and index even after
export async function getBrowserHistory(page: Page): Promise<BrowserHistoryState> {
  console.log("Getting browser history...start");
  if (!page || page.isClosed()) {
    console.warn("Page is not available for evaluation");
    return { canGoBack: false, canGoForward: false, currentIndex: 0, length: 0 };
  }

  try {

    // Log all console messages that were made in the page.evaluate function. This is because console.logs don't appear in OUR browser console when wrapped in such functions
    page.on('console', msg => {
      console.log(`BROWSER CONSOLE: ${msg.text()}`);
    });
    return await page.evaluate(() => {
      // Try to get the current index from history.state if available
      let currentIndex = 0;


      // Calculate if we can go forward or back based on index and length
      const historyLength = window.history.length;
      const canGoBack = currentIndex > 0;
      const canGoForward = currentIndex < historyLength - 1;

      return {
        canGoBack,
        canGoForward,
        currentIndex,
        length: historyLength
      };
    });
  } catch (error) {
    console.error(`Failed to evaluate browser history:`, error);
    return { canGoBack: false, canGoForward: false, currentIndex: 0, length: 0 };
  }

}
