import type {
  LayoutMetrics,
  LayoutDifference,
  LayoutComparisonResult,
  Severity,
} from "../types/comparison.js";

// Threshold in pixels for severity classification
const CRITICAL_THRESHOLD_PX = 10;
const WARNING_THRESHOLD_PX = 3;

export class LayoutComparator {
  /**
   * Compare layout metrics between source and target elements.
   */
  static compare(
    source: LayoutMetrics,
    target: LayoutMetrics
  ): LayoutComparisonResult {
    const differences: LayoutDifference[] = [];

    // Compare bounding box dimensions
    comparePair(differences, "width", source.boundingBox.width, target.boundingBox.width);
    comparePair(differences, "height", source.boundingBox.height, target.boundingBox.height);

    // Compare margin
    compareSpacing(differences, "margin", source.margin, target.margin);

    // Compare padding
    compareSpacing(differences, "padding", source.padding, target.padding);

    // Compare border widths
    compareSpacing(differences, "border", source.border, target.border);

    // Compare scroll dimensions
    comparePair(differences, "scrollWidth", source.scrollWidth, target.scrollWidth);
    comparePair(differences, "scrollHeight", source.scrollHeight, target.scrollHeight);

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    differences.sort(
      (a, b) =>
        severityOrder[a.severity] - severityOrder[b.severity] ||
        Math.abs(b.absoluteDiff) - Math.abs(a.absoluteDiff)
    );

    return {
      differences,
      summary: {
        total: differences.length,
        critical: differences.filter((d) => d.severity === "critical").length,
        warning: differences.filter((d) => d.severity === "warning").length,
        info: differences.filter((d) => d.severity === "info").length,
      },
    };
  }
}

function comparePair(
  diffs: LayoutDifference[],
  property: string,
  sourceVal: number,
  targetVal: number
): void {
  const absoluteDiff = Math.round((targetVal - sourceVal) * 100) / 100;
  if (absoluteDiff === 0) return;

  const percentageDiff =
    sourceVal !== 0
      ? Math.round((absoluteDiff / sourceVal) * 10000) / 100
      : targetVal !== 0
      ? 100
      : 0;

  diffs.push({
    property,
    sourceValue: sourceVal,
    targetValue: targetVal,
    absoluteDiff,
    percentageDiff,
    severity: classifyLayoutSeverity(Math.abs(absoluteDiff)),
  });
}

function compareSpacing(
  diffs: LayoutDifference[],
  prefix: string,
  source: { top: number; right: number; bottom: number; left: number },
  target: { top: number; right: number; bottom: number; left: number }
): void {
  comparePair(diffs, `${prefix}-top`, source.top, target.top);
  comparePair(diffs, `${prefix}-right`, source.right, target.right);
  comparePair(diffs, `${prefix}-bottom`, source.bottom, target.bottom);
  comparePair(diffs, `${prefix}-left`, source.left, target.left);
}

function classifyLayoutSeverity(absDiff: number): Severity {
  if (absDiff >= CRITICAL_THRESHOLD_PX) return "critical";
  if (absDiff >= WARNING_THRESHOLD_PX) return "warning";
  return "info";
}
