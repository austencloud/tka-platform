/**
 * Classifies TKA letters into their type (1-6).
 *
 * The six types correspond to distinct hand-path families:
 *   Type 1: Dual-Shift (A-V) — both hands shift
 *   Type 2: Shift (W, X, Y, Z, Σ, Δ, Θ, Ω, μ, ν) — one hand shifts, one dashes
 *   Type 3: Cross-Shift (W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω-) — shift with cross
 *   Type 4: Dash (Φ, Ψ, Λ, τ-) — one hand dashes, one is static
 *   Type 5: Dual-Dash (Φ-, Ψ-, Λ-) — both hands dash
 *   Type 6: Static (α, β, γ) — no hand movement
 *
 * The Type 6 map below also carries ζ, η, τ and ⊕, which are NOT alphabet
 * letters — the canonical set is α, β, γ (packages/domain letter-registry).
 * Those four are the placeholder statics BeamSearch.staticLetterForPosition
 * fabricates for zeta, eta, tau and terra positions when the pictograph data
 * holds no real static there. They are listed so isType6 recognises what the
 * generator itself can emit.
 */
export class LetterClassifier {
  private readonly typeMap: Map<string, number>;

  constructor() {
    this.typeMap = new Map();

    // Type 1: Dual-Shift
    for (const l of "ABCDEFGHIJKLMNOPQRSTUV".split("")) {
      this.typeMap.set(l, 1);
    }

    // Type 2: Shift
    for (const l of ["W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω", "μ", "ν"]) {
      this.typeMap.set(l, 2);
    }

    // Type 3: Cross-Shift
    for (const l of ["W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-"]) {
      this.typeMap.set(l, 3);
    }

    // Type 4: Dash
    for (const l of ["Φ", "Ψ", "Λ", "τ-"]) {
      this.typeMap.set(l, 4);
    }

    // Type 5: Dual-Dash
    for (const l of ["Φ-", "Ψ-", "Λ-"]) {
      this.typeMap.set(l, 5);
    }

    // Type 6: Static
    for (const l of ["α", "β", "γ", "ζ", "η", "τ", "⊕"]) {
      this.typeMap.set(l, 6);
    }
  }

  getType(letter: string): number | undefined {
    return this.typeMap.get(letter);
  }

  /** Type 6 letters are static — no hand movement, special handling required */
  isType6(letter: string): boolean {
    return this.getType(letter) === 6;
  }
}
