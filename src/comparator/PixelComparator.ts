import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import type { PixelComparisonResult } from "../types/comparison.js";

export class PixelComparator {
  /**
   * Compare two screenshots pixel-by-pixel.
   * Handles size mismatches by padding the smaller image.
   */
  static compare(
    sourceBuffer: Buffer,
    targetBuffer: Buffer,
    threshold: number = 0.1
  ): PixelComparisonResult {
    const sourcePng = PNG.sync.read(sourceBuffer);
    const targetPng = PNG.sync.read(targetBuffer);

    const sizeMismatch =
      sourcePng.width !== targetPng.width ||
      sourcePng.height !== targetPng.height;

    // Use the larger dimensions for comparison canvas
    const width = Math.max(sourcePng.width, targetPng.width);
    const height = Math.max(sourcePng.height, targetPng.height);

    // Pad images to same size if needed
    const sourceData = sizeMismatch
      ? padImage(sourcePng, width, height)
      : sourcePng.data;
    const targetData = sizeMismatch
      ? padImage(targetPng, width, height)
      : targetPng.data;

    // Create diff image buffer
    const diffPng = new PNG({ width, height });

    const diffPixelCount = pixelmatch(
      sourceData,
      targetData,
      diffPng.data,
      width,
      height,
      {
        threshold,
        includeAA: false, // ignore anti-aliasing differences
        alpha: 0.3,
        diffColor: [255, 0, 0], // red for differences
        diffColorAlt: [0, 255, 0], // green for anti-aliased diffs
      }
    );

    const totalPixels = width * height;

    return {
      diffPixelCount,
      totalPixels,
      diffPercentage: Math.round((diffPixelCount / totalPixels) * 10000) / 100,
      diffImage: PNG.sync.write(diffPng),
      sourceWidth: sourcePng.width,
      sourceHeight: sourcePng.height,
      targetWidth: targetPng.width,
      targetHeight: targetPng.height,
      sizeMismatch,
    };
  }
}

/**
 * Pad an image to a target size, filling extra space with transparent magenta
 * so size differences are visually obvious in the diff.
 */
function padImage(
  png: PNG,
  targetWidth: number,
  targetHeight: number
): Uint8Array {
  const data = new Uint8Array(targetWidth * targetHeight * 4);

  // Fill with magenta (indicates missing area)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; // R
    data[i + 1] = 0; // G
    data[i + 2] = 255; // B
    data[i + 3] = 255; // A
  }

  // Copy original image data
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const srcIdx = (y * png.width + x) * 4;
      const dstIdx = (y * targetWidth + x) * 4;
      data[dstIdx] = png.data[srcIdx];
      data[dstIdx + 1] = png.data[srcIdx + 1];
      data[dstIdx + 2] = png.data[srcIdx + 2];
      data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }

  return data;
}
