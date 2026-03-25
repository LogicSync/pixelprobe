#!/usr/bin/env node

import { join } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { WebSectionComparator } from "../core.js";
import { JSONReporter } from "../reporter/JSONReporter.js";
import { HTMLReporter } from "../reporter/HTMLReporter.js";
import { formatResult } from "../cli/formatter.js";
import { ViewportManager } from "../browser/ViewportManager.js";
import { PRESET_BREAKPOINTS } from "../types/config.js";

const cli = yargs(hideBin(process.argv))
  .scriptName("pixelprobe")
  .usage("$0 <command> [options]")
  .command(
    "compare",
    "Compare a section between source and target URLs across breakpoints",
    (y) =>
      y
        .option("source", {
          alias: "s",
          type: "string",
          describe: "Source URL (the reference page)",
          demandOption: true,
        })
        .option("target", {
          alias: "t",
          type: "string",
          describe: "Target URL (your local build)",
          demandOption: true,
        })
        .option("selector", {
          alias: "S",
          type: "string",
          describe: "CSS selector for the section on the source page",
          demandOption: true,
        })
        .option("target-selector", {
          alias: "T",
          type: "string",
          describe:
            "CSS selector for the section on the target page (if different from source). Falls back to --selector.",
        })
        .option("index", {
          alias: "i",
          type: "number",
          describe: "Element index if selector matches multiple elements",
          default: 0,
        })
        .option("breakpoints", {
          alias: "b",
          type: "string",
          describe:
            'Comma-separated breakpoint names or WIDTHxHEIGHT (e.g. "mobile,tablet,1440x900")',
          default: "mobile,tablet,desktop,desktop-lg",
        })
        .option("output", {
          alias: "o",
          type: "string",
          describe: "Output directory for reports and artifacts",
          default: "./pixelprobe-output",
        })
        .option("format", {
          alias: "f",
          type: "string",
          describe: 'Output formats: "json", "html", "both"',
          default: "both",
        })
        .option("threshold", {
          type: "number",
          describe: "Pixel comparison threshold (0-1, lower = stricter)",
          default: 0.1,
        })
        .option("no-visual", {
          type: "boolean",
          describe: "Skip visual (pixel) comparison",
          default: false,
        })
        .option("no-styles", {
          type: "boolean",
          describe: "Skip computed style comparison",
          default: false,
        })
        .option("no-layout", {
          type: "boolean",
          describe: "Skip layout metrics comparison",
          default: false,
        })
        .option("wait", {
          alias: "w",
          type: "number",
          describe: "Wait N ms after page load before capturing",
          default: 0,
        })
        .option("headed", {
          type: "boolean",
          describe: "Run browser in headed mode (visible)",
          default: false,
        })
        .option("json", {
          type: "boolean",
          describe: "Output compact JSON to stdout (for piping)",
          default: false,
        }),
    async (argv) => {
      const breakpoints = argv.breakpoints.split(",").map((s: string) => s.trim());

      const comparator = new WebSectionComparator({
        headless: !argv.headed,
        timeout: 30000,
      });

      // Progress display
      const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      let spinnerIdx = 0;
      let spinnerInterval: NodeJS.Timeout | undefined;

      if (!argv.json) {
        spinnerInterval = setInterval(() => {
          spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
        }, 80);
      }

      try {
        const result = await comparator.compare(
          {
            sourceUrl: argv.source,
            targetUrl: argv.target,
            selector: argv.selector,
            targetSelector: argv["target-selector"] as string | undefined,
            elementIndex: argv.index,
            breakpoints,
            pixelThreshold: argv.threshold,
            includeVisual: !argv["no-visual"],
            includeStyles: !argv["no-styles"],
            includeLayout: !argv["no-layout"],
            waitForTimeout: argv.wait,
          },
          !argv.json
            ? (event) => {
                process.stderr.write(
                  `\r${spinnerFrames[spinnerIdx]} ${event.message} (${Math.round(event.progress)}%)   `
                );
              }
            : undefined
        );

        if (spinnerInterval) clearInterval(spinnerInterval);

        // JSON-only mode (for piping)
        if (argv.json) {
          console.log(JSON.stringify(JSONReporter.toCompactSummary(result), null, 2));
          process.exit(result.summary.overallSeverity === "pass" ? 0 : 1);
          return;
        }

        // Clear spinner line
        process.stderr.write("\r" + " ".repeat(80) + "\r");

        // Console output
        console.log(formatResult(result));

        // Create a timestamped run directory inside the output dir
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .replace("T", "_")
          .slice(0, 19);
        const runDir = join(argv.output, `run_${timestamp}_${result.id}`);

        // Generate reports into the run directory
        const format = argv.format as string;
        if (format === "json" || format === "both") {
          const jsonPath = await JSONReporter.generate(result, runDir);
          console.log(`  📄 JSON report: ${jsonPath}`);
        }
        if (format === "html" || format === "both") {
          const htmlPath = await HTMLReporter.generate(result, runDir);
          console.log(`  🌐 HTML report: ${htmlPath}`);
        }

        console.log("");

        // Exit with non-zero if differences found
        process.exit(result.summary.overallSeverity === "pass" ? 0 : 1);
      } catch (err) {
        if (spinnerInterval) clearInterval(spinnerInterval);
        process.stderr.write("\r" + " ".repeat(80) + "\r");
        console.error(`\n❌ Error: ${(err as Error).message}`);
        process.exit(2);
      }
    }
  )
  .command(
    "enumerate",
    "List all elements matching a selector on a page",
    (y) =>
      y
        .option("url", {
          alias: "u",
          type: "string",
          describe: "URL to inspect",
          demandOption: true,
        })
        .option("selector", {
          alias: "S",
          type: "string",
          describe: "CSS selector",
          demandOption: true,
        }),
    async (argv) => {
      const comparator = new WebSectionComparator({ headless: true });

      try {
        const elements = await comparator.enumerate(argv.url, argv.selector);

        if (elements.length === 0) {
          console.log(`No elements found matching "${argv.selector}"`);
          process.exit(1);
          return;
        }

        console.log(
          `\nFound ${elements.length} element(s) matching "${argv.selector}":\n`
        );

        for (const el of elements) {
          const box = el.boundingBox;
          console.log(
            `  [${el.index}] <${el.tagName}> (${box.width}×${box.height} at ${box.x},${box.y})`
          );
          if (el.textPreview) {
            console.log(`      "${el.textPreview}"`);
          }
        }

        console.log(
          `\nUse --index N with the compare command to select a specific element.`
        );
      } catch (err) {
        console.error(`❌ Error: ${(err as Error).message}`);
        process.exit(2);
      }
    }
  )
  .command("breakpoints", "List available breakpoint presets", () => {}, () => {
    console.log("\nAvailable breakpoint presets:\n");
    for (const [name, bp] of Object.entries(PRESET_BREAKPOINTS)) {
      console.log(`  ${name.padEnd(14)} ${bp.width}×${bp.height}  ${bp.label}`);
    }
    console.log(
      `\nYou can also use custom breakpoints in WIDTHxHEIGHT format (e.g. 1440x900).`
    );
  })
  .demandCommand(1, "Please specify a command")
  .help()
  .version("0.1.0")
  .strict();

cli.parse();
