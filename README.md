# pixelprobe

Responsive visual & style diff for web page sections — CLI + MCP.

## What it does

You're rebuilding a section from a live website. You want to know: does my local build match the original? Where are the styling differences? At which breakpoints do things break?

`pixelprobe` answers this by comparing **computed styles**, **layout metrics**, and **pixel-level screenshots** between a source URL and a target URL, across multiple responsive breakpoints.

It works on any element — full page sections, individual cards, buttons, navbars, footers, or any element you can target with a CSS selector.

## Install

```bash
npm install -g pixelprobe

# Or use directly with npx
npx pixelprobe compare --help
```

Requires Node.js 18+. On first run, Playwright will download a Chromium binary (~110MB) if one isn't already installed. You can also install it manually:

```bash
npx playwright install chromium
```

## Quick Start

```bash
# Compare a hero section between production and your local build
pixelprobe compare \
  --source https://example.com \
  --target http://localhost:3000 \
  --selector ".hero-section"
```

This will compare the `.hero-section` element at 4 default breakpoints (mobile, tablet, desktop, desktop-lg) and output a color-coded terminal report plus HTML and JSON reports.

## CLI Usage

### `pixelprobe compare`

The main command. Compares a section between two URLs across breakpoints.

```bash
pixelprobe compare \
  --source <url> \
  --target <url> \
  --selector <css-selector> \
  [options]
```

#### Options

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--source` | `-s` | Source URL (the reference/original page) | required |
| `--target` | `-t` | Target URL (your local build or new version) | required |
| `--selector` | `-S` | CSS selector for the section on the source page | required |
| `--target-selector` | `-T` | CSS selector on the target page (if different from source) | same as `--selector` |
| `--index` | `-i` | Element index if selector matches multiple elements | `0` |
| `--breakpoints` | `-b` | Comma-separated breakpoint names or `WIDTHxHEIGHT` | `mobile,tablet,desktop,desktop-lg` |
| `--output` | `-o` | Output directory for reports | `./pixelprobe-output` |
| `--format` | `-f` | Output format: `json`, `html`, or `both` | `both` |
| `--threshold` | | Pixel comparison sensitivity (0-1, lower = stricter) | `0.1` |
| `--wait` | `-w` | Wait N milliseconds after page load before capturing | `0` |
| `--json` | | Output compact JSON to stdout (for piping to other tools) | `false` |
| `--headed` | | Run browser in visible (non-headless) mode | `false` |
| `--no-visual` | | Skip pixel-level visual comparison | `false` |
| `--no-styles` | | Skip computed style comparison | `false` |
| `--no-layout` | | Skip layout metrics comparison | `false` |

### `pixelprobe enumerate`

List all elements matching a selector on a page. Useful when your selector matches multiple elements and you need to find the right `--index`.

```bash
pixelprobe enumerate --url <url> --selector <css-selector>
```

Example output:

```
Found 3 element(s) matching ".card":

  [0] <div> (320×200 at 32,400) — "Pricing Plan A..."
  [1] <div> (320×200 at 384,400) — "Pricing Plan B..."
  [2] <div> (320×200 at 736,400) — "Pricing Plan C..."

Use --index N with the compare command to select a specific element.
```

### `pixelprobe breakpoints`

List all available breakpoint presets.

```
Available breakpoint presets:

  mobile-sm      320×568   Mobile Small
  mobile         375×812   Mobile
  mobile-lg      428×926   Mobile Large
  tablet         768×1024  Tablet
  tablet-lg      1024×1366 Tablet Large
  desktop        1280×800  Desktop
  desktop-lg     1920×1080 Desktop Large
  desktop-xl     2560×1440 Desktop XL
