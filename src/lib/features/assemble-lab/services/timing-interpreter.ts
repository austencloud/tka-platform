export type CaptureMode = "inter-press" | "hold-duration";
export type InterpretMode = "proportional" | "absolute" | "quantized";

export interface TimedStepRecord {
  keydownTimestamp: number;
  keyupTimestamp: number;
}

const PROPORTIONAL_TARGET_AVG = 400;
const PROPORTIONAL_MIN = 150;
const PROPORTIONAL_MAX = 2000;
const ABSOLUTE_MIN = 100;
const ABSOLUTE_MAX = 3000;
const QUANTIZE_MIN_SUBDIVISIONS = 1;
const QUANTIZE_MAX_SUBDIVISIONS = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractRawDurations(records: TimedStepRecord[], capture: CaptureMode): number[] {
  if (capture === "hold-duration") {
    return records.map(r => r.keyupTimestamp - r.keydownTimestamp);
  }
  const durations: number[] = [];
  for (let i = 0; i < records.length - 1; i++) {
    durations.push(records[i + 1]!.keydownTimestamp - records[i]!.keydownTimestamp);
  }
  return durations;
}

function applyAbsolute(raw: number[]): number[] {
  return raw.map(d => clamp(d, ABSOLUTE_MIN, ABSOLUTE_MAX));
}

function applyProportional(raw: number[]): number[] {
  if (raw.length === 0) return [];
  const avg = raw.reduce((sum, d) => sum + d, 0) / raw.length;
  if (avg === 0) return raw.map(() => PROPORTIONAL_TARGET_AVG);
  return raw.map(d => {
    const ratio = d / avg;
    return clamp(ratio * PROPORTIONAL_TARGET_AVG, PROPORTIONAL_MIN, PROPORTIONAL_MAX);
  });
}

function applyQuantized(raw: number[], bpm: number, subdivision: number): number[] {
  const subdivisionMs = (60_000 / bpm) / (subdivision / 4);
  return raw.map(d => {
    const subdivisions = Math.round(d / subdivisionMs);
    const clamped = clamp(subdivisions, QUANTIZE_MIN_SUBDIVISIONS, QUANTIZE_MAX_SUBDIVISIONS);
    return clamped * subdivisionMs;
  });
}

export function computeDurations(
  records: TimedStepRecord[],
  capture: CaptureMode,
  interpret: InterpretMode,
  bpm: number = 120,
  subdivision: number = 8,
): number[] {
  const raw = extractRawDurations(records, capture);
  switch (interpret) {
    case "absolute": return applyAbsolute(raw);
    case "proportional": return applyProportional(raw);
    case "quantized": return applyQuantized(raw, bpm, subdivision);
  }
}
