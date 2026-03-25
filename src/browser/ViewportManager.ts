import {
  PRESET_BREAKPOINTS,
  type Breakpoint,
  type PresetBreakpointName,
} from "../types/config.js";

const DEFAULT_BREAKPOINT_NAMES: PresetBreakpointName[] = [
  "mobile",
  "tablet",
  "desktop",
  "desktop-lg",
];

export class ViewportManager {
  /**
   * Resolve breakpoint names (preset or custom) to Breakpoint objects.
   */
  static resolve(
    breakpointNames?: string[],
    customBreakpoints?: Record<string, { width: number; height: number }>
  ): Breakpoint[] {
    const names = breakpointNames ?? DEFAULT_BREAKPOINT_NAMES;
    const resolved: Breakpoint[] = [];

    for (const name of names) {
      // Check custom breakpoints first
      if (customBreakpoints && name in customBreakpoints) {
        const custom = customBreakpoints[name];
        resolved.push({
          name,
          width: custom.width,
          height: custom.height,
          label: name,
        });
        continue;
      }

      // Check preset breakpoints
      if (name in PRESET_BREAKPOINTS) {
        const preset =
          PRESET_BREAKPOINTS[name as PresetBreakpointName];
        resolved.push({
          name,
          width: preset.width,
          height: preset.height,
          label: preset.label,
        });
        continue;
      }

      // Try parsing "WIDTHxHEIGHT" format (e.g. "1440x900")
      const match = name.match(/^(\d+)x(\d+)$/);
      if (match) {
        resolved.push({
          name,
          width: parseInt(match[1], 10),
          height: parseInt(match[2], 10),
          label: `${match[1]}×${match[2]}`,
        });
        continue;
      }

      throw new Error(
        `Unknown breakpoint "${name}". Available presets: ${Object.keys(
          PRESET_BREAKPOINTS
        ).join(", ")}. Or use WIDTHxHEIGHT format (e.g. 1440x900).`
      );
    }

    return resolved;
  }

  /**
   * List all available preset breakpoints.
   */
  static listPresets(): Breakpoint[] {
    return Object.entries(PRESET_BREAKPOINTS).map(([name, bp]) => ({
      name,
      width: bp.width,
      height: bp.height,
      label: bp.label,
    }));
  }
}
