// ── Main API ────────────────────────────────────────────────────────
export { WebSectionComparator } from "./core.js";

// ── Types ───────────────────────────────────────────────────────────
export type {
  ComparisonConfig,
  ResolvedConfig,
  Breakpoint,
  PresetBreakpointName,
  StyleCategory,
} from "./types/config.js";

export {
  ComparisonConfigSchema,
  PRESET_BREAKPOINTS,
  STYLE_CATEGORIES,
} from "./types/config.js";

export type {
  ComparisonResult,
  ComparisonSummary,
  BreakpointResult,
  StyleDifference,
  StyleComparisonResult,
  PixelComparisonResult,
  LayoutDifference,
  LayoutComparisonResult,
  ElementInfo,
  ExtractedSection,
  LayoutMetrics,
  ProgressCallback,
  ProgressEvent,
  Severity,
} from "./types/comparison.js";

// ── Reporters ───────────────────────────────────────────────────────
export { JSONReporter } from "./reporter/JSONReporter.js";
export { HTMLReporter } from "./reporter/HTMLReporter.js";

// ── Browser utilities ───────────────────────────────────────────────
export { ViewportManager } from "./browser/ViewportManager.js";
