export type InversionPair = [string, string];

export interface CompoundPair {
  letters: [string, string];
  mnemonic: string | null;
  rotation: string;
}

export interface CounterpartPair {
  letters: [string, string];
  note: string;
}

export interface CounterpartSubType {
  description: string;
  pairs: CounterpartPair[];
}

export interface GammaInternalGroup {
  description: string;
  note: string;
  groups: Record<string, string[]>;
}
