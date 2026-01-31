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
   * Evaluate JavaScript in the current page via CDP Runtime.evaluate.
   * Runs in the page's main world (same as the browser console),
   * so globals persist and background navigations don't break it.
   */
  async evaluate<T>(expression: string): Promise<T> {
    if (!this.currentPage) {
      throw new Error('No page selected');
    }

    const cdp = await this.getCDPSession();
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description
        ?? result.exceptionDetails.text
        ?? 'Evaluation failed';
      throw new Error(text);
    }

    return result.result.value as T;
  }

  /**
   * Inject a script into the current page by URL.
   * Fetches server-side (Node fetch) to bypass CORS, then injects
   * the content via CDP Runtime.evaluate in the page's main world.
   */
  async injectScript(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    const content = await response.text();
    await this.injectScriptContent(content);
  }

  /**
   * Inject script content directly via CDP evaluation,
   * bypassing CSP restrictions.
   */
  async injectScriptContent(content: string): Promise<void> {
    await this.evaluate(content);
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
