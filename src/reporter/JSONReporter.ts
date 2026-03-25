import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { ComparisonResult } from "../types/comparison.js";

export class JSONReporter {
  /**
   * Generate a JSON report file.
   * Strips binary data (screenshots, diff images) and replaces with file paths.
   */
  static async generate(
    result: ComparisonResult,
    outputDir: string
  ): Promise<string> {
    await mkdir(outputDir, { recursive: true });

    // Save diff images as separate files
    const artifacts = { ...result.artifacts };

    for (const [bpName, bpResult] of Object.entries(result.breakpoints)) {
      if (bpResult.visual?.diffImage) {
        const diffPath = join(outputDir, `diff-${bpName}.png`);
        await writeFile(diffPath, bpResult.visual.diffImage);
        artifacts.diffImages[bpName] = diffPath;
      }
    }

    // Create a serializable version (strip Buffers)
    const serializable = JSONReporter.toSerializable(result);
    serializable.artifacts = artifacts;

    const jsonPath = join(outputDir, `comparison-${result.id}.json`);
    await writeFile(jsonPath, JSON.stringify(serializable, null, 2));

    return jsonPath;
  }

  /**
   * Convert result to a JSON-safe object (no Buffers).
   */
  static toSerializable(result: ComparisonResult): any {
    const clone = structuredClone({
      ...result,
      breakpoints: Object.fromEntries(
        Object.entries(result.breakpoints).map(([name, bp]) => [
          name,
          {
            ...bp,
            visual: bp.visual
              ? {
                  ...bp.visual,
                  diffImage: undefined, // strip Buffer
                  diffImageBase64: undefined,
                }
              : undefined,
          },
        ])
      ),
    });

    return clone;
  }

  /**
   * Generate a compact JSON summary (no per-property details).
   */
  static toCompactSummary(result: ComparisonResult): object {
    return {
      id: result.id,
      timestamp: result.timestamp,
      config: result.config,
      summary: result.summary,
      breakpoints: Object.fromEntries(
        Object.entries(result.breakpoints).map(([name, bp]) => [
          name,
          {
            breakpoint: bp.breakpoint,
            error: bp.error,
            styleDiffs: bp.styles?.summary,
            layoutDiffs: bp.layout?.summary,
            pixelDiff: bp.visual
              ? {
                  percentage: bp.visual.diffPercentage,
                  sizeMismatch: bp.visual.sizeMismatch,
                }
              : undefined,
            duration: bp.duration,
          },
        ])
      ),
      duration: result.duration,
    };
  }
}
