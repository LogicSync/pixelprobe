import type { Page } from "playwright";
import type { Breakpoint, StyleCategory } from "../types/config.js";
import type {
  BreakpointResult,
  ExtractedSection,
  ProgressCallback,
} from "../types/comparison.js";
import { SectionExtractor } from "../extractor/SectionExtractor.js";
import { StyleExtractor } from "../extractor/StyleExtractor.js";
import { ScreenshotCapturer } from "../extractor/ScreenshotCapturer.js";
import { StyleComparator } from "./StyleComparator.js";
import { PixelComparator } from "./PixelComparator.js";
import { LayoutComparator } from "./LayoutComparator.js";

export interface AggregatorOptions {
  selector: string;
  targetSelector?: string;
  elementIndex: number;
  styleCategories?: StyleCategory[];
  pixelThreshold?: number;
  includeVisual?: boolean;
  includeStyles?: boolean;
  includeLayout?: boolean;
}

export class DiffAggregator {
  /**
   * Extract section data from a page.
   */
  static async extractSection(
    page: Page,
    selector: string,
    elementIndex: number,
    styleCategories?: StyleCategory[]
  ): Promise<ExtractedSection> {
    const { info, locator } = await SectionExtractor.getElement(
      page,
      selector,
      elementIndex
    );

    if (!info.exists) {
      throw new Error(
        `Element not found: "${selector}" at index ${elementIndex}`
      );
    }

    const [computedStyles, layoutMetrics, screenshot] = await Promise.all([
      StyleExtractor.extractStyles(locator, styleCategories),
      StyleExtractor.extractLayoutMetrics(locator),
      ScreenshotCapturer.captureElement(locator),
    ]);

    return {
      element: info,
      computedStyles,
      layoutMetrics,
      screenshot,
    };
  }

  /**
   * Compare extracted sections from source and target for a single breakpoint.
   */
  static async compareBreakpoint(
    sourcePage: Page,
    targetPage: Page,
    breakpoint: Breakpoint,
    options: AggregatorOptions
  ): Promise<BreakpointResult> {
    const start = Date.now();

    try {
      // Extract both sections in parallel (may use different selectors)
      const tgtSelector = options.targetSelector ?? options.selector;
      const [source, target] = await Promise.all([
        DiffAggregator.extractSection(
          sourcePage,
          options.selector,
          options.elementIndex,
          options.styleCategories
        ),
        DiffAggregator.extractSection(
          targetPage,
          tgtSelector,
          options.elementIndex,
          options.styleCategories
        ),
      ]);

      const result: BreakpointResult = {
        breakpoint: {
          name: breakpoint.name,
          width: breakpoint.width,
          height: breakpoint.height,
        },
        sourceElement: source.element,
        targetElement: target.element,
        duration: 0,
      };

      // Style comparison
      if (options.includeStyles !== false) {
        result.styles = StyleComparator.compare(
          source.computedStyles,
          target.computedStyles
        );
      }

      // Pixel comparison
      if (options.includeVisual !== false) {
        result.visual = PixelComparator.compare(
          source.screenshot,
          target.screenshot,
          options.pixelThreshold ?? 0.1
        );
      }

      // Layout comparison
      if (options.includeLayout !== false) {
        result.layout = LayoutComparator.compare(
          source.layoutMetrics,
          target.layoutMetrics
        );
      }

      result.duration = Date.now() - start;
      return result;
    } catch (err) {
      return {
        breakpoint: {
          name: breakpoint.name,
          width: breakpoint.width,
          height: breakpoint.height,
        },
        sourceElement: {
          selector: options.selector,
          index: options.elementIndex,
          tagName: "unknown",
          textPreview: "",
          boundingBox: { x: 0, y: 0, width: 0, height: 0 },
          exists: false,
        },
        targetElement: {
          selector: options.selector,
          index: options.elementIndex,
          tagName: "unknown",
          textPreview: "",
          boundingBox: { x: 0, y: 0, width: 0, height: 0 },
          exists: false,
        },
        error: (err as Error).message,
        duration: Date.now() - start,
      };
    }
  }
}
