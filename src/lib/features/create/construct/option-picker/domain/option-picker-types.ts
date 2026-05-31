import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

// ===== Basic State Types =====
export type OptionPickerState = "loading" | "ready" | "error";

// ===== Sort and Filter Types =====
export type SortMethod = "type" | "endPosition" | "reversals";

// ===== Type Filter Types =====
export type TypeFilter = {
  type1: boolean; // Dual-Shift (A-V)
  type2: boolean; // Shift (W, X, Y, Z, Σ, Δ, Θ, Ω)
  type3: boolean; // Cross-Shift (W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω-)
  type4: boolean; // Dash (Φ, Ψ, Λ)
  type5: boolean; // Dual-Dash (Φ-, Ψ-, Λ-)
  type6: boolean; // Static (α, β, γ)
};

// Type for end position filter
export type EndPositionFilter = {
  alpha: boolean;
  beta: boolean;
  gamma: boolean;
};

// Type for reversal filter
export type ReversalFilter = {
  continuous: boolean;
  "1-reversal": boolean;
  "2-reversals": boolean;
};
export type OrganizedSection = {
  title: string;
  pictographs: PictographData[];
  type: "section" | "grouped";
};
