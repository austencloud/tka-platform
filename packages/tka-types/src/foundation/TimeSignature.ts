export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export const TIME_SIGNATURES = {
  "4/4": { numerator: 4, denominator: 4 },
  "3/4": { numerator: 3, denominator: 4 },
  "6/8": { numerator: 6, denominator: 8 },
} as const;

export type TimeSignatureKey = keyof typeof TIME_SIGNATURES;
export const DEFAULT_TIME_SIGNATURE: TimeSignatureKey = "4/4";
