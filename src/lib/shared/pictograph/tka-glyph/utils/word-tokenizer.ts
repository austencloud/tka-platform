/**
 * Split a TKA sequence word string into individual letter tokens.
 *
 * Handles: ASCII (A-Z), Greek (Σ, Δ, Θ, Ω, μ, ν, α, β, γ, ζ, η, τ, ⊕, Φ, Ψ, Λ),
 * and dash letters (W-, Σ-, Φ-, τ-, etc.).
 *
 * A dash immediately following any character is treated as part of that
 * character's token (Type 3/5 letter notation).
 */
export function tokenizeWord(word: string): string[] {
  const tokens: string[] = [];
  const chars = [...word]; // Unicode-aware split
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (chars[i + 1] === "-") {
      tokens.push(ch + "-");
      i += 2;
    } else {
      tokens.push(ch);
      i += 1;
    }
  }
  return tokens;
}
