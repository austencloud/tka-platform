/**
 * Locate the catalog source(s) for a shortcode whose sequenceId is a
 * catalog-style id (deck mints carry no ownerId/deckId). Lists catalog refs
 * (listDocuments reads no documents) and getAll-probes
 * catalogs/{id}/sequences/{sequenceId} — there is no collection-group index
 * on `word`, so id-probing is the only indexless path. Hydrates each hit
 * through trySequenceNormalization and reports its derived word, beat count,
 * and content hash next to the record's encoderHash — the evidence the
 * payload rebuild uses to pick a source safely.
 *
 *   TKA_ADMIN=1 npx tsx scripts/diagnostics/probe-catalog-source.ts 0HP3
 */
import { initFirestore } from "../lib/firestore-provider.js";
import { deriveFromSteps, type AnyRec } from "../migrations/lib/shortcode-derivation";
import { trySequenceNormalization } from "../../src/lib/shared/library/services/sequence-persistence-normalizer";
import { sha256Hex } from "../../src/lib/shared/foundation/utils/canonical-digest";
import { encodeSequence } from "../../src/lib/shared/navigation/services/sequence-encoder";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

async function main(): Promise<void> {
  const code = process.argv[2];
  if (!code) throw new Error("usage: probe-catalog-source.ts <code>");
  const { db, isAdmin } = (await initFirestore()) as {
    db: AnyRec;
    isAdmin: boolean;
  };
  if (!isAdmin) throw new Error("TKA_ADMIN=1 required (collection-group query)");

  const snap = await (db.doc as (p: string) => AnyRec)(`shortcodes/${code}`)[
    "get" as never
  ]();
  const data = (snap as { data: () => AnyRec }).data() ?? {};
  const label =
    (data.sequenceName as string) || (data.sequence as string) || "";
  console.log(`code ${code} | label ${JSON.stringify(label)}`);
  console.log(`  sequenceId ${data.sequenceId} | encoderHash ${data.encoderHash}`);

  const sequenceId = String(data.sequenceId ?? "");
  const catalogRefs = (await (
    (db.collection as (p: string) => AnyRec)("catalogs")[
      "listDocuments" as never
    ] as () => Promise<Array<{ id: string }>>
  )()) as Array<{ id: string }>;
  console.log(`  probing ${catalogRefs.length} catalogs for id ${sequenceId}`);
  const docRefs = catalogRefs.map((c) =>
    (db.doc as (p: string) => AnyRec)(`catalogs/${c.id}/sequences/${sequenceId}`)
  );
  const hits: Array<{ ref: { path: string }; id: string; data: () => AnyRec }> = [];
  const CHUNK = 300;
  for (let i = 0; i < docRefs.length; i += CHUNK) {
    const snaps = (await (db.getAll as (...r: AnyRec[]) => Promise<AnyRec[]>)(
      ...docRefs.slice(i, i + CHUNK)
    )) as Array<{
      exists: boolean;
      id: string;
      ref: { path: string };
      data: () => AnyRec;
    }>;
    for (const snap of snaps) if (snap.exists) hits.push(snap);
  }

  for (const doc of hits) {
    const normalization = await trySequenceNormalization({
      ...(doc.data() as object),
      id: doc.id,
    } as SequenceData);
    if (!normalization.ok) {
      console.log(`  ${doc.ref.path}  NORMALIZATION FAILED: ${normalization.code}`);
      continue;
    }
    const hydrated = normalization.value.hydrated;
    const derived = deriveFromSteps(
      (hydrated.steps ?? []) as unknown as AnyRec[],
      "embedded"
    );
    const hash = await sha256Hex(encodeSequence(hydrated));
    const marker = hash === data.encoderHash ? "  << MATCHES record.encoderHash" : "";
    console.log(
      `  ${doc.ref.path}\n    derived ${JSON.stringify(derived.word)} (${derived.stepCount} beats, complete=${derived.complete})\n    hash ${hash}${marker}`
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
