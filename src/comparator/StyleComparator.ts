import { STYLE_CATEGORIES, type StyleCategory } from "../types/config.js";
import type {
  StyleDifference,
  StyleComparisonResult,
  Severity,
} from "../types/comparison.js";

// Properties that have high visual impact when different
const CRITICAL_PROPERTIES = new Set([
  "display",
  "position",
  "width",
  "height",
  "flex-direction",
  "grid-template-columns",
  "grid-template-rows",
  "font-size",
  "visibility",
  "overflow",
]);

// Properties with moderate visual impact
const WARNING_PROPERTIES = new Set([
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "font-family",
  "font-weight",
  "line-height",
  "text-align",
  "color",
  "background-color",
  "border",
  "border-radius",
  "gap",
  "justify-content",
  "align-items",
  "flex-wrap",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
]);

export class StyleComparator {
  /**
   * Compare computed styles from source and target elements.
   */
  static compare(
    sourceStyles: Record<string, string>,
    targetStyles: Record<string, string>
  ): StyleComparisonResult {
    const differences: StyleDifference[] = [];

    // Build a reverse map: property → category
    const propertyCategory = new Map<string, string>();
    for (const [cat, props] of Object.entries(STYLE_CATEGORIES)) {
      for (const prop of props) {
        propertyCategory.set(prop, cat);
      }
    }

    // Union of all properties from both
    const allProperties = new Set([
      ...Object.keys(sourceStyles),
      ...Object.keys(targetStyles),
    ]);

    for (const prop of allProperties) {
      const sourceVal = normalizeValue(sourceStyles[prop] ?? "");
      const targetVal = normalizeValue(targetStyles[prop] ?? "");

      if (sourceVal !== targetVal) {
        differences.push({
          property: prop,
          category: propertyCategory.get(prop) ?? "other",
          sourceValue: sourceStyles[prop] ?? "(not set)",
          targetValue: targetStyles[prop] ?? "(not set)",
          severity: classifySeverity(prop),
        });
      }
    }

    // Sort by severity (critical first), then by property name
    const severityOrder: Record<Severity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };
    differences.sort(
      (a, b) =>
        severityOrder[a.severity] - severityOrder[b.severity] ||
        a.property.localeCompare(b.property)
    );

    return {
      differences,
      summary: {
        total: differences.length,
        critical: differences.filter((d) => d.severity === "critical").length,
        warning: differences.filter((d) => d.severity === "warning").length,
        info: differences.filter((d) => d.severity === "info").length,
      },
      sourceStyleCount: Object.keys(sourceStyles).length,
      targetStyleCount: Object.keys(targetStyles).length,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function classifySeverity(property: string): Severity {
  if (CRITICAL_PROPERTIES.has(property)) return "critical";
  if (WARNING_PROPERTIES.has(property)) return "warning";
  return "info";
}

/**
 * Normalize CSS values for comparison.
 * E.g., "rgb(255, 0, 0)" vs "rgb(255,0,0)" should match.
 */
function normalizeValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ") // collapse whitespace
    .replace(/,\s*/g, ", ") // normalize comma spacing
    .replace(/\s*\/\s*/g, " / ") // normalize slash spacing
    .replace(/0px/g, "0") // 0px → 0
    .replace(/\.0+(?=\s|,|$|\))/g, "") // remove trailing .0
    .replace(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*1\)/g, "rgb($1, $2, $3)"); // rgba(x,y,z,1) → rgb(x,y,z)
}
