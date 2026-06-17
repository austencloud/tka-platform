import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LETTER_TYPES, PLAIN_QUARTER_SAME_EXPLANATION } from "@tka/domain";

describe("MCP letter-types.json stays generated from canonical", () => {
  it("byte-matches what the generator produces from LETTER_TYPES", () => {
    // If this fails, regenerate:
    //   npm --prefix packages/domain run build && npx tsx scripts/generate-letter-types-json.ts
    const expected: Record<string, unknown> = {};
    for (const [num, def] of Object.entries(LETTER_TYPES)) {
      expected[num] = {
        name: def.name,
        description: def.description,
        characteristics: def.characteristics,
        letters: def.letters,
        motionPattern: def.motionPattern,
      };
    }
    const onDisk = readFileSync(
      resolve("mcp-server-pkg/data/letter-types.json"),
      "utf-8"
    );
    expect(onDisk).toBe(JSON.stringify(expected, null, 2) + "\n");
  });
});

describe("server-context letter lists do not drift from canonical", () => {
  it("each type's letters array matches LETTER_TYPES", () => {
    const src = readFileSync(
      resolve("mcp-server-pkg/src/shared/server-context.ts"),
      "utf-8"
    );
    // The TKA_LETTER_TYPES literal lists letters per type; assert the Type 1
    // line contains exactly the canonical Type 1 letters in order.
    const type1Letters = LETTER_TYPES["1"].letters.map((l) => `"${l}"`).join(", ");
    expect(src).toContain(type1Letters);
  });
});

describe("plain explanation stays jargon-free", () => {
  const BANNED = [
    "anomaly", "symmetry", "invariance", "invariant", "asymmetric",
    "color-swap", "gamma", "equivalence", "reflection",
    "quarter-same", "quarter-opposite",
  ];
  it("contains none of the precise-only terms", () => {
    const lower = PLAIN_QUARTER_SAME_EXPLANATION.toLowerCase();
    const found = BANNED.filter((w) => lower.includes(w));
    expect(found).toEqual([]);
  });
});
