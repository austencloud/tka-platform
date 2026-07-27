/**
 * Complete a human review of a LABEL_CONTRADICTS_PAYLOAD quarantine: relabel
 * ONE shortcode to its payload-derived word after Austen has watched the code
 * and confirmed the payload is right.
 *
 * Safety: the word is never taken from the command line as free text — the
 * caller passes the word they REVIEWED, and the script re-derives from the
 * live document and refuses unless the two match exactly. Label fields only;
 * scan counts, encoded payloads, ownership, deck/print attribution, and
 * timestamps are never touched (same write shape as
 * backfill-shortcode-words.ts).
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/relabel-reviewed-shortcode.ts <code> <reviewed-word>          # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/relabel-reviewed-shortcode.ts <code> <reviewed-word> --apply  # write
 */
import { initFirestore } from "../lib/firestore-provider.js";
import {
  derivePayloadWord,
  PAYLOAD_SCHEMA_VERSION,
  type AnyRec,
} from "./lib/shortcode-derivation";

if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

async function main(): Promise<void> {
  const [code, reviewedWord] = process.argv.slice(2);
  const APPLY = process.argv.includes("--apply");
  if (!code || !reviewedWord) {
    throw new Error(
      "usage: relabel-reviewed-shortcode.ts <code> <reviewed-word> [--apply]"
    );
  }

  const { db, isAdmin } = (await initFirestore()) as AnyRec & {
    db: AnyRec;
    isAdmin: boolean;
  };
  if (!isAdmin) throw new Error("run with TKA_ADMIN=1");

  const ref = (db.collection as (p: string) => AnyRec)("shortcodes")["doc"](
    code
  ) as AnyRec;
  const snap = await (ref["get"] as () => Promise<AnyRec>)();
  if (!(snap.exists as boolean)) throw new Error(`shortcodes/${code} not found`);
  const data = (snap.data as () => AnyRec)();

  const storedLabel = String(
    data.payloadWord ?? data.sequenceName ?? data.sequence ?? ""
  );
  const derived = await derivePayloadWord(data);
  if (!derived || "conflict" in derived) {
    throw new Error(`${code}: payload sources missing or conflicting — not relabelable`);
  }
  if (!derived.complete || derived.word.length === 0) {
    throw new Error(
      `${code}: derivation incomplete (missing beats ${derived.missingStepIndexes.join(", ")}) — not relabelable`
    );
  }
  if (derived.word !== reviewedWord) {
    throw new Error(
      `${code}: reviewed word ${JSON.stringify(reviewedWord)} does not match live derivation ${JSON.stringify(derived.word)} — refusing`
    );
  }

  console.log(`${code}: ${JSON.stringify(storedLabel)} → ${JSON.stringify(derived.word)} (${derived.stepCount} steps, source: ${derived.source})`);

  if (!APPLY) {
    console.log("dry-run — re-run with --apply to write.");
    process.exit(0);
  }

  await (ref["update"] as (u: AnyRec) => Promise<unknown>)({
    payloadWord: derived.word,
    payloadStepCount: derived.stepCount,
    payloadSchemaVersion: PAYLOAD_SCHEMA_VERSION,
    sequenceName: derived.word,
    sequence: derived.word,
  });
  console.log(`${code}: relabeled.`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
