/**
 * Remove one reviewed public projection whose owner sequence no longer
 * exists. The operation also releases hash claims owned by that sequence and
 * removes stale references from the owner's collections.
 *
 * Dry-run is the default. Apply requires the Admin SDK and rechecks every
 * precondition inside one Firestore transaction.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/delete-reviewed-orphan-public-projection.ts --sequence <id>
 *   TKA_ADMIN=1 npx tsx scripts/migrations/delete-reviewed-orphan-public-projection.ts --sequence <id> --apply
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { initFirestore } from "../lib/firestore-provider.js";

type AnyRec = Record<string, unknown>;

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const sequenceIndex = args.indexOf("--sequence");
const SEQUENCE_ID = sequenceIndex >= 0 ? args[sequenceIndex + 1] : undefined;
if (!SEQUENCE_ID) throw new Error("missing --sequence <publicSequenceId>");

function ownerIdFrom(data: AnyRec): string {
  if (typeof data["ownerId"] === "string" && data["ownerId"]) {
    return data["ownerId"] as string;
  }
  const sourceRef = data["sourceRef"];
  if (typeof sourceRef === "string") {
    const match = /^users\/([^/]+)\/sequences\//.exec(sourceRef);
    if (match?.[1]) return match[1];
  }
  throw new Error("public projection has no provable ownerId");
}

async function main(): Promise<void> {
  const {
    db: rawDb,
    FieldValue,
    isAdmin,
    sdk,
  } = (await initFirestore()) as AnyRec & {
    db: unknown;
    FieldValue: { serverTimestamp(): unknown };
    isAdmin: boolean;
    sdk: string;
  };
  if (!isAdmin) throw new Error("run with TKA_ADMIN=1");
  const db = rawDb as FirebaseFirestore.Firestore;

  const publicRef = db.collection("publicSequences").doc(SEQUENCE_ID);
  const publicSnapshot = await publicRef.get();
  if (!publicSnapshot.exists) {
    console.log(`publicSequences/${SEQUENCE_ID} is already absent`);
    return;
  }
  const publicData = publicSnapshot.data() as AnyRec;
  const ownerId = ownerIdFrom(publicData);
  const ownerRef = db
    .collection("users")
    .doc(ownerId)
    .collection("sequences")
    .doc(SEQUENCE_ID);
  const [
    ownerSnapshot,
    claimsSnapshot,
    collectionsSnapshot,
    shortcodesSnapshot,
  ] = await Promise.all([
    ownerRef.get(),
    db
      .collection("publicSequenceHashes")
      .where("sequenceId", "==", SEQUENCE_ID)
      .get(),
    db
      .collection("users")
      .doc(ownerId)
      .collection("collections")
      .where("sequenceIds", "array-contains", SEQUENCE_ID)
      .get(),
    db.collection("shortcodes").where("sequenceId", "==", SEQUENCE_ID).get(),
  ]);

  if (ownerSnapshot.exists) {
    throw new Error(
      `owner document users/${ownerId}/sequences/${SEQUENCE_ID} exists; this is not an orphan`
    );
  }

  const claims = claimsSnapshot.docs;
  for (const claim of claims) {
    const data = claim.data() as AnyRec;
    if (
      data["sequenceId"] !== SEQUENCE_ID ||
      (typeof data["ownerId"] === "string" && data["ownerId"] !== ownerId)
    ) {
      throw new Error(`claim ${claim.ref.path} is not owned by this orphan`);
    }
  }

  const collections = collectionsSnapshot.docs;
  const shortcodes = shortcodesSnapshot.docs;
  console.log(`via ${sdk}: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`public projection: publicSequences/${SEQUENCE_ID}`);
  console.log(`missing owner: users/${ownerId}/sequences/${SEQUENCE_ID}`);
  console.log(
    `related records: ${claims.length} hash claim(s), ${collections.length} collection reference(s), ${shortcodes.length} durable shortcode link(s)`
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    "scripts",
    "migrations",
    "backups",
    `delete-reviewed-orphan-${SEQUENCE_ID}-${stamp}.json`
  );
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: APPLY ? "apply" : "dry-run",
        reviewedClassification: "ORPHAN_PUBLIC",
        sequenceId: SEQUENCE_ID,
        ownerId,
        documents: {
          publicProjection: {
            path: publicRef.path,
            data: publicData,
          },
          owner: {
            path: ownerRef.path,
            exists: false,
          },
          claims: claims.map((claim) => ({
            path: claim.ref.path,
            data: claim.data(),
          })),
          collections: collections.map((collection) => ({
            path: collection.ref.path,
            data: collection.data(),
          })),
          shortcodes: shortcodes.map((shortcode) => ({
            path: shortcode.ref.path,
            data: shortcode.data(),
          })),
        },
      },
      null,
      2
    )
  );
  console.log(`backup: ${backupPath}`);

  if (!APPLY) {
    console.log("dry-run complete; re-run with --apply after review");
    return;
  }

  await db.runTransaction(async (transaction) => {
    const refs = [
      publicRef,
      ownerRef,
      ...claims.map((claim) => claim.ref),
      ...collections.map((collection) => collection.ref),
    ];
    const [publicNow, ownerNow, ...relatedNow] = await transaction.getAll(
      ...refs
    );
    if (!publicNow.exists) {
      throw new Error("public projection changed during review: now absent");
    }
    if (ownerNow.exists) {
      throw new Error("owner sequence was restored during review");
    }
    if (!publicNow.updateTime.isEqual(publicSnapshot.updateTime)) {
      throw new Error("public projection changed during review");
    }

    const claimNow = relatedNow.slice(0, claims.length);
    const collectionNow = relatedNow.slice(claims.length);
    for (const snapshot of claimNow) {
      const data = snapshot.data() as AnyRec;
      if (
        !snapshot.exists ||
        data["sequenceId"] !== SEQUENCE_ID ||
        (typeof data["ownerId"] === "string" && data["ownerId"] !== ownerId)
      ) {
        throw new Error("an owned hash claim changed during review");
      }
    }

    transaction.delete(publicRef);
    for (const claim of claims) transaction.delete(claim.ref);
    for (let index = 0; index < collections.length; index++) {
      const snapshot = collectionNow[index];
      if (!snapshot?.exists) continue;
      const data = snapshot.data() as AnyRec;
      const sequenceIds = Array.isArray(data["sequenceIds"])
        ? (data["sequenceIds"] as unknown[]).filter(
            (id): id is string => typeof id === "string"
          )
        : [];
      const remaining = sequenceIds.filter((id) => id !== SEQUENCE_ID);
      transaction.update(collections[index]!.ref, {
        sequenceIds: remaining,
        sequenceCount: remaining.length,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  const [publicAfter, claimsAfter, collectionsAfter] = await Promise.all([
    publicRef.get(),
    Promise.all(claims.map((claim) => claim.ref.get())),
    Promise.all(collections.map((collection) => collection.ref.get())),
  ]);
  const staleCollections = collectionsAfter.filter((snapshot) => {
    const ids = snapshot.exists ? snapshot.data()?.["sequenceIds"] : [];
    return Array.isArray(ids) && ids.includes(SEQUENCE_ID);
  });
  if (
    publicAfter.exists ||
    claimsAfter.some((snapshot) => snapshot.exists) ||
    staleCollections.length > 0
  ) {
    throw new Error("delete committed but verification found stale records");
  }
  console.log(
    `deleted and verified public projection, ${claims.length} claim(s), and ${collections.length} collection reference(s)`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
