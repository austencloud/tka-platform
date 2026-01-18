/**
 * Canonical Responses for TIKA
 *
 * Pre-written, human-verified explanations for domain-critical questions.
 * The LLM retrieves these rather than generating - eliminating hallucination risk.
 *
 * Philosophy: For questions with known correct answers, don't let the LLM synthesize.
 * It selects the right template; we provide the verified content.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeDefinition {
  type: number;
  name: string;
  description: string;
  motionPattern: {
    blue: string;
    red: string;
  };
  letterCount: number;
  letters: string;
  keyFact: string;
  rotationPattern?: {
    description: string;
    groups: Array<{
      letters: string;
      pattern: string;
    }>;
    note?: string;
  };
}

export const TYPE_DEFINITIONS: Record<number, TypeDefinition> = {
  1: {
    type: 1,
    name: "Dual-Shift",
    description: "Both hands shift (move to adjacent grid points).",
    motionPattern: {
      blue: "shift",
      red: "shift",
    },
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
        { letters: "STUV", pattern: "pro, anti, hybrid, hybrid" }
      ],
      note: "STUV breaks the pattern with two hybrids (U and V) instead of ending at the first hybrid."
    }
  },
  2: {
    type: 2,
    name: "Shift",
    description: "One hand shifts while the other remains static.",
    motionPattern: {
      blue: "static OR shift",
      red: "shift OR static",
    },
    letterCount: 8,
    letters: "W, X, Y, Z, Σ, Δ, Θ, Ω",
    keyFact: "4 Latin letters (W, X, Y, Z) and 4 Greek letters (Σ, Δ, Θ, Ω) - an even split.",
  },
  3: {
    type: 3,
    name: "Cross-Shift",
    description: "One hand shifts while the other dashes. Both hands move, but with different motion types.",
    motionPattern: {
      blue: "shift OR dash",
      red: "dash OR shift",
    },
    letterCount: 8,
    letters: "W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω-",
    keyFact: "Named with '-' suffix (e.g., 'Sigma dash' = Σ-). Both hands move, but one shifts and one dashes.",
  },
  4: {
    type: 4,
    name: "Dash",
    description: "One hand dashes while the other remains static.",
    motionPattern: {
      blue: "static OR dash",
      red: "dash OR static",
    },
    letterCount: 3,
    letters: "Φ, Ψ, Λ",
    keyFact: "Only 3 letters. The dash motion moves to the opposite grid point.",
  },
  5: {
    type: 5,
    name: "Dual-Dash",
    description: "Both hands dash (move to opposite grid points).",
    motionPattern: {
      blue: "dash",
      red: "dash",
    },
    letterCount: 3,
    letters: "Φ-, Ψ-, Λ-",
    keyFact: "Both hands move to opposite points. Named with '-' suffix like Type 3.",
  },
  6: {
    type: 6,
    name: "Static",
    description: "Both hands remain stationary. Only prop rotation changes.",
    motionPattern: {
      blue: "static",
      red: "static",
    },
    letterCount: 3,
    letters: "α, β, γ",
    keyFact: "No hand movement at all - only the props rotate. Uses lowercase Greek letters.",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Type Comparisons - Pre-written canonical explanations
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeComparison {
  type1: number;
  type2: number;
  comparison: string;
}

/**
 * Generate a canonical comparison between two types.
 * This is deterministic and verified - no LLM generation involved.
 */
export function getTypeComparison(type1: number, type2: number): string {
  const t1 = TYPE_DEFINITIONS[type1];
  const t2 = TYPE_DEFINITIONS[type2];

  if (!t1 || !t2) {
    return `Invalid type number. Types range from 1-6.`;
  }

  // Ensure consistent ordering (smaller type first)
  const [first, second] = type1 < type2 ? [t1, t2] : [t2, t1];

  return `## Type ${first.type} (${first.name}) vs Type ${second.type} (${second.name})

**Type ${first.type} - ${first.name}:**
- ${first.description}
- Blue hand: ${first.motionPattern.blue}
- Red hand: ${first.motionPattern.red}
- ${first.letterCount} letters: ${first.letters}

**Type ${second.type} - ${second.name}:**
- ${second.description}
- Blue hand: ${second.motionPattern.blue}
- Red hand: ${second.motionPattern.red}
- ${second.letterCount} letters: ${second.letters}

**Key difference:** ${getKeyDifference(first.type, second.type)}`;
}

