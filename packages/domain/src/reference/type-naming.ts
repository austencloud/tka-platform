import { TYPE_DEFINITIONS } from "./type-explanations.js";

export const TYPE_NAMING_ORIGINS: Record<number, string> = {
  1: `"Dual-Shift" indicates both hands perform the same motion type (shift). "Dual" = two hands doing the same thing.`,
  2: `"Shift" is named for the motion that defines it - one hand shifts while the other stays static. The static hand doesn't need to be in the name since it's doing nothing.`,
  3: `"Cross-Shift" was chosen over "Dash-Shift" for two reasons:\n1. **Abbreviation conflict:** "Dash-Shift" abbreviates to "DS" - same as "Dual-Shift", causing confusion\n2. **Conceptual identity:** "Cross-Shift" gives the combination its own name, rather than just listing the parts ("Dash" + "Shift")\n\nThe "cross" refers to the combination of different motion types, not a geometric crossing pattern on the grid.`,
  4: `"Dash" is named for the motion that defines it - one hand dashes while the other stays static.`,
  5: `"Dual-Dash" indicates both hands perform the same motion type (dash). "Dual" = two hands doing the same thing, matching the pattern of "Dual-Shift".`,
  6: `"Static" indicates both hands remain stationary. Only prop rotation changes, no hand movement.`,
};

export function getTypeNamingOrigin(type: number): string {
  const origin = TYPE_NAMING_ORIGINS[type];
  if (!origin) return `Invalid type ${type}. Types range from 1-6.`;
  return `## Why is Type ${type} called "${TYPE_DEFINITIONS[type]?.name}"?\n\n${origin}`;
}
