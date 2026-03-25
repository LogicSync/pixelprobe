// ── Severity Levels ─────────────────────────────────────────────────

export type Severity = "critical" | "warning" | "info";

// ── Element Info ────────────────────────────────────────────────────

export interface ElementInfo {
  selector: string;
  index: number;
  tagName: string;
  textPreview: string;
  boundingBox: BoundingBox;
  exists: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Extracted Data ──────────────────────────────────────────────────

export interface ExtractedSection {
  element: ElementInfo;
  computedStyles: Record<string, string>;
  layoutMetrics: LayoutMetrics;
  screenshot: Buffer;
}

export interface LayoutMetrics {
  boundingBox: BoundingBox;
  margin: BoxSpacing;
  padding: BoxSpacing;
  border: BoxSpacing;
  scrollWidth: number;
  scrollHeight: number;
}

export interface BoxSpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ── Style Diff ──────────────────────────────────────────────────────

export interface StyleDifference {
  property: string;
  category: string;
  sourceValue: string;
  targetValue: string;
  severity: Severity;
}

export interface StyleComparisonResult {
  differences: StyleDifference[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  sourceStyleCount: number;
  targetStyleCount: number;
}

// ── Pixel Diff ──────────────────────────────────────────────────────

export interface PixelComparisonResult {
  diffPixelCount: number;
  totalPixels: number;
  diffPercentage: number;
  diffImage: Buffer;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  sizeMismatch: boolean;
}

// ── Layout Diff ─────────────────────────────────────────────────────

export interface LayoutDifference {
  property: string;
  sourceValue: number;
  targetValue: number;
  absoluteDiff: number;
  percentageDiff: number;
  severity: Severity;
}

export interface LayoutComparisonResult {
  differences: LayoutDifference[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

// ── Per-Breakpoint Result ───────────────────────────────────────────

export interface BreakpointResult {
  breakpoint: {
    name: string;
    width: number;
    height: number;
  };
  sourceElement: ElementInfo;
  targetElement: ElementInfo;
  visual?: PixelComparisonResult;
  styles?: StyleComparisonResult;
  layout?: LayoutComparisonResult;
  error?: string;
  duration: number;
}

// ── Aggregated Comparison Result ────────────────────────────────────

export interface ComparisonResult {
  id: string;
  timestamp: string;
  config: {
    sourceUrl: string;
    targetUrl: string;
    selector: string;
    targetSelector?: string;
    elementIndex?: number | "all";
  };
  breakpoints: Record<string, BreakpointResult>;
  summary: ComparisonSummary;
  artifacts: {
    jsonPath?: string;
    htmlReportPath?: string;
    diffImages: Record<string, string>;
    sourceScreenshots: Record<string, string>;
    targetScreenshots: Record<string, string>;
  };
  duration: number;
}

export interface ComparisonSummary {
  totalBreakpoints: number;
  breakpointsWithDifferences: number;
  totalStyleDifferences: number;
  totalLayoutDifferences: number;
  averagePixelDiff: number;
  worstBreakpoint: string | null;
  overallSeverity: Severity | "pass";
}

// ── Progress Callback ───────────────────────────────────────────────

export interface ProgressEvent {
  phase: "init" | "extracting" | "comparing" | "reporting" | "done";
  breakpoint?: string;
  message: string;
  progress: number; // 0-100
}

export type ProgressCallback = (event: ProgressEvent) => void;
