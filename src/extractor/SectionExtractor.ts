import type { Page } from "playwright";
import type { ElementInfo, BoundingBox } from "../types/comparison.js";

export class SectionExtractor {
  /**
   * Find all elements matching a selector and return their info.
   * Used for disambiguation when multiple elements match.
   */
  static async enumerate(
    page: Page,
    selector: string
  ): Promise<ElementInfo[]> {
    return await page.evaluate(
      ({ sel }) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).map((el, index) => {
          const rect = el.getBoundingClientRect();
          const text = (el.textContent || "").trim().slice(0, 80);
          return {
            selector: sel,
            index,
            tagName: el.tagName.toLowerCase(),
            textPreview: text.length === 80 ? text + "…" : text,
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            exists: true,
          };
        });
      },
      { sel: selector }
    );
  }

  /**
   * Get a specific element by selector and index.
   * Returns the Playwright ElementHandle locator for further operations.
   */
  static async getElement(
    page: Page,
    selector: string,
    index: number = 0
  ): Promise<{ info: ElementInfo; locator: ReturnType<Page["locator"]> }> {
    const locator = page.locator(selector).nth(index);

    const count = await page.locator(selector).count();
    if (count === 0) {
      return {
        info: {
          selector,
          index,
          tagName: "unknown",
          textPreview: "",
          boundingBox: { x: 0, y: 0, width: 0, height: 0 },
          exists: false,
        },
        locator,
      };
    }

    if (index >= count) {
      throw new Error(
        `Element index ${index} out of range. Selector "${selector}" matched ${count} element(s).`
      );
    }

    const info = await locator.evaluate((el, idx) => {
      const rect = el.getBoundingClientRect();
      const text = (el.textContent || "").trim().slice(0, 80);
      return {
        selector: "", // filled below
        index: idx,
        tagName: el.tagName.toLowerCase(),
        textPreview: text.length === 80 ? text + "…" : text,
        boundingBox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        exists: true,
      };
    }, index);

    info.selector = selector;

    return { info, locator };
  }

  /**
   * Validate that a selector matches at least one element.
   */
  static async validate(
    page: Page,
    selector: string
  ): Promise<{ valid: boolean; count: number; error?: string }> {
    try {
      const count = await page.locator(selector).count();
      return {
        valid: count > 0,
        count,
        error: count === 0 ? `No elements found matching "${selector}"` : undefined,
      };
    } catch (err) {
      return {
        valid: false,
        count: 0,
        error: `Invalid selector "${selector}": ${(err as Error).message}`,
      };
    }
  }
}
