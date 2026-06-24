/**
 * Pure source-text transforms for the effect-tuner dev write-back endpoint.
 *
 * String in, string out — no filesystem. Keeping the field-swap and
 * brace-matching logic here (instead of inline in `+server.ts`) lets it be
 * unit-tested without touching disk; the server wrapper does fs + dispatch only.
 *
 * Two destinations:
 *   - patchDefaultsBlock — DEFAULT_EFFECTS_CONFIG[<effect>] in defaults.ts
 *     (every field single-line, so a per-field value swap is exact + comment-safe)
 *   - patchPresetPatch   — the `patch: { … }` object of one preset in
 *     <effect>-presets.ts (multi-line object, located by id, brace-matched)
 */

/** Serialize a JSON value to its TS-source form (single line). */
export function serialize(value: unknown): string {
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Patch `DEFAULT_EFFECTS_CONFIG[<effect>]` in defaults.ts source. Each field in
 * `intent` replaces that field's value on its single line inside the effect's
 * `<effect>: { … }` block. Comments and unrelated fields are untouched. A field
 * not present in the source block is appended before the block close.
 */
export function patchDefaultsBlock(
  src: string,
  effect: string,
  intent: Record<string, unknown>,
): { src: string; patched: string[] } {
  const startMatch = new RegExp(`\\n  ${escapeRegExp(effect)}: \\{`).exec(src);
  if (!startMatch) throw new Error(`block not found in defaults.ts: ${effect}`);
  const blockStart = startMatch.index + 1; // step over the leading \n
  const closeIdx = src.indexOf("\n  },", blockStart);
  if (closeIdx === -1) throw new Error(`block end not found: ${effect}`);

  let block = src.slice(blockStart, closeIdx);
  const patched: string[] = [];
  for (const [key, value] of Object.entries(intent)) {
    const ser = serialize(value);
    // Replace the value on `    <key>: <value>,`. The block is sliced to end at
    // the last field's trailing comma (newline outside the slice), so the
    // anchor must accept end-of-block ($) as well as a following newline —
    // otherwise the LAST field never matches and gets appended (duplicated).
    const lineRe = new RegExp(`(\\n    ${escapeRegExp(key)}: )[^\\n]*?(,)(?=\\n|$)`);
    if (lineRe.test(block)) {
      block = block.replace(lineRe, `$1${ser}$2`);
    } else {
      block += `\n    ${key}: ${ser},`;
    }
    patched.push(key);
  }

  return { src: src.slice(0, blockStart) + block + src.slice(closeIdx), patched };
}

/**
 * Index of the `}` that matches the `{` at `openIdx`. Tracks brace depth,
 * skipping double-quoted string spans (preset values are simple quoted
 * strings/enums and `[…]` arrays — no braces live inside a string). Throws if
 * `openIdx` isn't a `{` or the braces are unbalanced.
 */
export function matchBrace(src: string, openIdx: number): number {
  if (src[openIdx] !== "{") throw new Error(`expected { at index ${openIdx}`);
  let depth = 0;
  let inStr = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") {
        i++; // skip the escaped character
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error("unbalanced braces");
}

/** Render `intent` as a multi-line patch object literal. */
function serializePatchBody(
  intent: Record<string, unknown>,
  fieldIndent: number,
  closeIndent: number,
): string {
  const pad = " ".repeat(fieldIndent);
  const closePad = " ".repeat(closeIndent);
  const lines = Object.entries(intent).map(([k, v]) => `${pad}${k}: ${serialize(v)},`);
  return `{\n${lines.join("\n")}\n${closePad}}`;
}

/**
 * Replace the `patch: { … }` object of the preset whose id is `presetId`,
 * inside a `<EFFECT>_PRESETS` source file, with `intent` serialized as a
 * multi-line object (fields at 6 spaces, close brace at 4 — the house style for
 * a preset patch). `id` / `name` / `previewColor` are untouched.
 *
 * Throws if the id is absent, or the preset has no static `patch` before the
 * next preset (a resolvePatch-only / Custom preset) — never writes a guess.
 */
export function patchPresetPatch(
  src: string,
  presetId: string,
  intent: Record<string, unknown>,
): string {
  const idIdx = src.indexOf(`id: "${presetId}"`);
  if (idIdx === -1) throw new Error(`preset id not found: ${presetId}`);

  // Find this preset's own `patch: {` — anchored to a property start so the
  // "patch" inside "resolvePatch" can't match. Must occur before the next
  // preset's `id:`, else this preset has no static patch.
  const patchRe = /\n\s*patch:\s*\{/g;
  patchRe.lastIndex = idIdx;
  const m = patchRe.exec(src);
  const nextId = src.indexOf('id: "', idIdx + 5);
  if (!m || (nextId !== -1 && m.index > nextId)) {
    throw new Error(`preset ${presetId} has no static patch to write`);
  }

  const open = src.indexOf("{", m.index);
  const close = matchBrace(src, open);
  const body = serializePatchBody(intent, 6, 4);
  return src.slice(0, open) + body + src.slice(close + 1);
}
