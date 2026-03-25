import { randomUUID } from "node:crypto";
import type {
  ComparisonConfig,
  ResolvedConfig,
  Breakpoint,
  StyleCategory,
} from "./types/config.js";
import { ComparisonConfigSchema } from "./types/config.js";
import type {
  ComparisonResult,
  ComparisonSummary,
  BreakpointResult,
  ProgressCallback,
  ElementInfo,
} from "./types/comparison.js";
import { BrowserManager } from "./browser/BrowserManager.js";
import { ViewportManager } from "./browser/ViewportManager.js";
import { SectionExtractor } from "./extractor/SectionExtractor.js";
import { DiffAggregator } from "./comparator/DiffAggregator.js";

export class WebSectionComparator {
  private browserManager: BrowserManager;

  constructor(options?: { headless?: boolean; timeout?: number }) {
    this.browserManager = new BrowserManager(options);
  }

  /**
   * Run a full comparison across all breakpoints.
   */
  async compare(
    config: ComparisonConfig,
    onProgress?: ProgressCallback
  ): Promise<ComparisonResult> {
    const start = Date.now();
    const id = randomUUID().slice(0, 8);

    // Validate config
    const validated = ComparisonConfigSchema.parse(config);

    // Resolve breakpoints
    const resolvedBreakpoints = ViewportManager.resolve(
      validated.breakpoints,
      validated.customBreakpoints
    );

    const resolvedConfig: ResolvedConfig = {
      ...validated,
      resolvedBreakpoints,
    };

    onProgress?.({
      phase: "init",
      message: `Starting comparison with ${resolvedBreakpoints.length} breakpoints`,
      progress: 0,
    });

    // Resolve separate selectors for source and target
    const sourceSelector = validated.selector;
    const targetSelector = validated.targetSelector ?? validated.selector;

    try {
      await this.browserManager.launch();

      const breakpointResults: Record<string, BreakpointResult> = {};

      for (let i = 0; i < resolvedBreakpoints.length; i++) {
        const bp = resolvedBreakpoints[i];
        const progressBase = Math.round(((i / resolvedBreakpoints.length) * 80) + 10);

        onProgress?.({
          phase: "extracting",
          breakpoint: bp.name,
          message: `Comparing at ${bp.name} (${bp.width}×${bp.height})`,
          progress: progressBase,
        });

        // Create pages for this breakpoint
        const sourcePage = await this.browserManager.createPage(bp);
        const targetPage = await this.browserManager.createPage(bp);

        try {
          // Navigate both pages (each waits for its own selector)
          await Promise.all([
            this.browserManager.navigateAndWait(sourcePage, validated.sourceUrl, {
              waitForSelector: validated.waitForSelector ?? sourceSelector,
              waitForTimeout: validated.waitForTimeout,
            }),
            this.browserManager.navigateAndWait(targetPage, validated.targetUrl, {
              waitForSelector: validated.waitForSelector ?? targetSelector,
              waitForTimeout: validated.waitForTimeout,
            }),
          ]);

          // Run comparison for this breakpoint
          const elementIdx = typeof validated.elementIndex === "number"
            ? validated.elementIndex
            : 0;

          const result = await DiffAggregator.compareBreakpoint(
            sourcePage,
            targetPage,
            bp,
            {
              selector: sourceSelector,
              targetSelector,
              elementIndex: elementIdx,
              styleCategories: validated.styleCategories as StyleCategory[] | undefined,
              pixelThreshold: validated.pixelThreshold,
              includeVisual: validated.includeVisual,
              includeStyles: validated.includeStyles,
              includeLayout: validated.includeLayout,
            }
          );

          breakpointResults[bp.name] = result;
        } finally {
          // Always close contexts to free resources
          await sourcePage.context().close();
          await targetPage.context().close();
        }
      }

      onProgress?.({
        phase: "reporting",
        message: "Generating report",
        progress: 90,
      });

      const summary = computeSummary(breakpointResults);

      const result: ComparisonResult = {
        id,
        timestamp: new Date().toISOString(),
        config: {
          sourceUrl: validated.sourceUrl,
          targetUrl: validated.targetUrl,
          selector: sourceSelector,
          targetSelector: targetSelector !== sourceSelector ? targetSelector : undefined,
          elementIndex: validated.elementIndex,
        },
        breakpoints: breakpointResults,
        summary,
        artifacts: {
          diffImages: {},
          sourceScreenshots: {},
          targetScreenshots: {},
        },
        duration: Date.now() - start,
      };

      onProgress?.({
        phase: "done",
        message: "Comparison complete",
        progress: 100,
      });

      return result;
    } finally {
      await this.browserManager.close();
    }
  }

