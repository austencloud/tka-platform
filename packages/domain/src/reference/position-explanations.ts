import { POSITION_DEFINITIONS } from "../constants/position-groups.js";
import type { PositionName } from "../types/position.js";

export function getPositionExplanation(position: string): string {
  const key = position.toLowerCase().trim() as PositionName;
  const p = POSITION_DEFINITIONS[key];
  if (!p) {
    const validPositions = Object.keys(POSITION_DEFINITIONS).join(", ");
    return `Position "${position}" not recognized. Valid positions: ${validPositions}`;
  }
  return `## ${p.name}\n\n**Angle between hands:** ${p.angle}\n\n**Definition:** ${p.description}\n\n**On the grid:** ${p.gridDescription}\n\n**Examples:**\n${p.examples.map(e => `- ${e}`).join("\n")}\n\n**Level:** ${p.level}\n\n**Key fact:** ${p.keyFact}`;
}

export function getPositionComparison(pos1: string, pos2: string): string {
  const p1 = POSITION_DEFINITIONS[pos1.toLowerCase() as PositionName];
  const p2 = POSITION_DEFINITIONS[pos2.toLowerCase() as PositionName];
  if (!p1) return `Position "${pos1}" not recognized.`;
  if (!p2) return `Position "${pos2}" not recognized.`;
  return `## ${p1.name} vs ${p2.name}\n\n| Property | ${p1.name} (${p1.symbol}) | ${p2.name} (${p2.symbol}) |\n|----------|------------|------------|\n| Angle | ${p1.angle} | ${p2.angle} |\n| Level | ${p1.level} | ${p2.level} |\n\n**${p1.name}:** ${p1.description}\n\n**${p2.name}:** ${p2.description}\n\n**Key difference:** ${p1.name} has hands ${p1.angle} apart; ${p2.name} has hands ${p2.angle} apart.`;
}
