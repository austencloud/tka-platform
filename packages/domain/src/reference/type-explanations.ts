import type { LetterTypeNumber } from "../types/letter.js";
import { PRECISE_QUARTER_SAME_EXPLANATION } from "./rotation-invariant.js";

export interface TypeDefinition {
  type: number;
  name: string;
  description: string;
  motionPattern: {
    left: string;
    right: string;
  };
  letterCount: number;
  letters: string;
  registeredExtensions?: string;
  keyFact: string;
  rotationPattern?: {
    description: string;
    groups: Array<{
      letters: string;
      pattern: string;
    }>;
    note?: string;
    uvExplanation?: string;
  };
}

export const TYPE_DEFINITIONS: Record<number, TypeDefinition> = {
  1: {
    type: 1,
    name: "Dual-Shift",
    description: "Both hands shift (move to adjacent grid points).",
    motionPattern: { left: "shift", right: "shift" },
    letterCount: 22,
    letters: "A through V",
    keyFact: "The largest type. Both hands shift - this is what defines it, not just that both move.",
    rotationPattern: {
      description: "Type 1 letters follow the 'pattern of three' based on prop rotation: pro, anti, hybrid.",
      groups: [
        { letters: "ABC", pattern: "pro, anti, hybrid" },
        { letters: "DEF", pattern: "pro, anti, hybrid" },
        { letters: "GHI", pattern: "pro, anti, hybrid" },
        { letters: "JKL", pattern: "pro, anti, hybrid" },
        { letters: "MNO", pattern: "pro, anti, hybrid" },
        { letters: "PQR", pattern: "pro, anti, hybrid" },
        { letters: "STUV", pattern: "pro, anti, hybrid, hybrid" },
      ],
      note: "Quarter-Same (S, T, U, V) has 4 letters; every other group has 3. See uvExplanation.",
      uvExplanation: PRECISE_QUARTER_SAME_EXPLANATION,
    },
  },
  2: {
    type: 2,
    name: "Shift",
    description: "One hand shifts while the other remains static.",
    motionPattern: { left: "static OR shift", right: "shift OR static" },
    letterCount: 8,
    letters: "W, X, Y, Z, Σ, Δ, Θ, Ω",
    keyFact: "4 Latin letters (W, X, Y, Z) and 4 Greek letters (Σ, Δ, Θ, Ω) - an even split.",
  },
  3: {
    type: 3,
    name: "Cross-Shift",
    description: "One hand shifts while the other dashes. Both hands move, but with different motion types.",
    motionPattern: { left: "shift OR dash", right: "dash OR shift" },
    letterCount: 8,
    letters: "W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω-",
    keyFact: "Named with '-' suffix (e.g., 'Sigma dash' = Σ-). Both hands move, but one shifts and one dashes.",
  },
  4: {
    type: 4,
    name: "Dash",
    description: "One hand dashes while the other remains static.",
    motionPattern: { left: "static OR dash", right: "dash OR static" },
    letterCount: 3,
    letters: "Φ, Ψ, Λ",
    registeredExtensions: "τ- (Tau-Dash, Level 6; no dataframe variations yet)",
    keyFact: "The Level 1 dataframe has 3 letters. Tau-Dash is a registered Type 4 extension, not a letter type.",
  },
  5: {
    type: 5,
    name: "Dual-Dash",
    description: "Both hands dash (move to opposite grid points).",
    motionPattern: { left: "dash", right: "dash" },
    letterCount: 3,
    letters: "Φ-, Ψ-, Λ-",
    keyFact: "Both hands move to opposite points. Named with '-' suffix like Type 3.",
  },
  6: {
    type: 6,
    name: "Static",
    description: "Both hands remain stationary. Only prop rotation changes.",
    motionPattern: { left: "static", right: "static" },
    letterCount: 3,
    letters: "α, β, γ",
    keyFact: "No hand movement at all - only the props rotate. Uses lowercase Greek letters.",
  },
};

