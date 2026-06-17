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
    tkaLetters: ["S", "T", "U", "V"],
    explanation: "Hands at right angle (gamma), both shift same direction, end at right angle (gamma).",
  },
  "quarter-opp": {
    vtgTerm: "Quarter-Opp",
    tkaLetters: ["M", "N", "O", "P", "Q", "R"],
    explanation: "Hands at right angle (gamma), both shift opposite directions, end at right angle (gamma).",
  },
  // Elemental model mappings (aliases for the VTG categories)
  "earth": {
    vtgTerm: "Earth (Tog-Same)",
    tkaLetters: ["G", "H", "I"],
    explanation: "Together time, same direction. Both hands at same point, arcing the same way. The element of solidity. Grid-mode invariant.",
  },
  "water": {
    vtgTerm: "Water (Split-Same)",
    tkaLetters: ["A", "B", "C"],
    explanation: "Split time, same direction. Hands at opposite points, arcing the same way. The flowing element. Grid-mode invariant.",
  },
  "air": {
    vtgTerm: "Air (Tog-Opp)",
    tkaLetters: ["D", "E", "F"],
    explanation: "Together time, opposite direction. Hands at same point, arcing opposite ways. Light and open. Grid-mode dependent: becomes Moon in box mode.",
  },
  "fire": {
    vtgTerm: "Fire (Split-Opp)",
    tkaLetters: ["J", "K", "L"],
    explanation: "Split time, opposite direction. Hands at opposite points, arcing opposite ways. Chaotic. Grid-mode dependent: becomes Moon in box mode.",
  },
  "sun": {
    vtgTerm: "Sun (Quarter-Same)",
    tkaLetters: ["S", "T", "U", "V"],
    explanation: "Quarter time, same direction. Hands at 90-degree offset, arcing the same way. Constant rotation, always shining. Grid-mode invariant. Added by Austen Cloud.",
  },
  "moon": {
    vtgTerm: "Moon (Quarter-Opp)",
    tkaLetters: ["M", "N", "O", "P", "Q", "R"],
    explanation: "Quarter time, opposite direction. Hands at 90-degree offset, arcing opposite ways. Opens and closes like lunar phases. Grid-mode dependent: becomes Air/Fire in box mode. Added by Austen Cloud.",
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
