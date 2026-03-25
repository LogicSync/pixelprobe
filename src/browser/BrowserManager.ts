import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { Breakpoint } from "../types/config.js";

export interface BrowserManagerOptions {
  headless?: boolean;
  timeout?: number;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private options: Required<BrowserManagerOptions>;

  constructor(options: BrowserManagerOptions = {}) {
    this.options = {
      headless: options.headless ?? true,
      timeout: options.timeout ?? 30000,
    };
  }

  async launch(): Promise<void> {
    if (this.browser) return;
    this.browser = await chromium.launch({
      headless: this.options.headless,
    });
  }

  async createPage(breakpoint: Breakpoint): Promise<Page> {
    if (!this.browser) {
      await this.launch();
    }

    const context: BrowserContext = await this.browser!.newContext({
      viewport: {
        width: breakpoint.width,
        height: breakpoint.height,
      },
      deviceScaleFactor: 1,
    });

    context.setDefaultTimeout(this.options.timeout);

    const page = await context.newPage();
    return page;
  }

  async navigateAndWait(
    page: Page,
    url: string,
    options: {
      waitForSelector?: string;
      waitForTimeout?: number;
    } = {}
  ): Promise<void> {
    // Use domcontentloaded first (fast), then wait for selector/timeout
    // "networkidle" is unreliable on sites with analytics, chat widgets, etc.
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: this.options.timeout,
    });

    // Wait for the target selector to appear in the DOM
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: this.options.timeout,
      });
    }

    // Let remaining assets (fonts, images, lazy-loaded CSS) settle.
    // Default 1s even if no explicit wait was requested, to avoid
    // capturing half-rendered pages.
    const settleTime = options.waitForTimeout && options.waitForTimeout > 0
      ? options.waitForTimeout
      : 1000;
    await page.waitForTimeout(settleTime);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  get isLaunched(): boolean {
    return this.browser !== null;
  }
}
