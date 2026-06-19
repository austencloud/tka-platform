/**
 * VTG Quiz data constants
 */

// Canonical source for VTGMode + shuffleArray. Re-exported here so existing
// importers of vtg-quiz-data keep working.
export { shuffleArray, type VTGMode } from "./shared-types";
import type { VTGMode } from "./shared-types";

export interface VTGModeConfig {
  mode: VTGMode;
  name: string;
  color: string;
}

export const VTG_MODES: VTGModeConfig[] = [
  { mode: "SS", name: "Split-Same", color: "#22D3EE" },
  { mode: "TS", name: "Together-Same", color: "#4ADE80" },
  { mode: "SO", name: "Split-Opposite", color: "#F472B6" },
  { mode: "TO", name: "Together-Opposite", color: "#FB923C" },
  { mode: "QS", name: "Quarter-Same", color: "#A78BFA" },
  { mode: "QO", name: "Quarter-Opposite", color: "#F59E0B" },
];

export const VTG_QUESTIONS: VTGMode[] = [
  "SS",
  "TS",
  "SO",
  "TO",
  "QS",
  "QO",
  "SS",
  "TS",
  "SO",
  "TO",
  "QS",
  "QO",
];

export function getModeInfo(mode: VTGMode): VTGModeConfig {
  return VTG_MODES.find((v) => v.mode === mode)!;
}
