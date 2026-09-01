/**
 * Codex Type Aliases
 *
 * Type aliases for the codex system.
 */

// Type aliases only
export type LetterCategory =
  | "basic" // A-F, G-L, M-R, S-V
  | "extended" // W-Z
  | "greek" // Σ, Δ, Θ, Ω
  | "dash" // W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω-
  | "special" // Φ, Ψ, Λ
  | "dual_dash" // Φ-, Ψ-, Λ-
  | "static"; // α, β, γ

export type CodexTransformationOperation = "rotate" | "mirror" | "handSwap";
