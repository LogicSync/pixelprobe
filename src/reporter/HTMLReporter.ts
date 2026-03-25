import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ComparisonResult, BreakpointResult } from "../types/comparison.js";

export class HTMLReporter {
  /**
   * Generate a self-contained interactive HTML report.
   */
  static async generate(
    result: ComparisonResult,
    outputDir: string
  ): Promise<string> {
    await mkdir(outputDir, { recursive: true });

    // Save screenshots and diff images, collect base64 for embedding
    const imageData: Record<
      string,
      { diff?: string; source?: string; target?: string }
    > = {};

    for (const [bpName, bpResult] of Object.entries(result.breakpoints)) {
      imageData[bpName] = {};
      if (bpResult.visual?.diffImage) {
        imageData[bpName].diff = bufferToDataUrl(bpResult.visual.diffImage);

        // Also save to disk
        const diffPath = join(outputDir, `diff-${bpName}.png`);
        await writeFile(diffPath, bpResult.visual.diffImage);
        result.artifacts.diffImages[bpName] = diffPath;
      }
    }

    const html = buildHTML(result, imageData);
    const htmlPath = join(outputDir, `report-${result.id}.html`);
    await writeFile(htmlPath, html);

    return htmlPath;
  }
}

function bufferToDataUrl(buf: Buffer): string {
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function severityBadge(severity: string): string {
  const colors: Record<string, string> = {
    critical: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
    pass: "#22c55e",
  };
  const color = colors[severity] || "#6b7280";
  return `<span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase">${severity}</span>`;
}

function buildHTML(
  result: ComparisonResult,
  imageData: Record<string, { diff?: string }>
): string {
  const breakpointTabs = Object.entries(result.breakpoints)
    .map(
      ([name, bp], i) => `
      <button class="tab ${i === 0 ? "active" : ""}" onclick="showTab('${name}', this)">
        ${name} (${bp.breakpoint.width}px)
        ${bp.error ? "⚠️" : bp.styles?.summary.critical ? "🔴" : bp.styles?.summary.warning ? "🟡" : "🟢"}
      </button>`
    )
    .join("");

  const breakpointPanels = Object.entries(result.breakpoints)
    .map(
      ([name, bp], i) => `
      <div class="panel ${i === 0 ? "active" : ""}" id="panel-${name}">
        ${bp.error ? `<div class="error">Error: ${escapeHtml(bp.error)}</div>` : buildBreakpointPanel(name, bp, imageData[name])}
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Selection Comparison Report — ${result.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
  .container { max-width: 1400px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 8px; }
  .meta { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
  .meta a { color: #60a5fa; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .summary-card { background: #1e293b; border-radius: 8px; padding: 16px; }
  .summary-card .label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 28px; font-weight: 700; margin-top: 4px; }
  .tabs { display: flex; gap: 4px; border-bottom: 2px solid #1e293b; margin-bottom: 24px; overflow-x: auto; overflow-y: hidden; }
  .tab { background: none; border: none; color: #94a3b8; padding: 10px 16px; cursor: pointer; font-size: 14px; border-bottom: 2px solid transparent; margin-bottom: -2px; white-space: nowrap; }
  .tab:hover { color: #e2e8f0; }
  .tab.active { color: #60a5fa; border-bottom-color: #60a5fa; }
  .panel { display: none; }
  .panel.active { display: block; }
  .section { background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
  .section h3 { font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .diff-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .diff-table th { text-align: left; padding: 8px 12px; border-bottom: 1px solid #334155; color: #94a3b8; font-weight: 500; }
  .diff-table td { padding: 8px 12px; border-bottom: 1px solid #1e293b; font-family: "SF Mono", Monaco, monospace; font-size: 12px; }
  .diff-table tr:hover { background: #334155; }
  .severity-critical { color: #ef4444; }
  .severity-warning { color: #f59e0b; }
  .severity-info { color: #3b82f6; }
  .diff-img { max-width: 100%; border-radius: 4px; border: 1px solid #334155; }
  .error { background: #451a1a; border: 1px solid #ef4444; border-radius: 8px; padding: 16px; color: #fca5a5; }
  .pixel-stats { display: flex; gap: 24px; margin-bottom: 12px; font-size: 14px; }
  .pixel-stats .stat { color: #94a3b8; }
  .pixel-stats .stat strong { color: #e2e8f0; }
  .category-tag { background: #334155; color: #94a3b8; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
</style>
</head>
<body>
<div class="container">
  <h1>Selection Comparison Report</h1>
  <div class="meta">
    <strong>Source:</strong> <a href="${escapeHtml(result.config.sourceUrl)}">${escapeHtml(result.config.sourceUrl)}</a> · <code>${escapeHtml(result.config.selector)}</code><br>
    <strong>Target:</strong> <a href="${escapeHtml(result.config.targetUrl)}">${escapeHtml(result.config.targetUrl)}</a> · <code>${escapeHtml(result.config.targetSelector ?? result.config.selector)}</code><br>
    <strong>Duration:</strong> ${(result.duration / 1000).toFixed(1)}s ·
    <strong>Generated:</strong> ${result.timestamp}
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Overall</div>
      <div class="value">${severityBadge(result.summary.overallSeverity)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Breakpoints with Differences</div>
      <div class="value">${result.summary.breakpointsWithDifferences}/${result.summary.totalBreakpoints}</div>
    </div>
    <div class="summary-card">
      <div class="label">Style Differences</div>
      <div class="value">${result.summary.totalStyleDifferences}</div>
    </div>
    <div class="summary-card">
      <div class="label">Avg Pixel Diff</div>
      <div class="value">${result.summary.averagePixelDiff}%</div>
    </div>
    <div class="summary-card">
      <div class="label">Worst Breakpoint</div>
      <div class="value" style="font-size:18px">${result.summary.worstBreakpoint ?? "None"}</div>
    </div>
  </div>

  <div class="tabs">${breakpointTabs}</div>
  ${breakpointPanels}
</div>

<script>
function showTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
}
</script>
</body>
</html>`;
}

function buildBreakpointPanel(
  name: string,
  bp: BreakpointResult,
  images?: { diff?: string }
): string {
  let html = "";

  // Visual diff
  if (bp.visual) {
    html += `
    <div class="section">
      <h3>Visual Comparison ${severityBadge(bp.visual.diffPercentage > 5 ? "critical" : bp.visual.diffPercentage > 1 ? "warning" : bp.visual.diffPercentage > 0 ? "info" : "pass")}</h3>
      <div class="pixel-stats">
        <div class="stat">Pixels changed: <strong>${bp.visual.diffPixelCount.toLocaleString()}</strong> / ${bp.visual.totalPixels.toLocaleString()}</div>
        <div class="stat">Diff: <strong>${bp.visual.diffPercentage}%</strong></div>
        <div class="stat">Source size: <strong>${bp.visual.sourceWidth}×${bp.visual.sourceHeight}</strong></div>
        <div class="stat">Target size: <strong>${bp.visual.targetWidth}×${bp.visual.targetHeight}</strong></div>
        ${bp.visual.sizeMismatch ? '<div class="stat severity-warning">⚠ Size mismatch</div>' : ""}
      </div>
      ${images?.diff ? `<img class="diff-img" src="${images.diff}" alt="Visual diff for ${name}">` : ""}
    </div>`;
  }

  // Style diffs
  if (bp.styles && bp.styles.differences.length > 0) {
    html += `
    <div class="section">
      <h3>Style Differences (${bp.styles.summary.total}) ${severityBadge(bp.styles.summary.critical > 0 ? "critical" : bp.styles.summary.warning > 0 ? "warning" : "info")}</h3>
      <table class="diff-table">
        <thead><tr><th>Property</th><th>Category</th><th>Source</th><th>Target</th><th>Severity</th></tr></thead>
        <tbody>
          ${bp.styles.differences
            .map(
              (d) => `
          <tr>
            <td><strong>${escapeHtml(d.property)}</strong></td>
            <td><span class="category-tag">${escapeHtml(d.category)}</span></td>
            <td>${escapeHtml(d.sourceValue)}</td>
            <td>${escapeHtml(d.targetValue)}</td>
            <td class="severity-${d.severity}">${d.severity}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
  } else if (bp.styles) {
    html += `<div class="section"><h3>Style Differences ${severityBadge("pass")}</h3><p style="color:#94a3b8">No style differences found.</p></div>`;
  }

  // Layout diffs
  if (bp.layout && bp.layout.differences.length > 0) {
    html += `
    <div class="section">
      <h3>Layout Differences (${bp.layout.summary.total}) ${severityBadge(bp.layout.summary.critical > 0 ? "critical" : bp.layout.summary.warning > 0 ? "warning" : "info")}</h3>
      <table class="diff-table">
        <thead><tr><th>Property</th><th>Source</th><th>Target</th><th>Diff (px)</th><th>Diff (%)</th><th>Severity</th></tr></thead>
        <tbody>
          ${bp.layout.differences
            .map(
              (d) => `
          <tr>
            <td><strong>${escapeHtml(d.property)}</strong></td>
            <td>${d.sourceValue}px</td>
            <td>${d.targetValue}px</td>
            <td>${d.absoluteDiff > 0 ? "+" : ""}${d.absoluteDiff}px</td>
            <td>${d.percentageDiff > 0 ? "+" : ""}${d.percentageDiff}%</td>
            <td class="severity-${d.severity}">${d.severity}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
  } else if (bp.layout) {
    html += `<div class="section"><h3>Layout Differences ${severityBadge("pass")}</h3><p style="color:#94a3b8">No layout differences found.</p></div>`;
  }

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
