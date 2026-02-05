/**
 * VTG Quiz data constants
 */

export type VTGMode = "SS" | "TS" | "SO" | "TO" | "QS" | "QO";

export interface VTGModeConfig {
  mode: VTGMode;
  name: string;
  color: string;
}

export const VTG_MODES: VTGModeConfig[] = [
  { mode: "SS", name: "Split-Same", color: "#22D3EE" },
  { mode: "TS", name: "Together-Same", color: "#4ADE80" },
  { mode: "SO", name: "Same-Opposite", color: "#F472B6" },
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

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function getModeInfo(mode: VTGMode): VTGModeConfig {
  return VTG_MODES.find((v) => v.mode === mode)!;
}