  /**
   * Enumerate matching elements for a selector on a URL.
   * Useful for disambiguation before comparing.
   */
  async enumerate(
    url: string,
    selector: string,
    breakpoint?: string
  ): Promise<ElementInfo[]> {
    const bp = ViewportManager.resolve([breakpoint ?? "desktop"])[0];

    try {
      await this.browserManager.launch();
      const page = await this.browserManager.createPage(bp);

      try {
        await this.browserManager.navigateAndWait(page, url, {
          waitForSelector: selector,
        });

        return await SectionExtractor.enumerate(page, selector);
      } finally {
        await page.context().close();
      }
    } finally {
      await this.browserManager.close();
    }
  }

  /**
   * List available breakpoint presets.
   */
  listBreakpoints() {
    return ViewportManager.listPresets();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function computeSummary(
  breakpoints: Record<string, BreakpointResult>
): ComparisonSummary {
  const entries = Object.entries(breakpoints);
  let totalStyleDiffs = 0;
  let totalLayoutDiffs = 0;
  let totalPixelDiff = 0;
  let pixelDiffCount = 0;
  let breakpointsWithDiffs = 0;
  let worstBreakpoint: string | null = null;
  let worstScore = 0;

  for (const [name, result] of entries) {
    if (result.error) continue;

    const hasDiffs =
      (result.styles?.summary.total ?? 0) > 0 ||
      (result.layout?.summary.total ?? 0) > 0 ||
      (result.visual?.diffPercentage ?? 0) > 0;

    if (hasDiffs) breakpointsWithDiffs++;

    totalStyleDiffs += result.styles?.summary.total ?? 0;
    totalLayoutDiffs += result.layout?.summary.total ?? 0;

    if (result.visual) {
      totalPixelDiff += result.visual.diffPercentage;
      pixelDiffCount++;
    }

    // Score = weighted sum of issues
    const score =
      (result.styles?.summary.critical ?? 0) * 10 +
      (result.styles?.summary.warning ?? 0) * 3 +
      (result.styles?.summary.info ?? 0) * 1 +
      (result.layout?.summary.critical ?? 0) * 10 +
      (result.layout?.summary.warning ?? 0) * 3 +
      (result.visual?.diffPercentage ?? 0) * 2;

    if (score > worstScore) {
      worstScore = score;
      worstBreakpoint = name;
    }
  }

  const avgPixelDiff =
    pixelDiffCount > 0
      ? Math.round((totalPixelDiff / pixelDiffCount) * 100) / 100
      : 0;

  // Determine overall severity
  const hasCritical = entries.some(
    ([, r]) =>
      (r.styles?.summary.critical ?? 0) > 0 ||
      (r.layout?.summary.critical ?? 0) > 0 ||
      (r.visual?.diffPercentage ?? 0) > 5
  );
  const hasWarning = entries.some(
    ([, r]) =>
      (r.styles?.summary.warning ?? 0) > 0 ||
      (r.layout?.summary.warning ?? 0) > 0 ||
      (r.visual?.diffPercentage ?? 0) > 1
  );

  return {
    totalBreakpoints: entries.length,
    breakpointsWithDifferences: breakpointsWithDiffs,
    totalStyleDifferences: totalStyleDiffs,
    totalLayoutDifferences: totalLayoutDiffs,
    averagePixelDiff: avgPixelDiff,
    worstBreakpoint,
    overallSeverity: hasCritical
      ? "critical"
      : hasWarning
      ? "warning"
      : breakpointsWithDiffs > 0
      ? "info"
      : "pass",
  };
}
