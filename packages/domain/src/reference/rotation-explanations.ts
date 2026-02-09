import type { RotationDefinition } from "../types/rotation.js";

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
    keyFact: "Anti creates 'flower' patterns - the prop rotates against the hand's travel direction.",
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
  let r: RotationDefinition | undefined;
  for (const def of Object.values(ROTATION_DEFINITIONS)) {
    if (def.aliases.includes(key) || def.name.toLowerCase().includes(key)) {
      r = def;
      break;
    }
  }
  if (!r) return `Rotation "${rotation}" not recognized. Valid types: pro, anti, cw, ccw`;
  return `## ${r.name}\n\n**Definition:** ${r.description}\n\n**Relationship:** ${r.relationship}\n\n**Key fact:** ${r.keyFact}`;
}
