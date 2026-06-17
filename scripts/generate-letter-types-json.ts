import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LETTER_TYPES } from "@tka/domain";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "mcp-server-pkg", "data", "letter-types.json");

function build(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [num, def] of Object.entries(LETTER_TYPES)) {
    out[num] = {
      name: def.name,
      description: def.description,
      characteristics: def.characteristics,
      letters: def.letters,
      motionPattern: def.motionPattern,
    };
  }
  return out;
}

writeFileSync(OUT, JSON.stringify(build(), null, 2) + "\n", "utf-8");
console.log(`Wrote ${OUT}`);
