export function getAlphabetOverview(): string {
  return `## The Kinetic Alphabet Overview

The TKA alphabet has **47 letters** organized into **6 types** by motion pattern:

| Type | Name | Motion Pattern | Count | Letters |
|------|------|----------------|-------|---------|
| 1 | Dual-Shift | Both hands shift | 22 | A-V |
| 2 | Shift | One shifts, one static | 8 | W, X, Y, Z, Σ, Δ, Θ, Ω |
| 3 | Cross-Shift | One shifts, one dashes | 8 | W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω- |
| 4 | Dash | One dashes, one static | 3 | Φ, Ψ, Λ |
| 5 | Dual-Dash | Both hands dash | 3 | Φ-, Ψ-, Λ- |
| 6 | Static | Both hands stationary | 3 | α, β, γ |

**Key insight:** Types are defined by the specific motion types (shift, dash, static), not by whether hands "move" or "stay still."

**Naming convention:** The "-" suffix (like W- or Φ-) indicates Type 3 or Type 5 letters. It's a naming convention, not a description of dash motion.`;
}
