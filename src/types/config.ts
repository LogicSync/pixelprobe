import { z } from "zod";

// ── Breakpoint Definitions ──────────────────────────────────────────

export const PRESET_BREAKPOINTS = {
  "mobile-sm": { width: 320, height: 568, label: "Mobile Small" },
  mobile: { width: 375, height: 812, label: "Mobile" },
  "mobile-lg": { width: 428, height: 926, label: "Mobile Large" },
  tablet: { width: 768, height: 1024, label: "Tablet" },
  "tablet-lg": { width: 1024, height: 1366, label: "Tablet Large" },
  desktop: { width: 1280, height: 800, label: "Desktop" },
  "desktop-lg": { width: 1920, height: 1080, label: "Desktop Large" },
  "desktop-xl": { width: 2560, height: 1440, label: "Desktop XL" },
} as const;

export type PresetBreakpointName = keyof typeof PRESET_BREAKPOINTS;

export interface Breakpoint {
  name: string;
  width: number;
  height: number;
  label?: string;
}

// ── Style Categories ────────────────────────────────────────────────

export const STYLE_CATEGORIES = {
  layout: [
    "display",
    "position",
    "float",
    "clear",
    "overflow",
    "overflow-x",
    "overflow-y",
    "visibility",
    "z-index",
    "box-sizing",
  ],
  flexbox: [
    "flex-direction",
    "flex-wrap",
    "justify-content",
    "align-items",
    "align-content",
    "align-self",
    "flex-grow",
    "flex-shrink",
    "flex-basis",
    "order",
    "gap",
    "row-gap",
    "column-gap",
  ],
  grid: [
    "grid-template-columns",
    "grid-template-rows",
    "grid-template-areas",
    "grid-column",
    "grid-row",
    "grid-auto-flow",
    "grid-auto-columns",
    "grid-auto-rows",
    "place-items",
    "place-content",
  ],
  spacing: [
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
  ],
  sizing: [
    "width",
    "height",
    "min-width",
    "min-height",
    "max-width",
    "max-height",
    "aspect-ratio",
  ],
  typography: [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-decoration",
    "text-transform",
    "white-space",
    "word-break",
    "word-spacing",
  ],
  colors: [
    "color",
    "background-color",
    "background-image",
    "background-size",
    "background-position",
    "background-repeat",
    "opacity",
  ],
  borders: [
    "border",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-width",
    "border-style",
    "border-color",
    "border-radius",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
    "outline",
  ],
  effects: [
    "box-shadow",
    "text-shadow",
    "filter",
    "backdrop-filter",
    "mix-blend-mode",
    "transform",
    "transition",
    "animation",
  ],
  positioning: ["top", "right", "bottom", "left", "inset"],
} as const;

export type StyleCategory = keyof typeof STYLE_CATEGORIES;

// ── Comparison Config ───────────────────────────────────────────────

export const ComparisonConfigSchema = z.object({
  sourceUrl: z.string().url("Source must be a valid URL"),
  targetUrl: z.string().url("Target must be a valid URL"),
  selector: z.string().min(1, "CSS selector is required"),
  targetSelector: z.string().optional().describe(
    "CSS selector for the target page if different from source. Falls back to `selector`."
  ),
  elementIndex: z.union([z.number().int().min(0), z.literal("all")]).optional(),
  breakpoints: z.array(z.string()).optional(),
  customBreakpoints: z
    .record(
      z.string(),
      z.object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
    )
    .optional(),
  styleCategories: z.array(z.string()).optional(),
  pixelThreshold: z.number().min(0).max(1).default(0.1),
  includeVisual: z.boolean().default(true),
  includeStyles: z.boolean().default(true),
  includeLayout: z.boolean().default(true),
  headless: z.boolean().default(true),
  timeout: z.number().int().positive().default(30000),
  outputDir: z.string().optional(),
  waitForSelector: z.string().optional(),
  waitForTimeout: z.number().int().min(0).default(0),
});

export type ComparisonConfig = z.input<typeof ComparisonConfigSchema>;

// ── Resolved config (after defaults) ────────────────────────────────

export interface ResolvedConfig extends ComparisonConfig {
  resolvedBreakpoints: Breakpoint[];
}
