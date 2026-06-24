/**
 * Dev-only write-back for the effect tuner.
 *
 * POST { effect, intent } → patches DEFAULT_EFFECTS_CONFIG[<effect>] in
 * src/lib/shared/effects/domain/defaults.ts IN PLACE: each field in `intent`
 * replaces that field's value on its single line inside the effect's block.
 * Comments and unrelated fields are untouched (every default field is
 * single-line, so a per-field value swap is exact and comment-safe). Vite then
 * HMR-reloads defaults.ts so the tuner re-seeds from the new baseline.
 *
 * Guarded to dev — never reachable in a production build.
 */
import { json, error, type RequestHandler } from "@sveltejs/kit";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { dev } from "$app/environment";

const DEFAULTS_PATH = resolve(
  process.cwd(),
  "src/lib/shared/effects/domain/defaults.ts",
);

const EFFECT_IDS = new Set([
  "trails", "fire", "led", "charcoal", "zap", "sparkles", "echo", "bloom",
  "water", "bubbles", "petals", "smoke", "ink", "frost", "silk", "pulse",
]);

/** Serialize a JSON value to its TS-source form (matches defaults.ts style). */
function serialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(serialize).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${k}: ${serialize(v)}`,
    );
    return `{ ${entries.join(", ")} }`;
  }
  return JSON.stringify(value);
}

export const POST: RequestHandler = async ({ request }) => {
  if (!dev) throw error(403, "effect-tuner write-back is dev-only");

  const body = (await request.json()) as { effect?: string; intent?: Record<string, unknown> };
  const effect = body.effect ?? "";
  const intent = body.intent;
  if (!EFFECT_IDS.has(effect)) throw error(400, `unknown effect: "${effect}"`);
  if (!intent || typeof intent !== "object") throw error(400, "missing intent object");

  const src = readFileSync(DEFAULTS_PATH, "utf8");

  // Locate the effect's object literal block: `  <effect>: {` … `\n  },`.
  const startMatch = new RegExp(`\\n  ${effect}: \\{`).exec(src);
  if (!startMatch) throw error(500, `block not found in defaults.ts: ${effect}`);
  const blockStart = startMatch.index + 1; // step over the leading \n
  const closeIdx = src.indexOf("\n  },", blockStart);
  if (closeIdx === -1) throw error(500, `block end not found: ${effect}`);

  let block = src.slice(blockStart, closeIdx);
  const patched: string[] = [];
  for (const [key, value] of Object.entries(intent)) {
    const ser = serialize(value);
    // Replace the value on `    <key>: <value>,` (single-line guaranteed).
    // The block is sliced to end at the last field's trailing comma, so the
    // anchor must accept end-of-block ($) as well as a following newline —
    // otherwise the LAST field never matches and gets appended (duplicated).
    const lineRe = new RegExp(`(\\n    ${key}: )[^\\n]*?(,)(?=\\n|$)`);
    if (lineRe.test(block)) {
      block = block.replace(lineRe, `$1${ser}$2`);
    } else {
      // Field absent from the source block — append it before the close.
      block += `\n    ${key}: ${ser},`;
    }
    patched.push(key);
  }

  const next = src.slice(0, blockStart) + block + src.slice(closeIdx);
  if (next === src) {
    return json({ ok: true, effect, patched, changed: false });
  }
  writeFileSync(DEFAULTS_PATH, next, "utf8");
  return json({ ok: true, effect, patched, changed: true });
};