```

Custom breakpoints use `WIDTHxHEIGHT` format and can be mixed with presets:

```bash
--breakpoints "mobile,tablet,1440x900,1920x1080"
```

## Examples

### Compare a header with different selectors on each site

When source and target use different markup (e.g. WordPress vs a custom build):

```bash
pixelprobe compare \
  --source "https://mysite.com" \
  --target "http://localhost:3000" \
  --selector "#masthead" \
  --target-selector "header" \
  --breakpoints "384x812,768x1024,1024x1366,1280x800,1440x900,1920x1080" \
  --wait 3000
```

### Compare a specific card in a grid

```bash
# First, find which index your card is at
pixelprobe enumerate --url https://mysite.com --selector ".pricing-card"

# Then compare the 2nd card (index 1)
pixelprobe compare \
  --source "https://mysite.com" \
  --target "http://localhost:3000" \
  --selector ".pricing-card" \
  --index 1
```

### Pipe JSON output to another tool

```bash
# Get machine-readable output for CI/CD
pixelprobe compare \
  --source "https://mysite.com" \
  --target "http://localhost:3000" \
  --selector ".hero" \
  --json | jq '.summary'
```

Exit codes: `0` = no differences (pass), `1` = differences found, `2` = error.

### Compare with strict pixel matching

```bash
pixelprobe compare \
  --source "https://mysite.com" \
  --target "http://localhost:3000" \
  --selector ".hero" \
  --threshold 0.05
```

### Style-only comparison (skip screenshots)

```bash
pixelprobe compare \
  --source "https://mysite.com" \
  --target "http://localhost:3000" \
  --selector ".footer" \
  --no-visual
```

## Output

Each run creates a timestamped directory inside your output folder:

```
pixelprobe-output/
├── run_2026-03-25_14-30-22_a1b2c3d4/
│   ├── comparison-a1b2c3d4.json      # Full JSON report
│   ├── report-a1b2c3d4.html          # Interactive HTML report
│   ├── diff-mobile.png               # Visual diff per breakpoint
│   ├── diff-tablet.png
│   ├── diff-desktop.png
│   └── diff-desktop-lg.png
├── run_2026-03-25_15-10-45_e5f6g7h8/
│   └── ...
```

### Console output

Color-coded terminal output with severity indicators (critical, warning, info) for each breakpoint. Shows style property diffs, layout dimension changes, and pixel diff percentages.

### HTML report

Self-contained interactive report with breakpoint tabs, visual diff images, collapsible style diff tables, and layout comparison tables. Open directly in a browser.

### JSON report

Machine-readable diff data. Includes per-breakpoint style differences, layout deviations, pixel diff metrics, and summary statistics. Useful for CI/CD integration and automated pipelines.

## What it compares

### Style Comparison

Extracts `getComputedStyle()` for layout-critical CSS properties organized into categories: layout, flexbox, grid, spacing, sizing, typography, colors, borders, effects, and positioning.

Each difference is classified by severity based on visual impact:

- **Critical** — display, position, width, height, flex-direction, grid-template, font-size, visibility
- **Warning** — margin, padding, font-family, font-weight, color, background-color, border, gap, alignment
- **Info** — everything else (transitions, animations, minor effects)

### Pixel Comparison

Uses [pixelmatch](https://github.com/mapbox/pixelmatch) for pixel-level screenshot comparison. Generates diff images highlighting changed pixels in red. Handles size mismatches by padding the smaller image with magenta so dimensional differences are immediately visible.

### Layout Comparison

Compares the box model: bounding box dimensions, margin, padding, border widths, and scroll dimensions. Reports both absolute (px) and percentage deviations. Thresholds: 10px+ = critical, 3px+ = warning.

## MCP Server (for AI Agents)

`pixelprobe` includes an MCP (Model Context Protocol) server so AI agents can use it as a tool.

### Setup

Add to your Claude Desktop or Claude Code MCP config:

```json
{
  "mcpServers": {
    "pixelprobe": {
      "command": "node",
      "args": ["/path/to/pixelprobe/dist/mcp/server.js"]
    }
  }
}
```

### MCP Tools

#### `compare_sections`

Full comparison across breakpoints. Accepts `sourceUrl`, `targetUrl`, `selector`, `targetSelector`, `breakpoints`, `pixelThreshold`, and other options. Returns structured JSON diff and saves HTML/JSON reports.

#### `capture_section`

Inspect and enumerate elements matching a selector on a page. Useful for discovering element structure before running a comparison.

#### `list_breakpoints`

Returns all available breakpoint presets with their dimensions.

## Programmatic API

```typescript
import { WebSectionComparator } from 'pixelprobe';