function getKeyDifference(type1: number, type2: number): string {
  const key = `${Math.min(type1, type2)}-${Math.max(type1, type2)}`;
  const differences: Record<string, string> = {
    "1-2": "Type 1 has both hands shift. Type 2 has only one hand shift while the other stays static. The distinction is not 'both move vs one moves' - it's about the specific motion types.",
    "1-3": "Type 1 has both hands shift. Type 3 has both hands move, but one shifts and one dashes. Both types have two hands moving, but the motion types differ.",
    "1-4": "Type 1 has both hands shift (adjacent movement). Type 4 has one hand dash (opposite movement) while the other stays static.",
    "1-5": "Type 1 has both hands shift (adjacent). Type 5 has both hands dash (opposite). Both have two hands moving, but shift goes to adjacent points while dash goes to opposite points.",
    "1-6": "Type 1 has both hands shift. Type 6 has no hand movement at all - only prop rotation.",
    "2-3": "Type 2 has one shift, one static. Type 3 has one shift, one dash. In Type 2, one hand doesn't move. In Type 3, both hands move but with different motion types.",
    "2-4": "Type 2 has one shift (adjacent), one static. Type 4 has one dash (opposite), one static. Both have one moving hand, but shift vs dash determines how far it moves.",
    "2-5": "Type 2 has one shift, one static. Type 5 has both hands dash. Type 2 has one stationary hand; Type 5 has both moving to opposite points.",
    "2-6": "Type 2 has one shift, one static. Type 6 has both hands static. Type 2 has hand movement; Type 6 has none.",
    "3-4": "Type 3 has one shift, one dash (both move). Type 4 has one dash, one static (one moves). Type 3 is the only type mixing shift and dash.",
    "3-5": "Type 3 has one shift, one dash. Type 5 has both hands dash. Both have two hands moving; Type 3 mixes motion types while Type 5 uses only dash.",
    "3-6": "Type 3 has one shift, one dash (both move). Type 6 has both hands static (no movement). Maximum movement vs no movement.",
    "4-5": "Type 4 has one dash, one static. Type 5 has both hands dash. Type 4 keeps one hand still; Type 5 moves both to opposite points.",
    "4-6": "Type 4 has one dash, one static. Type 6 has both hands static. Type 4 has one hand making a large movement; Type 6 has no hand movement.",
    "5-6": "Type 5 has both hands dash (maximum movement to opposite points). Type 6 has both hands static (no movement). These are opposites.",
  };
  return differences[key] || "See individual type definitions for details.";
}

export function getTypeComparison(type1: number, type2: number): string {
  const t1 = TYPE_DEFINITIONS[type1];
  const t2 = TYPE_DEFINITIONS[type2];
  if (!t1 || !t2) return `Invalid type number. Types range from 1-6.`;
  const [first, second] = type1 < type2 ? [t1, t2] : [t2, t1];
  return `## Type ${first.type} (${first.name}) vs Type ${second.type} (${second.name})\n\n**Type ${first.type} - ${first.name}:**\n- ${first.description}\n- Left hand: ${first.motionPattern.left}\n- Right hand: ${first.motionPattern.right}\n- ${first.letterCount} Level 1/dataframe letters: ${first.letters}${first.registeredExtensions ? `\n- Registered extensions: ${first.registeredExtensions}` : ""}\n\n**Type ${second.type} - ${second.name}:**\n- ${second.description}\n- Left hand: ${second.motionPattern.left}\n- Right hand: ${second.motionPattern.right}\n- ${second.letterCount} Level 1/dataframe letters: ${second.letters}${second.registeredExtensions ? `\n- Registered extensions: ${second.registeredExtensions}` : ""}\n\n**Key difference:** ${getKeyDifference(first.type, second.type)}`;
}

export function getTypeExplanation(type: number): string {
  const t = TYPE_DEFINITIONS[type];
  if (!t) return `Invalid type number ${type}. Types range from 1-6.`;
  let explanation = `## Type ${t.type}: ${t.name}\n\n**Definition:** ${t.description}\n\n**Motion pattern:** ${t.motionPattern.left === t.motionPattern.right ? `Both hands ${t.motionPattern.left}` : `Left: ${t.motionPattern.left}, Right: ${t.motionPattern.right}`}\n\n**Level 1/dataframe letters (${t.letterCount}):** ${t.letters}${t.registeredExtensions ? `\n\n**Registered extensions:** ${t.registeredExtensions}` : ""}\n\n**Key fact:** ${t.keyFact}`;
  if (t.rotationPattern) {
    explanation += `\n\n**Organization:** ${t.rotationPattern.description}\n`;
    for (const group of t.rotationPattern.groups) {
      explanation += `\n- **${group.letters}**: ${group.pattern}`;
    }
    if (t.rotationPattern.note) explanation += `\n\n*Note: ${t.rotationPattern.note}*`;
    if (t.rotationPattern.uvExplanation) explanation += `\n\n**Why U and V are separate:** ${t.rotationPattern.uvExplanation}`;
  }
  return explanation;
}
