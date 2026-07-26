/**
 * snapshot-public-corpus — recoverable pre-migration snapshot (parity spec,
 * phase 3 step 1). Dumps every publicSequences document, every
 * publicSequenceHashes claim, and each public document's owner source doc to
 * one timestamped JSON in scripts/migrations/backups/.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/snapshot-public-corpus.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { initFirestore } from "../lib/firestore-provider.js";

type AnyRec = Record<string, unknown>;

async function main(): Promise<void> {
  const { db, sdk } = (await initFirestore()) as {
    db: {
      collection(path: string): {
        doc(id: string): { get(): Promise<{ exists: boolean; data(): AnyRec | undefined }> };
        get(): Promise<{ docs: Array<{ id: string; data(): AnyRec }> }>;
      };
    };
    sdk: string;
  };
  if (sdk !== "admin") {
    console.error("Snapshot requires the Admin SDK — set TKA_ADMIN=1.");
    process.exit(1);
  }

  const pub = await db.collection("publicSequences").get();
  const claims = await db.collection("publicSequenceHashes").get();

  const owners: Array<{ path: string; data: AnyRec }> = [];
  for (const d of pub.docs) {
    const data = d.data();
    const ownerId =
      typeof data["ownerId"] === "string" && data["ownerId"]
        ? (data["ownerId"] as string)
        : typeof data["sourceRef"] === "string"
          ? /^users\/([^/]+)\//.exec(data["sourceRef"] as string)?.[1]
          : undefined;
    if (!ownerId) continue;
    const o = await db.collection(`users/${ownerId}/sequences`).doc(d.id).get();
    if (o.exists) {
      owners.push({ path: `users/${ownerId}/sequences/${d.id}`, data: o.data() ?? {} });
    }
  }

  const snapshot = {
    takenAt: new Date().toISOString(),
    publicSequences: pub.docs.map((d) => ({ id: d.id, data: d.data() })),
    publicSequenceHashes: claims.docs.map((d) => ({ id: d.id, data: d.data() })),
    ownerDocs: owners,
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = join(
    "scripts",
    "migrations",
    "backups",
    `pre-reconcile-snapshot-${stamp}.json`
  );
  writeFileSync(out, JSON.stringify(snapshot));
  console.log(
    `snapshot: ${out} | public: ${snapshot.publicSequences.length} | owners: ${owners.length} | claims: ${snapshot.publicSequenceHashes.length}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
