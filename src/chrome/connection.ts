/**
 * Chrome DevTools Protocol connection via Playwright
 */

import { chromium, Browser, BrowserContext, Page, CDPSession } from 'playwright-core';

export interface ChromeTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export interface ConnectionOptions {
  host: string;
  port: number;
}

export class ChromeConnection {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private currentPage: Page | null = null;
  private cdpSession: CDPSession | null = null;

  constructor(private options: ConnectionOptions) {}

  get endpoint(): string {
    return `http://${this.options.host}:${this.options.port}`;
  }

  get wsEndpoint(): string {
    return `ws://${this.options.host}:${this.options.port}`;
  }

  /**
   * Check if Chrome is running on the configured port
   */
  async isRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/json/version`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get Chrome version info
   */
  async getVersion(): Promise<Record<string, string> | null> {
    try {
      const response = await fetch(`${this.endpoint}/json/version`);
      if (!response.ok) return null;
      return (await response.json()) as Record<string, string>;
    } catch {
      return null;
    }
  }

  /**
   * List all available targets (tabs)
   */
  async listTargets(): Promise<ChromeTarget[]> {
    try {
      const response = await fetch(`${this.endpoint}/json/list`);
      if (!response.ok) return [];
      return (await response.json()) as ChromeTarget[];
    } catch {
      return [];
    }
  }

  /**
   * Connect to Chrome using Playwright CDP
   */
  async connect(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.connectOverCDP(this.endpoint);
    const contexts = this.browser.contexts();

    if (contexts.length > 0) {
      this.context = contexts[0];
      const pages = this.context.pages();
      if (pages.length > 0) {
        this.currentPage = pages[0];
      }
    }
  }

  /**
   * Disconnect from Chrome (does not close the browser)
   */
  async disconnect(): Promise<void> {
    if (this.cdpSession) {
      await this.cdpSession.detach();
      this.cdpSession = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.currentPage = null;
    }
  }

  /**
   * Get list of pages (tabs)
   */
  async getPages(): Promise<Page[]> {
    if (!this.context) return [];
    return this.context.pages();
  }

  /**
   * Get current page
   */
  getCurrentPage(): Page | null {
    return this.currentPage;
  }

  /**
   * Select a page by URL pattern
   */
  async selectPage(urlPattern: string): Promise<Page | null> {
    const pages = await this.getPages();
    const pattern = urlPattern.toLowerCase();

    const page = pages.find((p) => p.url().toLowerCase().includes(pattern));

    if (page) {
      this.currentPage = page;
      return page;
    }

    return null;
  }

  /**
   * Select a page by index
   */
  async selectPageByIndex(index: number): Promise<Page | null> {
    const pages = await this.getPages();

    if (index >= 0 && index < pages.length) {
      this.currentPage = pages[index];
      return this.currentPage;
    }

    return null;
  }

  /**
   * Open a new page with the given URL
   */
  async openPage(url: string): Promise<Page> {
    if (!this.context) {
      throw new Error('Not connected to Chrome');
    }

    const page = await this.context.newPage();
    await page.goto(url);
    this.currentPage = page;
    return page;
  }

  /**
   * Evaluate JavaScript in the current page
   */
  async evaluate<T>(expression: string): Promise<T> {
    if (!this.currentPage) {
      throw new Error('No page selected');
    }

    // Use evaluate for function expressions, evaluateHandle for raw expressions
    // Wrap in an IIFE to handle both expressions and statements
    const wrappedExpression = `
      (async () => {
        try {
          return await eval(${JSON.stringify(expression)});
        } catch (e) {
          throw e;
        }
      })()
    `;

    return await this.currentPage.evaluate(wrappedExpression) as T;
  }

  /**
   * Inject a script into the current page by URL.
   * Fetches inside the browser via CDP evaluation, then executes
   * with indirect eval to place globals in the page's main world.
   */
  async injectScript(url: string): Promise<void> {
    if (!this.currentPage) {
      throw new Error('No page selected');
    }

    const expression = `
      fetch(${JSON.stringify(url)})
        .then(r => {
          if (!r.ok) throw new Error('Failed to fetch ' + ${JSON.stringify(url)} + ': ' + r.status);
          return r.text();
        })
        .then(t => {
          (0, eval)(t);
        })
    `;
    await this.evaluateInMainWorld(expression);
  }

  /**
   * Inject script content directly via CDP evaluation,
   * bypassing CSP restrictions.
   */
  async injectScriptContent(content: string): Promise<void> {
    if (!this.currentPage) {
      throw new Error('No page selected');
    }

    await this.evaluateInMainWorld(content);
  }

  /**
   * Evaluate JavaScript in the page's main world via CDP Runtime.evaluate.
   * Unlike Playwright's page.evaluate(), this shares the page's global scope,
   * so assignments to window.* are visible to subsequent page scripts.
   */
  private async evaluateInMainWorld(expression: string): Promise<void> {
    const cdp = await this.getCDPSession();
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: false,
      awaitPromise: true,
    });

    if (result.exceptionDetails) {
      const text = result.exceptionDetails.text
        ?? result.exceptionDetails.exception?.description
        ?? 'Script evaluation failed';
      throw new Error(text);
    }
  }

  /**
   * Reload the current page
   */
  async reload(): Promise<void> {
    if (!this.currentPage) {
      throw new Error('No page selected');
    }

    await this.currentPage.reload();
  }

  /**
   * Get CDP session for advanced operations
   */
  async getCDPSession(): Promise<CDPSession> {
    if (!this.currentPage) {
      throw new Error('No page selected');
    }

    if (!this.cdpSession) {
      this.cdpSession = await this.currentPage.context().newCDPSession(this.currentPage);
    }

    return this.cdpSession;
  }
}

/**
 * Create a connection with default or provided options
 */
export function createConnection(options: Partial<ConnectionOptions> = {}): ChromeConnection {
  return new ChromeConnection({
    host: options.host ?? 'localhost',
    port: options.port ?? 9222,
  });
}
