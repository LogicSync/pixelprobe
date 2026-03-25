import type { Page, Locator } from "playwright";
import { STYLE_CATEGORIES, type StyleCategory } from "../types/config.js";
import type { LayoutMetrics, BoxSpacing } from "../types/comparison.js";

export class StyleExtractor {
  /**
   * Extract computed styles for specific categories from an element.
   */
  static async extractStyles(
    locator: Locator,
    categories?: StyleCategory[]
  ): Promise<Record<string, string>> {
    const propertiesToExtract = StyleExtractor.getProperties(categories);

    return await locator.evaluate((el, props) => {
      const computed = window.getComputedStyle(el);
      const styles: Record<string, string> = {};

      for (const prop of props) {
        const value = computed.getPropertyValue(prop);
        if (value) {
          styles[prop] = value;
        }
      }

      return styles;
    }, propertiesToExtract);
  }

  /**
   * Extract layout metrics (box model) from an element.
   */
  static async extractLayoutMetrics(
    locator: Locator
  ): Promise<LayoutMetrics> {
    return await locator.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);

      const parseNum = (val: string) => parseFloat(val) || 0;

      return {
        boundingBox: {
          x: Math.round(rect.x * 100) / 100,
          y: Math.round(rect.y * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        },
        margin: {
          top: parseNum(computed.marginTop),
          right: parseNum(computed.marginRight),
          bottom: parseNum(computed.marginBottom),
          left: parseNum(computed.marginLeft),
        },
        padding: {
          top: parseNum(computed.paddingTop),
          right: parseNum(computed.paddingRight),
          bottom: parseNum(computed.paddingBottom),
          left: parseNum(computed.paddingLeft),
        },
        border: {
          top: parseNum(computed.borderTopWidth),
          right: parseNum(computed.borderRightWidth),
          bottom: parseNum(computed.borderBottomWidth),
          left: parseNum(computed.borderLeftWidth),
        },
        scrollWidth: el.scrollWidth,
        scrollHeight: el.scrollHeight,
      };
    });
  }

  /**
   * Extract computed styles for ALL properties (not just categorized ones).
   * Useful for deep analysis.
   */
  static async extractAllStyles(
    locator: Locator
  ): Promise<Record<string, string>> {
    return await locator.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      const styles: Record<string, string> = {};

      for (let i = 0; i < computed.length; i++) {
        const prop = computed[i];
        styles[prop] = computed.getPropertyValue(prop);
      }

      return styles;
    });
  }

  /**
   * Get the flat list of CSS properties for given categories.
   */
  private static getProperties(categories?: StyleCategory[]): string[] {
    const cats = categories ?? (Object.keys(STYLE_CATEGORIES) as StyleCategory[]);
    const props: string[] = [];

    for (const cat of cats) {
      const catProps = STYLE_CATEGORIES[cat];
      if (catProps) {
        props.push(...catProps);
      }
    }

    return [...new Set(props)]; // deduplicate
  }
}
