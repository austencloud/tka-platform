/**
 * Educational Tools
 *
 * Tools for learning about TKA: get_alphabet_info, get_letter_explanation,
 * get_term_definition, compare_letters, list_letters_by_type, get_position_info
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ensureDataLoaded,
  LETTER_TO_TYPE,
  getGlossary,
  getLetterTypes,
} from "../shared/server-context.js";

export function registerEducationalTools(server: McpServer): void {
  // Tool: get_alphabet_info
  server.tool(
    "get_alphabet_info",
    "Get comprehensive information about the TKA (The Kinetic Alphabet) system. Use this to understand the domain before working with pictographs.",
    {
      compact: z.boolean().optional().default(false).describe("Compact output - essential facts only (saves ~1500 tokens)"),
    },
    async ({ compact = false }) => {
      if (compact) {
        return {
          content: [{
            type: "text" as const,
            text: `TKA Quick Reference:
- Grid: 8 points (N,E,S,W + NE,SE,SW,NW)
- Positions: Alpha=opposite, Beta=same, Gamma=right-angle
- Motions: Static=stay, Shift=adjacent, Dash=opposite
- Types: 1=Dual-Shift(A-V), 2=Shift(W-Ω), 3=Cross-Shift(W--Ω-), 4=Dash(Φ,Ψ,Λ), 5=Dual-Dash(Φ-,Ψ-,Λ-), 6=Static(α,β,γ)
- "[Letter] dash" = Type 3 with "-" suffix (e.g. "Σ dash" = Σ-)`,
          }],
        };
      }
      const info = `# The Kinetic Alphabet (TKA) - Domain Reference

## Overview

TKA is a notation system for flow arts with dual wielded props (staff, fans, clubs, etc.) that encodes hand positions and movements into letters. Each "pictograph" represents one beat of motion showing:
- Two props (blue and red) at specific grid positions
- Motion arrows showing how each hand moves
- Start and end positions (Alpha, Beta, or Gamma)

## The Grid System

Pictographs use a diamond grid with 8 points:
- **Cardinal**: North (n), East (e), South (s), West (w)
- **Intercardinal**: Northeast (ne), Southeast (se), Southwest (sw), Northwest (nw)

## Hand Positions

- **Alpha (α)**: Hands across from each other (opposite points)
- **Beta (β)**: Hands at the same point
- **Gamma (γ)**: Hands form a right angle (adjacent points)

## Motion Types

Each hand can perform one of 4 motion types:
- **Static**: Hand stays at current grid point (no motion)
- **Shift**: Hand moves to an adjacent grid point (90° movement)
- **Dash**: Hand moves to the opposite grid point (180° movement)
- **Pro/Anti**: Refers to prop rotation direction (prospin = with hand path, antispin = against)

## The 6 Letter Types

### Type 1: Dual-Shift (22 letters: A-V)
Both hands shift. The most common type.
- Letters: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V

### Type 2: Shift (8 letters)
One hand shifts, one hand stays static.
- Letters: W, X, Y, Z, Σ (Sigma), Δ (Delta), Θ (Theta), Ω (Omega)

### Type 3: Cross-Shift / "Dash Letters" (8 letters)
One hand shifts + one hand dashes. These have a "-" suffix.
- Letters: W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω-
- **CRITICAL**: When someone says "Sigma dash" or "W dash", they mean the Type 3 letter (Σ-, W-), NOT a letter that uses dash motion.

### Type 4: Dash (3 letters)
One hand dashes, one stays static.
- Letters: Φ (Phi), Ψ (Psi), Λ (Lambda)

### Type 5: Dual-Dash (3 letters)
Both hands dash simultaneously. These also have a "-" suffix.
- Letters: Φ-, Ψ-, Λ-

### Type 6: Static (3 letters)
Both hands remain stationary.
- Letters: α (alpha), β (beta), γ (gamma)

## Naming Convention Summary

| User Says | They Mean | Type |
|-----------|-----------|------|
| "Sigma" or "Σ" | Σ | Type 2 (Shift) |
| "Sigma dash" or "Σ-" | Σ- | Type 3 (Cross-Shift) |
| "W" | W | Type 2 (Shift) |
| "W dash" or "W-" | W- | Type 3 (Cross-Shift) |
| "Phi" or "Φ" | Φ | Type 4 (Dash) |
| "Phi dash" or "Φ-" | Φ- | Type 5 (Dual-Dash) |

## Variations

Each letter has multiple **variations** - different ways to execute the same letter type based on:
- Starting position (alpha1, alpha3, beta1, gamma5, etc.)
- Ending position
- Rotation directions (cw = clockwise, ccw = counter-clockwise)
- Start/end locations on the grid

Use \`list_letter_variations\` to see all variations for a specific letter.`;

      return {
        content: [
          {
            type: "text" as const,
            text: info,
          },
        ],
      };
    }
  );

  // Tool: get_letter_explanation
  server.tool(
    "get_letter_explanation",
    "Get a comprehensive explanation of a TKA letter including its type, motion characteristics, and all variations. Perfect for teaching users about specific letters.",
    {
      letter: z.string().describe("The letter to explain (A-Z or Greek)"),
      variation: z.number().optional().default(0).describe("Specific variation to focus on (0-based, optional)"),
      compact: z.boolean().optional().default(false).describe("Compact output - key facts only (saves ~600 tokens)"),
    },
    async ({ letter, variation = 0, compact = false }) => {
      const allPictographs = ensureDataLoaded();
      const letterTypes = getLetterTypes();
      const variations = allPictographs.filter((p) => p.letter === letter);

      if (variations.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Letter "${letter}" not found in the TKA alphabet. Use list_available_letters to see all valid letters.`,
            },
          ],
          isError: true,
        };
      }

      const typeInfo = LETTER_TO_TYPE[letter];
      const typeNum = typeInfo?.type.replace("type", "") || "unknown";
      const fullTypeInfo = letterTypes[typeNum];

      if (compact) {
        const varData = variations[Math.min(variation, variations.length - 1)];
        return {
          content: [{
            type: "text" as const,
            text: `${letter}: Type ${typeNum} (${fullTypeInfo?.name || "?"}) | Blue: ${varData.blueMotion.motionType} | Red: ${varData.redMotion.motionType} | ${variations.length} variations | Var ${variation}: ${varData.startPosition}→${varData.endPosition}`,
          }],
        };
      }

      const varData = variations[Math.min(variation, variations.length - 1)];

      const explanation = `# Letter: ${letter}

## Type Information
**Type ${typeNum}: ${fullTypeInfo?.name || typeInfo?.name || "Unknown"}**

${fullTypeInfo?.description || ""}

${fullTypeInfo?.characteristics ? "**Characteristics:**\n" + fullTypeInfo.characteristics.map(c => `- ${c}`).join("\n") : ""}

## Motion Pattern
- **Blue hand:** ${varData.blueMotion.motionType}${varData.blueMotion.rotationDirection !== "noRotation" ? ` (${varData.blueMotion.rotationDirection})` : ""}
- **Red hand:** ${varData.redMotion.motionType}${varData.redMotion.rotationDirection !== "noRotation" ? ` (${varData.redMotion.rotationDirection})` : ""}

## Variation ${variation} Details
- **Start position:** ${varData.startPosition}
- **End position:** ${varData.endPosition}
- **Blue motion:** ${varData.blueMotion.startLocation} → ${varData.blueMotion.endLocation}
- **Red motion:** ${varData.redMotion.startLocation} → ${varData.redMotion.endLocation}

## All Variations (${variations.length} total)
${variations.slice(0, 5).map((v, i) => `[${i}] ${v.startPosition} → ${v.endPosition}`).join("\n")}${variations.length > 5 ? `\n... and ${variations.length - 5} more` : ""}

## Related Letters
Other Type ${typeNum} letters: ${fullTypeInfo?.letters?.filter(l => l !== letter).slice(0, 5).join(", ") || "N/A"}`;

      return {
        content: [{ type: "text" as const, text: explanation }],
      };
    }
  );

  // Tool: get_term_definition
  server.tool(
    "get_term_definition",
    "Get the definition of a TKA domain term like alpha, pro, shift, static, etc. Returns definition, examples, and related terms.",
    {
      term: z.string().describe("The term to define (e.g., alpha, pro, shift, dash, static, beta, gamma)"),
    },
    async ({ term }) => {
      const glossary = getGlossary();
      const normalizedTerm = term.toLowerCase().trim();
      const entry = glossary[normalizedTerm];

      if (!entry) {
        const possibleMatches = Object.keys(glossary)
          .filter(key => key.includes(normalizedTerm) || normalizedTerm.includes(key))
          .slice(0, 5);

        return {
          content: [
            {
              type: "text" as const,
              text: `Term "${term}" not found in the TKA glossary.${
                possibleMatches.length > 0
                  ? `\n\nDid you mean: ${possibleMatches.join(", ")}?`
                  : "\n\nAvailable terms include: " + Object.keys(glossary).slice(0, 10).join(", ") + "..."
              }`,
            },
          ],
        };
      }

      const output = `# ${term.charAt(0).toUpperCase() + term.slice(1)}

**Definition:** ${entry.definition}

**Examples:**
${entry.examples.map(e => `- ${e}`).join("\n")}

**Related terms:** ${entry.relatedTerms.join(", ")}

**Category:** ${entry.category}`;

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );

  // Tool: compare_letters
  server.tool(
    "compare_letters",
    "Compare two TKA letters side by side, explaining their differences in type, motion patterns, and characteristics.",
    {
      letter1: z.string().describe("First letter to compare"),
      letter2: z.string().describe("Second letter to compare"),
    },
    async ({ letter1, letter2 }) => {
      const allPictographs = ensureDataLoaded();
      const letterTypes = getLetterTypes();

      const var1 = allPictographs.filter((p) => p.letter === letter1);
      const var2 = allPictographs.filter((p) => p.letter === letter2);

      if (var1.length === 0) {
        return {
          content: [{ type: "text" as const, text: `Letter "${letter1}" not found.` }],
          isError: true,
        };
      }
      if (var2.length === 0) {
        return {
          content: [{ type: "text" as const, text: `Letter "${letter2}" not found.` }],
          isError: true,
        };
      }

      const type1 = LETTER_TO_TYPE[letter1];
      const type2 = LETTER_TO_TYPE[letter2];
      const typeNum1 = type1?.type.replace("type", "") || "?";
      const typeNum2 = type2?.type.replace("type", "") || "?";

      const rep1 = var1[0];
      const rep2 = var2[0];

      const similarities: string[] = [];
      const differences: string[] = [];

      if (typeNum1 === typeNum2) {
        similarities.push(`Both are Type ${typeNum1} (${letterTypes[typeNum1]?.name || type1?.name})`);
      } else {
        differences.push(`Different types: ${letter1} is Type ${typeNum1} (${letterTypes[typeNum1]?.name}), ${letter2} is Type ${typeNum2} (${letterTypes[typeNum2]?.name})`);
      }

      if (rep1.blueMotion.motionType === rep2.blueMotion.motionType) {
        similarities.push(`Both have ${rep1.blueMotion.motionType} blue motion`);
      } else {
        differences.push(`Blue motion differs: ${letter1} uses ${rep1.blueMotion.motionType}, ${letter2} uses ${rep2.blueMotion.motionType}`);
      }

      if (rep1.redMotion.motionType === rep2.redMotion.motionType) {
        similarities.push(`Both have ${rep1.redMotion.motionType} red motion`);
      } else {
        differences.push(`Red motion differs: ${letter1} uses ${rep1.redMotion.motionType}, ${letter2} uses ${rep2.redMotion.motionType}`);
      }

      if (Math.abs(var1.length - var2.length) <= 2) {
        similarities.push(`Similar variation count: ${letter1} has ${var1.length}, ${letter2} has ${var2.length}`);
      } else {
        differences.push(`Different variation counts: ${letter1} has ${var1.length}, ${letter2} has ${var2.length}`);
      }

      const output = `# Comparison: ${letter1} vs ${letter2}

## At a Glance
| Property | ${letter1} | ${letter2} |
|----------|------------|------------|
| Type | ${typeNum1} (${letterTypes[typeNum1]?.name || "?"}) | ${typeNum2} (${letterTypes[typeNum2]?.name || "?"}) |
| Blue motion | ${rep1.blueMotion.motionType} | ${rep2.blueMotion.motionType} |
| Red motion | ${rep1.redMotion.motionType} | ${rep2.redMotion.motionType} |
| Variations | ${var1.length} | ${var2.length} |

## Similarities
${similarities.length > 0 ? similarities.map(s => `- ${s}`).join("\n") : "- No major similarities"}

## Differences
${differences.length > 0 ? differences.map(d => `- ${d}`).join("\n") : "- No major differences"}

## When to Use Each
- **${letter1}:** ${letterTypes[typeNum1]?.description || "Type " + typeNum1 + " letter"}
- **${letter2}:** ${letterTypes[typeNum2]?.description || "Type " + typeNum2 + " letter"}`;

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );

  // Tool: list_letters_by_type
  server.tool(
    "list_letters_by_type",
    "List all letters of a specific type (1-6) with descriptions and motion patterns.",
    {
      type: z.number().min(1).max(6).describe("Letter type (1-6): 1=Dual-Shift, 2=Shift, 3=Cross-Shift, 4=Dash, 5=Dual-Dash, 6=Static"),
      compact: z.boolean().optional().default(false).describe("Compact output - just letters (saves ~400 tokens)"),
    },
    async ({ type, compact = false }) => {
      const letterTypes = getLetterTypes();
      const typeKey = type.toString();
      const typeInfo = letterTypes[typeKey];

      if (!typeInfo) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid type number. Valid types are 1-6:\n1=Dual-Shift, 2=Shift, 3=Cross-Shift, 4=Dash, 5=Dual-Dash, 6=Static`,
            },
          ],
          isError: true,
        };
      }

      if (compact) {
        return {
          content: [{
            type: "text" as const,
            text: `Type ${type} (${typeInfo.name}): ${typeInfo.letters.join(", ")}`,
          }],
        };
      }

      const allPictographs = ensureDataLoaded();

      const letterCounts = typeInfo.letters.map(letter => {
        const count = allPictographs.filter(p => p.letter === letter).length;
        return { letter, count };
      });

      const output = `# Type ${type}: ${typeInfo.name}

**Description:** ${typeInfo.description}

**Motion Pattern:**
- Blue hand: ${typeInfo.motionPattern.blueMotion}
- Red hand: ${typeInfo.motionPattern.redMotion}
${typeInfo.motionPattern.note ? `- Note: ${typeInfo.motionPattern.note}` : ""}

**Characteristics:**
${typeInfo.characteristics.map(c => `- ${c}`).join("\n")}

**Letters (${typeInfo.letters.length} total):**
${letterCounts.map(({ letter, count }) => `- **${letter}** (${count} variations)`).join("\n")}`;

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );

  // Tool: get_position_info
  server.tool(
    "get_position_info",
    "Get detailed information about a TKA position (alpha, beta, gamma, zeta, eta) including grid configuration and examples.",
    {
      position: z.string().describe("Position name (alpha, beta, gamma, zeta, eta)"),
    },
    async ({ position }) => {
      const normalizedPos = position.toLowerCase().trim();

      const positions: Record<string, {
        name: string;
        angleDegrees: string;
        description: string;
        gridDescription: string;
        examples: string[];
        level: number;
      }> = {
        alpha: {
          name: "Alpha (α)",
          angleDegrees: "180°",
          description: "Hands are at opposite grid points, forming a straight line through the center.",
          gridDescription: "Examples: N/S, E/W, NE/SW, NW/SE. The hands are as far apart as possible.",
          examples: [
            "alpha1: Hands at N and S (diamond mode, vertical axis)",
            "alpha3: Hands at E and W (diamond mode, horizontal axis)",
            "alpha5: Hands at NE and SW (box mode, diagonal)",
          ],
          level: 1,
        },
        beta: {
          name: "Beta (β)",
          angleDegrees: "0°",
          description: "Both hands are at the same grid point, stacked on top of each other.",
          gridDescription: "Both props share a single location. This is the 'together' position.",
          examples: [
            "beta1: Both hands at N (diamond mode)",
            "beta5: Both hands at NE (box mode)",
            "beta3: Both hands at E (diamond mode)",
          ],
          level: 1,
        },
        gamma: {
          name: "Gamma (γ)",
          angleDegrees: "90°",
          description: "Hands form a right angle, positioned on adjacent grid points.",
          gridDescription: "One hand is 90° away from the other, creating an 'L' shape.",
          examples: [
            "gamma1: Hands at N and E (diamond mode)",
            "gamma5: Hands at N and NW (diamond-to-box transition)",
            "gamma9: Hands at NE and SE (box mode)",
          ],
          level: 1,
        },
        zeta: {
          name: "Zeta (ζ)",
          angleDegrees: "~135°",
          description: "Hands form an obtuse angle. Introduced in Level 4 with skewed grid mode.",
          gridDescription: "One hand is on a cardinal point, the other on an intercardinal point, forming an angle greater than 90°.",
          examples: [
            "Hands at N and SE (skewed mode, ~135°)",
            "Hands at E and NW (skewed mode)",
          ],
          level: 4,
        },
        eta: {
          name: "Eta (η)",
          angleDegrees: "~45°",
          description: "Hands form an acute angle. Introduced in Level 4 with skewed grid mode.",
          gridDescription: "One hand is on a cardinal point, the other on an intercardinal point, forming an angle less than 90°.",
          examples: [
            "Hands at N and NE (skewed mode, ~45°)",
            "Hands at E and SE (skewed mode)",
          ],
          level: 4,
        },
      };

      const posInfo = positions[normalizedPos];

      if (!posInfo) {
        const availablePositions = Object.keys(positions).join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: `Position "${position}" not recognized. Available positions: ${availablePositions}`,
            },
          ],
        };
      }

      const allPictographs = ensureDataLoaded();
      const startCount = allPictographs.filter(p =>
        p.startPosition.toLowerCase().startsWith(normalizedPos)
      ).length;
      const endCount = allPictographs.filter(p =>
        p.endPosition.toLowerCase().startsWith(normalizedPos)
      ).length;

      const output = `# ${posInfo.name}

**Angle:** ${posInfo.angleDegrees} between hands

**Description:** ${posInfo.description}

**Grid Configuration:** ${posInfo.gridDescription}

**Examples:**
${posInfo.examples.map(e => `- ${e}`).join("\n")}

**Introduced:** Level ${posInfo.level}

**Usage in Pictographs:**
- Used as starting position: ${startCount} pictographs
- Used as ending position: ${endCount} pictographs

**Related:** ${Object.keys(positions).filter(p => p !== normalizedPos).join(", ")}`;

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}
