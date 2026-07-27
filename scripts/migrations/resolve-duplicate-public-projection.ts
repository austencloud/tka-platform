/**
 * Resolve a DUPLICATE_HASH_CONFLICT pair from the corpus reconcile
 * (parity-repair spec, phase 3): two publicSequences documents carrying the
 * SAME content hash contest one claim, and the reconcile deliberately never
 * chooses a survivor. This script executes an explicit human pick.
 *
 * Safety model:
 *   - proves the pair is a TRUE duplicate before any write: both owner
 *     sources must normalize (trySequenceNormalization) to the SAME claim id
 *     ({contentHashVersion}_{contentHash}) — the exact identity the claim
 *     system enforces;
 *   - both docs must share one ownerId (a cross-owner duplicate is a policy
 *     decision, not a cleanup — refuse);
 *   - writes a full four-document backup (public + owner, loser + survivor)
 *     to scripts/migrations/backups/ before touching anything;
 *   - the loser's public projection is DELETED and its owner source flipped
 *     to visibility "private" (leaving it "public" invites a future sync to
 *     resurrect the duplicate), both under lastUpdateTime preconditions;
 *   - the survivor is never written — rerun the corpus reconcile
 *     (--sequence <survivor>) afterwards to mint its claim + reprojection
 *     through the already-reviewed path.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/resolve-duplicate-public-projection.ts \
 *     --loser <publicDocId> --survivor <publicDocId> [--apply]
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { initFirestore } from "../lib/firestore-provider.js";
import { trySequenceNormalization } from "../../src/lib/shared/library/services/sequence-persistence-normalizer";
import {
  publicSequenceClaimId,
  PUBLIC_SEQUENCE_HASH_COLLECTION,
} from "../../src/lib/shared/library/services/public-sequence-persister";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

type AnyRec = Record<string, unknown>;

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const argOf = (flag: string): string => {
  const i = argv.indexOf(flag);
  if (i < 0 || !argv[i + 1]) throw new Error(`missing ${flag} <publicDocId>`);
  return argv[i + 1]!;
};
const LOSER = argOf("--loser");
const SURVIVOR = argOf("--survivor");
if (LOSER === SURVIVOR) throw new Error("loser and survivor are the same id");

interface AdminDocSnap {
  exists: boolean;
  id: string;
  updateTime?: unknown;
  data(): AnyRec | undefined;
}
interface AdminDocRef {
  path: string;
  get(): Promise<AdminDocSnap>;
  update(data: AnyRec, precondition?: { lastUpdateTime: unknown }): Promise<unknown>;
  delete(precondition?: { lastUpdateTime: unknown }): Promise<unknown>;
}
interface AdminDb {
  doc(path: string): AdminDocRef;
}

async function mustGet(db: AdminDb, path: string): Promise<AdminDocSnap> {
  const snap = await db.doc(path).get();
  if (!snap.exists) {
    throw new Error(
      `${path} does not exist (received id codepoints: ${[...path].map((c) => c.codePointAt(0)!.toString(16)).join(" ")})`
    );
  }
  return snap;
}

async function claimIdOfOwnerDoc(data: AnyRec, id: string): Promise<string> {
  const normalization = await trySequenceNormalization({
    ...(data as object),
    id,
  } as SequenceData);
  if (!normalization.ok) {
    throw new Error(`owner source ${id} failed normalization: ${normalization.code}`);
  }
  return publicSequenceClaimId(
    normalization.value.contentHashVersion,
    normalization.value.contentHash
  );
}

async function main(): Promise<void> {
  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & {
    db: AdminDb;
    sdk: string;
    isAdmin: boolean;
  };
  if (!isAdmin) throw new Error("duplicate resolution deletes a public doc — run with TKA_ADMIN=1");
  console.log(`via ${sdk} — ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`loser:    publicSequences/${LOSER}`);
  console.log(`survivor: publicSequences/${SURVIVOR}`);

  const loserPublic = await mustGet(db, `publicSequences/${LOSER}`);
  const survivorPublic = await mustGet(db, `publicSequences/${SURVIVOR}`);
  const ownerId = String(loserPublic.data()?.ownerId ?? "");
  if (!ownerId || ownerId !== String(survivorPublic.data()?.ownerId ?? "")) {
    throw new Error(
      `ownerId mismatch (${ownerId} vs ${survivorPublic.data()?.ownerId}) — cross-owner duplicates need a policy decision, refusing`
    );
  }

  const loserOwner = await mustGet(db, `users/${ownerId}/sequences/${LOSER}`);
  const survivorOwner = await mustGet(db, `users/${ownerId}/sequences/${SURVIVOR}`);

  const loserClaim = await claimIdOfOwnerDoc(loserOwner.data() ?? {}, LOSER);
  const survivorClaim = await claimIdOfOwnerDoc(survivorOwner.data() ?? {}, SURVIVOR);
  console.log(`loser claim:    ${loserClaim}`);
  console.log(`survivor claim: ${survivorClaim}`);
  if (loserClaim !== survivorClaim) {
    throw new Error(
      "content hashes DIFFER — these are not duplicates; refusing to delete anything"
    );
  }

  const claimSnap = await db
    .doc(`${PUBLIC_SEQUENCE_HASH_COLLECTION}/${loserClaim}`)
    .get();
  console.log(
    `claim doc ${loserClaim}: ${claimSnap.exists ? `EXISTS → sequenceId ${claimSnap.data()?.sequenceId}` : "absent (contested pair was excluded from reconcile apply)"}`
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    "scripts",
    "migrations",
    "backups",
    `duplicate-resolution-${stamp}.json`
  );
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: APPLY ? "apply" : "dry-run",
        claimId: loserClaim,
        loser: LOSER,
        survivor: SURVIVOR,
        ownerId,
        docs: {
          [`publicSequences/${LOSER}`]: loserPublic.data(),
          [`publicSequences/${SURVIVOR}`]: survivorPublic.data(),
          [`users/${ownerId}/sequences/${LOSER}`]: loserOwner.data(),
          [`users/${ownerId}/sequences/${SURVIVOR}`]: survivorOwner.data(),
        },
      },
      null,
      2
    )
  );
  console.log(`backup: ${backupPath}`);

  if (!APPLY) {
    console.log(
      `DRY-RUN — would delete publicSequences/${LOSER} and set users/${ownerId}/sequences/${LOSER} visibility → "private". Re-run with --apply.`
    );
    process.exit(0);
  }

  await db
    .doc(`publicSequences/${LOSER}`)
    .delete({ lastUpdateTime: loserPublic.updateTime });
  console.log(`deleted publicSequences/${LOSER}`);
  await db
    .doc(`users/${ownerId}/sequences/${LOSER}`)
    .update({ visibility: "private" }, { lastUpdateTime: loserOwner.updateTime });
  console.log(`users/${ownerId}/sequences/${LOSER} visibility → "private"`);
  console.log(
    `done. Now rerun the reconcile for the survivor:\n  TKA_ADMIN=1 npx tsx scripts/migrations/reconcile-sequence-public-projections.ts --sequence ${SURVIVOR} --apply`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
