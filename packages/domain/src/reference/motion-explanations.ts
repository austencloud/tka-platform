import type { MotionTypeDefinition } from "../types/motion.js";

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
    description: "The hand moves to an adjacent grid point along a curved arc (90° around the grid perimeter).",
    gridMovement: "To neighboring point via curved arc",
    distance: "1 point (adjacent)",
    keyFact: "Shift is the only motion with a curved path, enabling pro/anti/float distinctions.",
  },
  dash: {
    name: "Dash",
    description: "The hand moves in a straight line to the opposite grid point (180° across the grid).",
    gridMovement: "To opposite point via straight line",
    distance: "2 points (opposite)",
    keyFact: "Dash is a straight-line path. At 0 turns there is no direction distinction (1 state, not 2).",
  },
  hash: {
    name: "Hash",
    description: "The hand moves in a straight line to or from the center grid point. A 'half-dash'.",
    gridMovement: "Between perimeter and center via straight line",
    distance: "1 radius (perimeter to center or center to perimeter)",
    keyFact: "Hash is introduced at Level 6 with the center grid point. Same straight-line geometry as dash.",
    level: 5,
  },
  float: {
    name: "Float",
    description: "The prop holds its absolute spatial angle while the hand traces a curved arc. No prop rotation in world space.",
    gridMovement: "Same as shift (curved arc to adjacent point)",
    distance: "1 point (adjacent, same as shift)",
    keyFact: "Float only applies to shifts (curved paths). It has no turn count - it's a single binary state.",
    level: 3,
  },
};

export function getMotionTypeExplanation(motionType: string): string {
  const key = motionType.toLowerCase().trim();
  const m = MOTION_TYPE_DEFINITIONS[key];
  if (!m) {
    const validTypes = Object.keys(MOTION_TYPE_DEFINITIONS).join(", ");
    return `Motion type "${motionType}" not recognized. Valid types: ${validTypes}`;
  }
  let result = `## ${m.name}\n\n**Definition:** ${m.description}\n\n**Grid movement:** ${m.gridMovement}\n\n**Distance:** ${m.distance}\n\n**Key fact:** ${m.keyFact}`;
  if (m.level) result += `\n\n**Introduced at:** Level ${m.level}`;
  return result;
}

export function getMotionTypeComparison(motion1: string, motion2: string): string {
  const m1 = MOTION_TYPE_DEFINITIONS[motion1.toLowerCase()];
  const m2 = MOTION_TYPE_DEFINITIONS[motion2.toLowerCase()];
  if (!m1) return `Motion type "${motion1}" not recognized.`;
  if (!m2) return `Motion type "${motion2}" not recognized.`;
  return `## ${m1.name} vs ${m2.name}\n\n| Property | ${m1.name} | ${m2.name} |\n|----------|------------|------------|\n| Distance | ${m1.distance} | ${m2.distance} |\n| Movement | ${m1.gridMovement} | ${m2.gridMovement} |\n\n**${m1.name}:** ${m1.description}\n\n**${m2.name}:** ${m2.description}`;
}