/**
 * Pre-written key differences for type pairs.
 * These are the critical facts that must be stated correctly.
 */
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

/**
 * Get a single type explanation - canonical, verified content.
 */
export function getTypeExplanation(type: number): string {
  const t = TYPE_DEFINITIONS[type];
  if (!t) {
    return `Invalid type number ${type}. Types range from 1-6.`;
  }

  return `## Type ${t.type}: ${t.name}

**Definition:** ${t.description}

**Motion pattern:**
- Blue hand: ${t.motionPattern.blue}
- Red hand: ${t.motionPattern.red}

**Letters (${t.letterCount}):** ${t.letters}

**Key fact:** ${t.keyFact}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Position Definitions - Canonical
// ═══════════════════════════════════════════════════════════════════════════

export interface PositionDefinition {
  name: string;
  symbol: string;
  angle: string;
  description: string;
  gridDescription: string;
  examples: string[];
  level: number;
  keyFact: string;
}

export const POSITION_DEFINITIONS: Record<string, PositionDefinition> = {
  alpha: {
    name: "Alpha",
    symbol: "α",
    angle: "180°",
    description: "Hands are at opposite grid points.",
    gridDescription: "The two hands form a straight line through the center of the grid.",
    examples: ["N and S (north-south)", "E and W (east-west)", "NE and SW", "NW and SE"],
    level: 1,
    keyFact: "Alpha is the most extended position - hands are as far apart as possible on the grid.",
  },
  beta: {
    name: "Beta",
    symbol: "β",
    angle: "0°",
    description: "Both hands are at the same grid point.",
    gridDescription: "Both props occupy the same location on the grid.",
    examples: ["Both at N", "Both at E", "Both at NE"],
    level: 1,
    keyFact: "Beta is the most contracted position - hands are together at one point.",
  },
  gamma: {
    name: "Gamma",
    symbol: "γ",
    angle: "90°",
    description: "Hands form a right angle (adjacent grid points).",
    gridDescription: "One hand is 90° away from the other around the grid.",
    examples: ["N and E", "E and S", "NE and SE", "N and NW"],
    level: 1,
    keyFact: "Gamma positions are neither fully extended nor contracted - a middle ground.",
  },
  zeta: {
    name: "Zeta",
    symbol: "ζ",
    angle: "~135°",
    description: "Hands form an obtuse angle. One on cardinal, one on intercardinal.",
    gridDescription: "Mixes diamond grid (cardinal) with box grid (intercardinal) points.",
    examples: ["N and SE", "E and NW", "S and NE"],
    level: 4,
    keyFact: "Zeta is a Level 4 'skewed' position - it mixes the two grid systems.",
  },
  eta: {
    name: "Eta",
    symbol: "η",
    angle: "~45°",
    description: "Hands form an acute angle. One on cardinal, one on intercardinal.",
    gridDescription: "Mixes diamond grid (cardinal) with box grid (intercardinal) points.",
    examples: ["N and NE", "E and SE", "S and SW"],
    level: 4,
    keyFact: "Eta is a Level 4 'skewed' position - hands are close but on different grid systems.",
  },
  tau: {
    name: "Tau",
    symbol: "τ",
    angle: "varies",
    description: "One hand at center, one at a non-center point.",
    gridDescription: "Uses the center grid point (Level 5 concept).",
    examples: ["Center and N", "Center and NE"],
    level: 5,
    keyFact: "Tau introduces the center point - not yet implemented in TKA Scribe.",
  },
  terra: {
    name: "Terra",
    symbol: "τ²",
    angle: "0°",
    description: "Both hands at the center point.",
    gridDescription: "Both props at the center of the grid (Level 5 concept).",
    examples: ["Both at center"],
    level: 5,
    keyFact: "Terra is like beta but at center - not yet implemented in TKA Scribe.",
  },
};

export function getPositionExplanation(position: string): string {
  const key = position.toLowerCase().trim();
  const p = POSITION_DEFINITIONS[key];

  if (!p) {
    const validPositions = Object.keys(POSITION_DEFINITIONS).join(", ");
    return `Position "${position}" not recognized. Valid positions: ${validPositions}`;
  }

  return `## ${p.name} (${p.symbol})

**Angle between hands:** ${p.angle}

**Definition:** ${p.description}

**On the grid:** ${p.gridDescription}

**Examples:**
${p.examples.map(e => `- ${e}`).join("\n")}

**Level:** ${p.level}

**Key fact:** ${p.keyFact}`;
}

export function getPositionComparison(pos1: string, pos2: string): string {
  const p1 = POSITION_DEFINITIONS[pos1.toLowerCase()];
  const p2 = POSITION_DEFINITIONS[pos2.toLowerCase()];

  if (!p1) return `Position "${pos1}" not recognized.`;
  if (!p2) return `Position "${pos2}" not recognized.`;

  return `## ${p1.name} vs ${p2.name}

| Property | ${p1.name} (${p1.symbol}) | ${p2.name} (${p2.symbol}) |
|----------|------------|------------|
| Angle | ${p1.angle} | ${p2.angle} |
| Level | ${p1.level} | ${p2.level} |

**${p1.name}:** ${p1.description}

**${p2.name}:** ${p2.description}

**Key difference:** ${p1.name} has hands ${p1.angle} apart; ${p2.name} has hands ${p2.angle} apart.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Motion Type Definitions - Canonical
// ═══════════════════════════════════════════════════════════════════════════

export interface MotionTypeDefinition {
  name: string;
  description: string;
  gridMovement: string;
  distance: string;
  keyFact: string;
}

export const MOTION_TYPE_DEFINITIONS: Record<string, MotionTypeDefinition> = {
  static: {
    name: "Static",
    description: "The hand remains at its current grid point. No movement.",
    gridMovement: "None - stays in place",
    distance: "0 points",
    keyFact: "Static means no hand movement, but the prop can still rotate.",
  },
  shift: {
    name: "Shift",
    description: "The hand moves to an adjacent grid point (90° around the grid).",
    gridMovement: "To neighboring point",
    distance: "1 point (adjacent)",
    keyFact: "Shift is the smaller movement - like stepping to the next position.",
  },
  dash: {
    name: "Dash",
    description: "The hand moves to the opposite grid point (180° across the grid).",
    gridMovement: "To opposite point",
    distance: "2 points (opposite)",
    keyFact: "Dash is the larger movement - crossing through or around the center.",
  },
};

export function getMotionTypeExplanation(motionType: string): string {
  const key = motionType.toLowerCase().trim();
  const m = MOTION_TYPE_DEFINITIONS[key];

  if (!m) {
    return `Motion type "${motionType}" not recognized. Valid types: static, shift, dash`;
  }

  return `## ${m.name}

**Definition:** ${m.description}

**Grid movement:** ${m.gridMovement}

**Distance:** ${m.distance}

**Key fact:** ${m.keyFact}`;
}

export function getMotionTypeComparison(motion1: string, motion2: string): string {
  const m1 = MOTION_TYPE_DEFINITIONS[motion1.toLowerCase()];
  const m2 = MOTION_TYPE_DEFINITIONS[motion2.toLowerCase()];

  if (!m1) return `Motion type "${motion1}" not recognized.`;
  if (!m2) return `Motion type "${motion2}" not recognized.`;

  return `## ${m1.name} vs ${m2.name}

| Property | ${m1.name} | ${m2.name} |
|----------|------------|------------|
| Distance | ${m1.distance} | ${m2.distance} |
| Movement | ${m1.gridMovement} | ${m2.gridMovement} |

**${m1.name}:** ${m1.description}

**${m2.name}:** ${m2.description}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Rotation Direction Definitions - Canonical
// ═══════════════════════════════════════════════════════════════════════════

export interface RotationDefinition {
  name: string;
  aliases: string[];
  description: string;
  relationship: string;
  keyFact: string;
}

export const ROTATION_DEFINITIONS: Record<string, RotationDefinition> = {
  pro: {
    name: "Pro (Prospin)",
    aliases: ["pro", "prospin"],
    description: "The prop rotates in the same direction as the hand's travel path.",
    relationship: "Prop rotation = hand travel direction",
    keyFact: "Pro creates 'same' patterns - the prop follows the hand's path direction.",
  },
  anti: {
    name: "Anti (Antispin)",
    aliases: ["anti", "antispin"],
    description: "The prop rotates opposite to the hand's travel path.",
    relationship: "Prop rotation = opposite of hand travel direction",
    keyFact: "Anti creates 'flowers' and 'inspin' patterns - the prop fights the hand's direction.",
  },
  cw: {
    name: "Clockwise",
    aliases: ["cw", "clockwise"],
    description: "Rotation in the clockwise direction (when viewed from standard orientation).",
    relationship: "Absolute direction, not relative to hand travel",
    keyFact: "CW/CCW describe absolute rotation; pro/anti describe rotation relative to hand movement.",
  },
  ccw: {
    name: "Counter-clockwise",
    aliases: ["ccw", "counterclockwise", "counter-clockwise"],
    description: "Rotation in the counter-clockwise direction (when viewed from standard orientation).",
    relationship: "Absolute direction, not relative to hand travel",
    keyFact: "CW/CCW describe absolute rotation; pro/anti describe rotation relative to hand movement.",
  },
};

export function getRotationExplanation(rotation: string): string {
  const key = rotation.toLowerCase().trim();

  // Find by name or alias
  let r: RotationDefinition | undefined;
  for (const def of Object.values(ROTATION_DEFINITIONS)) {
    if (def.aliases.includes(key) || def.name.toLowerCase().includes(key)) {
      r = def;
      break;
    }
  }

  if (!r) {
    return `Rotation "${rotation}" not recognized. Valid types: pro, anti, cw, ccw`;
  }

  return `## ${r.name}

**Definition:** ${r.description}

**Relationship:** ${r.relationship}

**Key fact:** ${r.keyFact}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Grid Mode Definitions - Canonical
// ═══════════════════════════════════════════════════════════════════════════

export interface GridModeDefinition {
  name: string;
  description: string;
  points: string[];
  positions: string[];
  keyFact: string;
}

export const GRID_MODE_DEFINITIONS: Record<string, GridModeDefinition> = {
  diamond: {
    name: "Diamond Grid",
    description: "Uses the four cardinal points: North, East, South, West.",
    points: ["N (north)", "E (east)", "S (south)", "W (west)"],
    positions: ["Alpha (N/S or E/W)", "Beta (same point)", "Gamma (adjacent like N/E)"],
    keyFact: "Diamond is the primary grid mode. Most Level 1-3 work uses diamond grid.",
  },
  box: {
    name: "Box Grid",
    description: "Uses the four intercardinal points: NE, SE, SW, NW.",
    points: ["NE (northeast)", "SE (southeast)", "SW (southwest)", "NW (northwest)"],
    positions: ["Alpha (NE/SW or NW/SE)", "Beta (same point)", "Gamma (adjacent like NE/SE)"],
    keyFact: "Box grid is rotated 45° from diamond. Same positions, different orientation.",
  },
  skewed: {
    name: "Skewed Grid",
    description: "Mixes cardinal (diamond) and intercardinal (box) points.",
    points: ["One hand on cardinal (N/E/S/W)", "One hand on intercardinal (NE/SE/SW/NW)"],
    positions: ["Zeta (~135° angle)", "Eta (~45° angle)"],
    keyFact: "Skewed positions are Level 4. They bridge the two grid systems.",
  },
};

export function getGridModeExplanation(mode: string): string {
  const key = mode.toLowerCase().trim();
  const g = GRID_MODE_DEFINITIONS[key];

  if (!g) {
    return `Grid mode "${mode}" not recognized. Valid modes: diamond, box, skewed`;
  }

  return `## ${g.name}

**Definition:** ${g.description}

**Grid points:**
${g.points.map(p => `- ${p}`).join("\n")}

**Positions available:**
${g.positions.map(p => `- ${p}`).join("\n")}

**Key fact:** ${g.keyFact}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// VTG to TKA Mapping - Canonical
// ═══════════════════════════════════════════════════════════════════════════

export interface VTGMapping {
  vtgTerm: string;
  tkaLetters: string[];
  explanation: string;
}

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

  // Try to find a match
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

  return `## VTG: ${mapping.vtgTerm}

**TKA Letters:** ${mapping.tkaLetters.join(", ")}

**Explanation:** ${mapping.explanation}

All these letters are Type 1 (Dual-Shift) - both hands shift.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Alphabet Overview - Canonical
// ═══════════════════════════════════════════════════════════════════════════

export function getAlphabetOverview(): string {
  return `## The Kinetic Alphabet Overview

The TKA alphabet has **41 letters** organized into **6 types** by motion pattern:

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

// ═══════════════════════════════════════════════════════════════════════════
// Type Naming Origins - Canonical
// ═══════════════════════════════════════════════════════════════════════════

export const TYPE_NAMING_ORIGINS: Record<number, string> = {
  1: `"Dual-Shift" indicates both hands perform the same motion type (shift). "Dual" = two hands doing the same thing.`,

  2: `"Shift" is named for the motion that defines it - one hand shifts while the other stays static. The static hand doesn't need to be in the name since it's doing nothing.`,

  3: `"Cross-Shift" was chosen over "Dash-Shift" for two reasons:
1. **Abbreviation conflict:** "Dash-Shift" abbreviates to "DS" - same as "Dual-Shift", causing confusion
2. **Conceptual identity:** "Cross-Shift" gives the combination its own name, rather than just listing the parts ("Dash" + "Shift")

The "cross" refers to the combination of different motion types, not a geometric crossing pattern on the grid.`,

  4: `"Dash" is named for the motion that defines it - one hand dashes while the other stays static.`,

  5: `"Dual-Dash" indicates both hands perform the same motion type (dash). "Dual" = two hands doing the same thing, matching the pattern of "Dual-Shift".`,

  6: `"Static" indicates both hands remain stationary. Only prop rotation changes, no hand movement.`,
};

export function getTypeNamingOrigin(type: number): string {
  const origin = TYPE_NAMING_ORIGINS[type];
  if (!origin) {
    return `Invalid type ${type}. Types range from 1-6.`;
  }
  return `## Why is Type ${type} called "${TYPE_DEFINITIONS[type]?.name}"?\n\n${origin}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Common Questions - Canonical Answers
// ═══════════════════════════════════════════════════════════════════════════

export const COMMON_QUESTIONS: Record<string, string> = {
  "why cross-shift": `## Why "Cross-Shift" instead of "Dash-Shift"?

"Cross-Shift" was chosen over "Dash-Shift" for two practical reasons:

1. **Abbreviation conflict:** "Dash-Shift" abbreviates to "DS" - the same as "Dual-Shift". This would cause confusion when discussing types.

2. **Conceptual identity:** "Cross-Shift" gives the combination its own name, rather than just listing the constituent parts ("Dash" + "Shift"). It wraps the concept into a single term.

The "cross" refers to the combination of different motion types, not a geometric crossing pattern on the grid.`,

  "what is tka": `## What is TKA?

TKA (The Kinetic Alphabet) is a notation system for encoding flow arts movements into written symbols.

**Purpose:** Before TKA, flow artists could only share movements through video. TKA provides a written language - you can write down a sequence, share it, and another spinner can read and perform it.

**How it works:** Each "letter" represents one beat of motion, encoding:
- Where the hands start (position)
- Where the hands end (position)
- How each hand moves (motion type: shift, dash, or static)
- How each prop rotates (pro or anti)

**Structure:** 41 letters in 6 types, organized by motion pattern.`,

  "what is a pictograph": `## What is a Pictograph?

A pictograph is the visual representation of one TKA letter - one beat of motion.

**Components:**
- **Grid:** The reference frame (diamond or box orientation)
- **Props:** Two colored shapes (blue and red) showing hand positions
- **Arrows:** Show the path each hand takes (if moving)
- **Letter glyph:** The TKA letter name (e.g., "A", "Σ-")

**Reading a pictograph:**
1. Find the starting positions (where props begin)
2. Follow the arrows to see the motion path
3. Note the ending positions (where props end up)
4. The letter type tells you the motion pattern`,

  "what is a sequence": `## What is a Sequence?

A sequence is a series of TKA letters performed in order - like a word made of letters.

**Properties:**
- Each letter is one beat
- Letters connect: the end position of one letter is the start position of the next
- A valid sequence has matching positions between consecutive letters

**Special sequences:**
- **LOOP:** A circular sequence where the last letter's end position matches the first letter's start position
- **Infinite LOOP:** A LOOP that can repeat indefinitely`,

  "what is a loop": `## What is a LOOP?

A LOOP is a circular sequence - the end position returns to the start position.

**Definition:** A sequence where the last letter's ending position equals the first letter's starting position.

**Why it matters:** LOOPs can be repeated infinitely. Non-LOOP sequences would require a transition to restart.

**Example:** If a sequence starts at alpha and ends at alpha, it's a LOOP. If it starts at alpha and ends at beta, it's not a LOOP.`,
};

export function getCommonAnswer(question: string): string | null {
  const normalized = question.toLowerCase().trim();

  for (const [key, answer] of Object.entries(COMMON_QUESTIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return answer;
    }
  }

  return null;
}
