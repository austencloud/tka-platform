export type CompoundCategory = "type1-beta-alpha" | "gamma-internal" | "type4-dash";

export interface CompoundLetter {
  components: [string, string];
  mnemonic: string | null;
  category: CompoundCategory;
  description: string;
  rotationStyle: string;
  transitionPattern: string;
  vtgNote?: string;
}

export interface CompoundCategoryInfo {
  name: string;
  description: string;
  compounds: string[];
}
