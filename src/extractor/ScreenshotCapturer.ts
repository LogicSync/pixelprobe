import type { Locator, Page } from "playwright";

export interface ScreenshotOptions {
  fullPage?: boolean;
  padding?: number;
}

export class ScreenshotCapturer {
  /**
   * Capture a screenshot of a specific element.
   */
  static async captureElement(
    locator: Locator,
    options: ScreenshotOptions = {}
  ): Promise<Buffer> {
    // Scroll element into view first
    await locator.scrollIntoViewIfNeeded();

    // Small wait to ensure rendering is complete
    await locator.page().waitForTimeout(100);

    const screenshot = await locator.screenshot({
      type: "png",
      animations: "disabled",
    });

    return Buffer.from(screenshot);
  }

  /**
   * Capture a screenshot of the full page.
   */
  static async captureFullPage(page: Page): Promise<Buffer> {
    const screenshot = await page.screenshot({
      type: "png",
      fullPage: true,
      animations: "disabled",
    });

    return Buffer.from(screenshot);
  }

  /**
   * Capture element with surrounding context (padding around it).
   */
  static async captureElementWithContext(
    locator: Locator,
    padding: number = 20
  ): Promise<Buffer> {
    await locator.scrollIntoViewIfNeeded();
    await locator.page().waitForTimeout(100);

    const box = await locator.boundingBox();
    if (!box) {
      throw new Error("Element has no bounding box (may be hidden)");
    }

    const page = locator.page();
    const viewport = page.viewportSize();
    if (!viewport) {
      throw new Error("Page has no viewport size");
    }

    const clip = {
      x: Math.max(0, box.x - padding),
      y: Math.max(0, box.y - padding),
      width: Math.min(viewport.width - Math.max(0, box.x - padding), box.width + padding * 2),
      height: box.height + padding * 2,
    };

    const screenshot = await page.screenshot({
      type: "png",
      clip,
      animations: "disabled",
    });

    return Buffer.from(screenshot);
  }
}
