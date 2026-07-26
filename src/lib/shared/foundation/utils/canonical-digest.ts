/**
 * canonical-digest — the ONE Web Crypto SHA-256 helper.
 *
 * Eight files independently hand-copied the same four lines (encode →
 * `crypto.subtle.digest("SHA-256", …)` → map each byte to two hex chars →
 * join). This module is the single implementation they all collapse onto.
 * Do not write a ninth. Grep before adding one:
 *   `subtle.digest`, `SHA-256`, `padStart(2, "0")`.
 *
 * Two layers, because the call sites split cleanly in two:
 *
 * - {@link sha256Hex} — bytes (or a UTF-8 string) in, lowercase hex out. This is
 *   what the file/blob/opaque-string hashers want.
 * - {@link canonicalDigest} — an arbitrary value in, hex out, serialized
 *   through the existing {@link canonicalJSON} so key insertion order cannot
 *   change the result. This is what the public-projection digest wants.
 *
 * Output is byte-identical to the expression every existing hasher already
 * uses, so migrating a call site onto `sha256Hex` cannot change a stored hash.
 *
 * ## Environment
 *
 * Relies on the ambient `globalThis.crypto.subtle`, so it works unchanged in
 * the browser, in a Worker, under jsdom, and in Node. The repo's engine floor
 * is `node >=22` (`package.json`), and Web Crypto has been on `globalThis`
 * unflagged since Node 19, so no polyfill is needed for a supported runtime.
 * Scripts that must tolerate an older interpreter keep the guard the existing
 * migrations already use (`scripts/migrations/rehash-content-v2.ts:38-41`):
 *
 * ```ts
 * if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
 *   const { webcrypto } = await import("node:crypto");
 *   (globalThis as { crypto?: unknown }).crypto = webcrypto;
 * }
 * ```
 *
 * That guard stays at the script entry point, not in here — branching on the
 * runtime inside a shared util would drag `node:crypto` into the browser
 * bundle.
 */

import { canonicalJSON } from "./canonical-json";

const encoder = new TextEncoder();

function requireSubtleCrypto(): SubtleCrypto {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto
    ?.subtle;
  if (!subtle) {
    throw new Error(
      "canonical-digest: globalThis.crypto.subtle is unavailable. In the browser " +
        "this means an insecure (non-HTTPS, non-localhost) origin. In Node, " +
        "assign globalThis.crypto = (await import('node:crypto')).webcrypto at " +
        "the entry point, as scripts/migrations/rehash-content-v2.ts does."
    );
  }
  return subtle;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * SHA-256 of the given bytes, as 64 lowercase hex characters.
 *
 * A `string` input is encoded as UTF-8 first, which is exactly what every
 * existing string hasher in this codebase does by hand.
 */
export async function sha256Hex(input: string | BufferSource): Promise<string> {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  return toHex(await requireSubtleCrypto().digest("SHA-256", bytes));
}

/**
 * SHA-256 of a value serialized through {@link canonicalJSON}: object keys are
 * sorted recursively, so two logically-identical objects digest identically no
 * matter what order their keys were assigned in. Array order is preserved,
 * because arrays are ordered data.
 *
 * The helper digests EXACTLY the value it is handed. It has no opinion about
 * which fields belong in a digest — deciding that (for the public projection:
 * source-owned and profile-owned fields in, engagement counters and timestamps
 * out) is the caller's job, and the caller proves it by passing only those
 * fields.
 *
 * Two serialization traps inherited from `canonicalJSON`, both load-bearing for
 * anything that recomputes a digest from a persisted document:
 *
 * 1. **An `undefined` value is NOT the same as an absent key.** `{ a: undefined }`
 *    serializes to `{"a":null}` while `{}` serializes to `{}`, so the two
 *    digest differently — and `{ a: undefined }` and `{ a: null }` digest the
 *    SAME. Firestore drops undefined-valued keys on write (`stripUndefined`,
 *    `src/lib/shared/firestore/firestore-helpers.ts:16`), so a digest computed
 *    over an in-memory object carrying explicit `undefined` will not match one
 *    recomputed after a round trip. Omit optional fields; never set them to
 *    `undefined`.
 * 2. **Class instances collapse to `{}`.** `Date`, Firestore `Timestamp`, `Map`,
 *    and `Set` expose no own enumerable data properties, so `canonicalJSON`
 *    emits `{}` for all of them and two different dates digest identically.
 *    Convert to a primitive (epoch millis, ISO string) before digesting. For
 *    the public-projection digest this is moot by policy — timestamps are
 *    excluded — but it is silent corruption anywhere else.
 */
export async function canonicalDigest(value: unknown): Promise<string> {
  return sha256Hex(canonicalJSON(value));
}
