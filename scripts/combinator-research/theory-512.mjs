// Austen's hypothesis (2026-08-05): for any pair of base sequences, the number
// of distinct combination words inside a fixed box is consistently 512.
// Box held identical for every pair: unit <= 6 steps, <= 2 connectors, diamond.

// The enumeration core moved to enumerate.mjs (2026-08-05) so this oracle and
// the class-prediction harness share one implementation. Behaviour unchanged:
// A+G must still report 256.
import { countPair as count } from "./enumerate.mjs";

const CARDS = {
  "A (α pro same)": ["A"],
  "B (α anti same)": ["B"],
  "C (α hybrid same)": ["C"],
  "G (β pro same)": ["G"],
  "H (β anti same)": ["H"],
  "I (β hybrid same)": ["I"],
  "S (γ pro same)": ["S"],
  "T (γ anti same)": ["T"],
  "DJ (opp pro)": ["D", "J"],
  "EK (opp anti)": ["E", "K"],
  "FL (opp hybrid)": ["F", "L"],
  "ΦΨ (dash)": ["Φ", "Ψ"],
  "MP (γ opp pro)": ["M", "P"],
  "NQ (γ opp anti)": ["N", "Q"],
};

const PAIRS = [
  ["A (α pro same)", "G (β pro same)"],
  ["B (α anti same)", "H (β anti same)"],
  ["A (α pro same)", "H (β anti same)"],
  ["B (α anti same)", "G (β pro same)"],
  ["C (α hybrid same)", "I (β hybrid same)"],
  ["A (α pro same)", "B (α anti same)"],
  ["G (β pro same)", "H (β anti same)"],
  ["A (α pro same)", "S (γ pro same)"],
  ["G (β pro same)", "S (γ pro same)"],
  ["S (γ pro same)", "T (γ anti same)"],
  ["A (α pro same)", "DJ (opp pro)"],
  ["G (β pro same)", "EK (opp anti)"],
  ["A (α pro same)", "FL (opp hybrid)"],
  ["A (α pro same)", "ΦΨ (dash)"],
  ["G (β pro same)", "ΦΨ (dash)"],
  ["DJ (opp pro)", "EK (opp anti)"],
  ["DJ (opp pro)", "FL (opp hybrid)"],
  ["S (γ pro same)", "MP (γ opp pro)"],
  ["MP (γ opp pro)", "NQ (γ opp anti)"],
];

console.log("box: unit <= 6 steps, <= 2 connectors, diamond, both cards required\n");
console.log("pair".padEnd(38) + "words   reps    closed     by length");
console.log("-".repeat(96));
for (const [a, b] of PAIRS) {
  const t0 = Date.now();
  const r = count({ lettersA: CARDS[a], lettersB: CARDS[b] });
  const lens = Object.entries(r.byLen).sort((x, y) => x[0] - y[0]).map(([k, v]) => `${k}:${v}`).join(" ");
  console.log(
    `${(a + "  +  " + b).padEnd(38)}${String(r.words).padStart(5)}  ${String(r.reps).padStart(6)}  ${String(r.closed).padStart(8)}     ${lens}   (${((Date.now() - t0) / 1000).toFixed(1)}s)`
  );
}
