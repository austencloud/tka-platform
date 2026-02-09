import type { VTGMapping } from "../types/vtg.js";

export const VTG_MAPPINGS: Record<string, VTGMapping> = {
  "split-same": {
    vtgTerm: "Split-Same",
    tkaLetters: ["A", "B", "C"],
    explanation: "Hands at opposite points (alpha), both shift, end at opposite points (alpha).",
  },
  "tog-same": {
    vtgTerm: "Tog-Same (Together-Same)",
    tkaLetters: ["G", "H", "I"],
    explanation: "Hands at same point (beta), both shift, end at same point (beta).",
  },
  "split-opp": {
    vtgTerm: "Split-Opp",
    tkaLetters: ["J", "K", "L"],
    explanation: "Hands at opposite points (alpha), both shift, end at same point (beta).",
  },
  "tog-opp": {
    vtgTerm: "Tog-Opp (Together-Opp)",
    tkaLetters: ["D", "E", "F"],
    explanation: "Hands at same point (beta), both shift, end at opposite points (alpha).",
  },
  "quarter-same": {
    vtgTerm: "Quarter-Same",
    tkaLetters: ["S", "T"],
    explanation: "Hands at right angle (gamma), both shift same direction, end at right angle (gamma).",
  },
  "quarter-opp": {
    vtgTerm: "Quarter-Opp",
    tkaLetters: ["M", "N", "O", "P", "Q", "R"],
    explanation: "Hands at right angle (gamma), both shift opposite directions, end at right angle (gamma).",
  },
};

export function getVTGMapping(vtgTerm: string): string {
  const key = vtgTerm.toLowerCase().replace(/[^a-z]/g, "-").trim();
  let mapping: VTGMapping | undefined;
  for (const [k, v] of Object.entries(VTG_MAPPINGS)) {
    if (k.includes(key) || key.includes(k) || v.vtgTerm.toLowerCase().includes(key)) {
      mapping = v;
      break;
    }
  }
  if (!mapping) {
    const validTerms = Object.values(VTG_MAPPINGS).map(m => m.vtgTerm).join(", ");
    return `VTG term "${vtgTerm}" not recognized. Known terms: ${validTerms}`;
  }
  return `## VTG: ${mapping.vtgTerm}\n\n**TKA Letters:** ${mapping.tkaLetters.join(", ")}\n\n**Explanation:** ${mapping.explanation}\n\nAll these letters are Type 1 (Dual-Shift) - both hands shift.`;
}
