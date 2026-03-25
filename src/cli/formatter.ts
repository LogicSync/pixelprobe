import type { ComparisonResult, BreakpointResult } from "../types/comparison.js";

// ANSI color codes (no dependency needed for basic colors)
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

export function formatSeverity(severity: string): string {
  switch (severity) {
    case "critical":
      return `${c.bgRed}${c.white} CRITICAL ${c.reset}`;
    case "warning":
      return `${c.bgYellow}${c.white} WARNING ${c.reset}`;
    case "info":
      return `${c.bgBlue}${c.white} INFO ${c.reset}`;
    case "pass":
      return `${c.bgGreen}${c.white} PASS ${c.reset}`;
    default:
      return severity;
  }
}

export function formatResult(result: ComparisonResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(`${c.bold}═══ Selection Comparison Report ═══${c.reset}`);
  lines.push("");
  const tgtSelector = result.config.targetSelector ?? result.config.selector;
  const selectorsMatch = tgtSelector === result.config.selector;
  lines.push(`  ${c.dim}Source:${c.reset}   ${result.config.sourceUrl}  ${c.cyan}${result.config.selector}${c.reset}`);
  lines.push(`  ${c.dim}Target:${c.reset}   ${result.config.targetUrl}  ${c.cyan}${tgtSelector}${c.reset}${!selectorsMatch ? `  ${c.dim}(different selector)${c.reset}` : ""}`);
  lines.push(`  ${c.dim}Duration:${c.reset} ${(result.duration / 1000).toFixed(1)}s`);
  lines.push("");

  // Summary
  lines.push(
    `  ${c.bold}Overall:${c.reset} ${formatSeverity(result.summary.overallSeverity)}  ` +
      `${c.dim}Breakpoints with diffs:${c.reset} ${result.summary.breakpointsWithDifferences}/${result.summary.totalBreakpoints}  ` +
      `${c.dim}Avg pixel diff:${c.reset} ${result.summary.averagePixelDiff}%`
  );

  if (result.summary.worstBreakpoint) {
    lines.push(
      `  ${c.dim}Worst breakpoint:${c.reset} ${c.red}${result.summary.worstBreakpoint}${c.reset}`
    );
  }

  lines.push("");

  // Per-breakpoint
  for (const [name, bp] of Object.entries(result.breakpoints)) {
    lines.push(
      `${c.bold}── ${name} (${bp.breakpoint.width}×${bp.breakpoint.height}) ──${c.reset}  ${c.dim}${bp.duration}ms${c.reset}`
    );

    if (bp.error) {
      lines.push(`  ${c.red}Error: ${bp.error}${c.reset}`);
      lines.push("");
      continue;
    }

    // Visual
    if (bp.visual) {
      const pct = bp.visual.diffPercentage;
      const color = pct > 5 ? c.red : pct > 1 ? c.yellow : pct > 0 ? c.blue : c.green;
      lines.push(
        `  ${c.dim}Visual:${c.reset} ${color}${pct}% different${c.reset} (${bp.visual.diffPixelCount.toLocaleString()} pixels)` +
          (bp.visual.sizeMismatch ? ` ${c.yellow}⚠ size mismatch${c.reset}` : "")
      );
    }

    // Styles
    if (bp.styles) {
      const s = bp.styles.summary;
      if (s.total === 0) {
        lines.push(`  ${c.dim}Styles:${c.reset} ${c.green}No differences${c.reset}`);
      } else {
        lines.push(
          `  ${c.dim}Styles:${c.reset} ${s.total} differences ` +
            `(${c.red}${s.critical} critical${c.reset}, ${c.yellow}${s.warning} warning${c.reset}, ${c.blue}${s.info} info${c.reset})`
        );

        // Show critical and warning diffs
        for (const diff of bp.styles.differences.filter(
          (d) => d.severity !== "info"
        )) {
          const sev =
            diff.severity === "critical"
              ? `${c.red}●${c.reset}`
              : `${c.yellow}●${c.reset}`;
          lines.push(
            `    ${sev} ${c.bold}${diff.property}${c.reset} ${c.dim}(${diff.category})${c.reset}`
          );
          lines.push(
            `      ${c.red}- ${diff.sourceValue}${c.reset}`
          );
          lines.push(
            `      ${c.green}+ ${diff.targetValue}${c.reset}`
          );
        }
      }
    }

    // Layout
    if (bp.layout) {
      const l = bp.layout.summary;
      if (l.total === 0) {
        lines.push(`  ${c.dim}Layout:${c.reset} ${c.green}No differences${c.reset}`);
      } else {
        lines.push(
          `  ${c.dim}Layout:${c.reset} ${l.total} differences ` +
            `(${c.red}${l.critical} critical${c.reset}, ${c.yellow}${l.warning} warning${c.reset}, ${c.blue}${l.info} info${c.reset})`
        );

        for (const diff of bp.layout.differences.filter(
          (d) => d.severity !== "info"
        )) {
          const sev =
            diff.severity === "critical"
              ? `${c.red}●${c.reset}`
              : `${c.yellow}●${c.reset}`;
          const sign = diff.absoluteDiff > 0 ? "+" : "";
          lines.push(
            `    ${sev} ${c.bold}${diff.property}${c.reset}: ${diff.sourceValue}px → ${diff.targetValue}px (${sign}${diff.absoluteDiff}px / ${sign}${diff.percentageDiff}%)`
          );
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}