const comparator = new WebSectionComparator({ headless: true });

const result = await comparator.compare({
  sourceUrl: 'https://example.com',
  targetUrl: 'http://localhost:3000',
  selector: '.hero-section',
  targetSelector: '.hero',         // optional, if target uses different markup
  breakpoints: ['mobile', 'tablet', 'desktop'],
  pixelThreshold: 0.1,
});

console.log(result.summary);
// {
//   overallSeverity: 'warning',
//   totalBreakpoints: 3,
//   breakpointsWithDifferences: 2,
//   totalStyleDifferences: 12,
//   totalLayoutDifferences: 4,
//   averagePixelDiff: 3.5,
//   worstBreakpoint: 'mobile'
// }

// Enumerate elements before comparing
const elements = await comparator.enumerate('https://example.com', '.card');
// [{ index: 0, tagName: 'div', textPreview: '...', boundingBox: {...} }, ...]
```

## Tips

- **Use `--wait`** for sites with animations, lazy-loading, or web fonts. 2000-3000ms is usually enough.
- **Use `--headed`** to watch the browser and debug selector issues.
- **Use `--target-selector`** when source and target have different markup (e.g. WordPress vs a custom React build).
- **Use `enumerate`** first when you're unsure which element your selector is matching.
- **Use `--no-visual`** to speed things up if you only care about computed style differences.
- **Custom breakpoints** let you test at the exact widths your design uses: `--breakpoints "375x812,768x1024,1440x900"`.

## Contributing

Contributions are welcome! Here's how to get started:

### Setup

```bash
git clone https://github.com/user/pixelprobe.git
cd pixelprobe
npm install
npx playwright install chromium
```

### Development

```bash
# Type-check
npx tsc --noEmit

# Build
npx tsc

# Run CLI during development
node dist/bin/pixelprobe.js compare --help

# Run tests
npm test
```

### Project Structure

```
src/
├── types/           # TypeScript interfaces (config, comparison results)
├── browser/         # Playwright browser lifecycle and viewport management
├── extractor/       # Section selection, style extraction, screenshots
├── comparator/      # Style diff, pixel diff, layout diff, aggregation
├── reporter/        # JSON and HTML report generation
├── cli/             # Terminal output formatting
├── mcp/             # MCP server (tools and handlers)
├── bin/             # CLI entry point
├── core.ts          # Main orchestrator
└── index.ts         # Public API exports
```

### Guidelines

- Keep it dependency-light. The core should only need Playwright and pixelmatch.
- All comparison logic lives in `src/comparator/`. Reporters just format what comparators produce.
- Add types to `src/types/` before implementing. The types are the contract.
- Test with real URLs when possible — CSS rendering has endless edge cases.
- CLI and MCP are thin wrappers over `core.ts`. Don't put business logic in them.

### Reporting Issues

When filing a bug, please include:

- The full command you ran
- The error message or unexpected output
- Your Node.js version (`node --version`)
- Your OS

## Roadmap

- [ ] Pseudo-state comparison (hover, focus, active)
- [ ] Watch mode for live development
- [ ] CI/CD integration examples (GitHub Actions, GitLab CI)
- [ ] Side-by-side source/target screenshots in HTML report
- [ ] Config file support (`.pixelproberc.json`)
- [ ] Accessibility attribute comparison
- [ ] Performance metrics comparison (LCP, CLS)

## License

MIT License — see [LICENSE](LICENSE) for details.
