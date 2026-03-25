#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WebSectionComparator } from "../core.js";
import { JSONReporter } from "../reporter/JSONReporter.js";
import { HTMLReporter } from "../reporter/HTMLReporter.js";
import { PRESET_BREAKPOINTS } from "../types/config.js";

const server = new McpServer({
  name: "stylediff",
  version: "0.1.0",
});

// ── Tool: compare_sections ──────────────────────────────────────────

server.tool(
  "compare_sections",
  "Compare a web page section between source and target URLs across responsive breakpoints. " +
    "Returns detailed style, layout, and visual differences at each breakpoint. " +
    "Use this to verify that a rebuilt section matches the original design.",
  {
    sourceUrl: z.string().url().describe("Source URL (the reference/original page)"),
    targetUrl: z.string().url().describe("Target URL (the local build or new version)"),
    selector: z
      .string()
      .min(1)
      .describe('CSS selector for the section on the source page (e.g. ".hero-section", "#pricing")'),
    targetSelector: z
      .string()
      .min(1)
      .optional()
      .describe('CSS selector for the section on the target page, if different from source. Falls back to selector.'),
    elementIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Element index if selector matches multiple elements (default: 0)"),
    breakpoints: z
      .array(z.string())
      .optional()
      .describe(
        'Breakpoint names to test. Presets: mobile, tablet, desktop, desktop-lg. Or use WIDTHxHEIGHT format. Default: ["mobile", "tablet", "desktop", "desktop-lg"]'
      ),
    pixelThreshold: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Pixel comparison sensitivity (0-1, lower = stricter). Default: 0.1"),
    includeVisual: z
      .boolean()
      .optional()
      .describe("Include pixel-level visual comparison. Default: true"),
    includeStyles: z
      .boolean()
      .optional()
      .describe("Include computed style comparison. Default: true"),
    includeLayout: z
      .boolean()
      .optional()
      .describe("Include layout metrics comparison. Default: true"),
    waitForTimeout: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Wait N ms after page load before capturing. Default: 0"),
    outputDir: z
      .string()
      .optional()
      .describe("Directory to save report artifacts. Default: ./stylediff-output"),
  },
  async (args) => {
    const comparator = new WebSectionComparator({
      headless: true,
      timeout: 30000,
    });

    try {
      const result = await comparator.compare({
        sourceUrl: args.sourceUrl,
        targetUrl: args.targetUrl,
        selector: args.selector,
        targetSelector: args.targetSelector,
        elementIndex: args.elementIndex ?? 0,
        breakpoints: args.breakpoints,
        pixelThreshold: args.pixelThreshold ?? 0.1,
        includeVisual: args.includeVisual ?? true,
        includeStyles: args.includeStyles ?? true,
        includeLayout: args.includeLayout ?? true,
        waitForTimeout: args.waitForTimeout ?? 0,
      });

      // Save reports into a timestamped run directory
      const baseDir = args.outputDir ?? "./stylediff-output";
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .slice(0, 19);
      const runDir = `${baseDir}/run_${timestamp}_${result.id}`;
      const jsonPath = await JSONReporter.generate(result, runDir);
      const htmlPath = await HTMLReporter.generate(result, runDir);

      result.artifacts.jsonPath = jsonPath;
      result.artifacts.htmlReportPath = htmlPath;

      // Return compact summary for the agent
      const summary = JSONReporter.toCompactSummary(result);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(summary, null, 2),
          },
          {
            type: "text" as const,
            text: `\n---\nReports saved:\n  JSON: ${jsonPath}\n  HTML: ${htmlPath}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error during comparison: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ── Tool: capture_section ───────────────────────────────────────────

server.tool(
  "capture_section",
  "Capture information about a section on a web page — its computed styles, layout metrics, " +
    "and a screenshot. Useful for inspecting a single page before running a comparison.",
  {
    url: z.string().url().describe("URL of the page to inspect"),
    selector: z.string().min(1).describe("CSS selector for the section"),
    elementIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Element index if selector matches multiple (default: 0)"),
    breakpoint: z
      .string()
      .optional()
      .describe('Breakpoint to use. Default: "desktop"'),
  },
  async (args) => {
    const comparator = new WebSectionComparator({ headless: true });

    try {
      // First enumerate to show what's available
      const elements = await comparator.enumerate(
        args.url,
        args.selector,
        args.breakpoint
      );

      if (elements.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No elements found matching "${args.selector}" on ${args.url}`,
            },
          ],
          isError: true,
        };
      }

      const elementList = elements
        .map(
          (el) =>
            `  [${el.index}] <${el.tagName}> ${el.boundingBox.width}×${el.boundingBox.height} at (${el.boundingBox.x},${el.boundingBox.y}) — "${el.textPreview}"`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${elements.length} element(s) matching "${args.selector}":\n${elementList}\n\nUse elementIndex to select a specific one for comparison.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ── Tool: list_breakpoints ──────────────────────────────────────────

server.tool(
  "list_breakpoints",
  "List all available responsive breakpoint presets with their dimensions.",
  {},
  async () => {
    const presets = Object.entries(PRESET_BREAKPOINTS)
      .map(([name, bp]) => `  ${name.padEnd(14)} ${bp.width}×${bp.height}  ${bp.label}`)
      .join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Available breakpoint presets:\n${presets}\n\nYou can also use custom WIDTHxHEIGHT format (e.g. "1440x900").`,
        },
      ],
    };
  }
);

// ── Start Server ────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("stylediff MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
