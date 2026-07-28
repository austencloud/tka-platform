/**
 * Permanently remove the reviewed legacy solo sequence behind shortcode 3CLR.
 *
 * This is intentionally narrow. It refuses any other code, any payload that
 * is not one-hand choreography, any payload with a complete TKA word, or any
 * shortcode already migrated to schema 3. Before the apply batch it writes a
 * full backup of the shortcode, source sequence, public projection, hash
 * claims, collection references, and owner profile.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/delete-reviewed-legacy-solo-shortcode.ts
 *   TKA_ADMIN=1 npx tsx scripts/migrations/delete-reviewed-legacy-solo-shortcode.ts --apply
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { initFirestore } from "../lib/firestore-provider.js";
import { derivePayloadWord, type AnyRec } from "./lib/shortcode-derivation";
import { decodeSequenceFromQR } from "../../src/lib/shared/navigation/services/sequence-encoder";
import { getSequenceMotionProfile } from "../../src/lib/shared/foundation/services/sequence-motion-profile";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

const CODE = "3CLR";
const APPLY = process.argv.includes("--apply");

interface DocumentCopy {
  path: string;
  exists: boolean;
  data: AnyRec | null;
}

async function copyDocument(ref: AnyRec): Promise<DocumentCopy> {
  const snap = await (ref.get as () => Promise<AnyRec>)();
  return {
    path: ref.path as string,
    exists: snap.exists as boolean,
    data: (snap.exists as boolean) ? (snap.data as () => AnyRec)() : null,
  };
}

function sourceIdentity(data: AnyRec): {
  ownerId: string;
  sequenceId: string;
} {
  let ownerId =
    typeof data.ownerId === "string" && data.ownerId ? data.ownerId : "";
  let sequenceId =
    (typeof data.sourceSequenceId === "string" && data.sourceSequenceId) ||
    (typeof data.sequenceId === "string" && data.sequenceId) ||
    "";
  const sourceRef = typeof data.sourceRef === "string" ? data.sourceRef : "";
  const match = sourceRef.match(/^users\/([^/]+)\/sequences\/([^/]+)$/);
  if (match) {
    ownerId ||= match[1]!;
    sequenceId ||= match[2]!;
  }
  if (!ownerId || !sequenceId) {
    throw new Error(
      `${CODE}: cannot prove the owner/source sequence identity from the shortcode`
    );
  }
  return { ownerId, sequenceId };
}

async function main(): Promise<void> {
  if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
    const { webcrypto } = await import("node:crypto");
    (globalThis as { crypto?: unknown }).crypto = webcrypto;
  }

  const { db, FieldValue, isAdmin, sdk } = (await initFirestore()) as AnyRec & {
    db: AnyRec;
    FieldValue: {
      serverTimestamp(): unknown;
    };
    isAdmin: boolean;
    sdk: string;
  };
  if (!isAdmin) throw new Error("run with TKA_ADMIN=1");

  const shortcodeRef = db.collection("shortcodes").doc(CODE) as AnyRec;
  const shortcode = await copyDocument(shortcodeRef);
  if (!shortcode.exists || !shortcode.data) {
    throw new Error(`shortcodes/${CODE} not found`);
  }
  if (shortcode.data.payloadKind === "solo") {
    throw new Error(`${CODE}: already uses the supported schema-3 solo format`);
  }
  if (
    typeof shortcode.data.encoded !== "string" ||
    shortcode.data.encoded.length === 0
  ) {
    throw new Error(`${CODE}: reviewed legacy payload blob is missing`);
  }

  const decoded = (await decodeSequenceFromQR(
    shortcode.data.encoded
  )) as SequenceData;
  const profile = getSequenceMotionProfile(decoded);
  if (profile.kind !== "solo") {
    throw new Error(
      `${CODE}: live payload is ${profile.kind}, not reviewed solo choreography`
    );
  }
  const derivation = await derivePayloadWord(shortcode.data);
  if (!derivation || "conflict" in derivation || derivation.complete) {
    throw new Error(
      `${CODE}: payload is no longer the reviewed incomplete-word quarantine`
    );
  }

  const { ownerId, sequenceId } = sourceIdentity(shortcode.data);
  const ownerRef = db
    .collection("users")
    .doc(ownerId)
    .collection("sequences")
    .doc(sequenceId) as AnyRec;
  const publicRef = db.collection("publicSequences").doc(sequenceId) as AnyRec;
  const profileRef = db.collection("users").doc(ownerId) as AnyRec;
  const [owner, publicProjection, ownerProfile] = await Promise.all([
    copyDocument(ownerRef),
    copyDocument(publicRef),
    copyDocument(profileRef),
  ]);
  const [
    shortcodeClaimSnap,
    publicClaimSnap,
    collectionSnap,
    physicalCardSnap,
  ] = await Promise.all([
    db.collection("shortcodeHashes").where("code", "==", CODE).get(),
    db
      .collection("publicSequenceHashes")
      .where("sequenceId", "==", sequenceId)
      .get(),
    db
      .collection("users")
      .doc(ownerId)
      .collection("collections")
      .where("sequenceIds", "array-contains", sequenceId)
      .get(),
    db.collection("physicalCards").where("shortCode", "==", CODE).get(),
  ]);
  if (!physicalCardSnap.empty) {
    throw new Error(
      `${CODE}: ${physicalCardSnap.size} issued physical card(s) still depend on this code`
    );
  }

  const shortcodeClaims = await Promise.all(
    shortcodeClaimSnap.docs.map((doc: AnyRec) => copyDocument(doc.ref))
  );
  const publicClaims = await Promise.all(
    publicClaimSnap.docs.map((doc: AnyRec) => copyDocument(doc.ref))
  );
  const collections = await Promise.all(
    collectionSnap.docs.map((doc: AnyRec) => copyDocument(doc.ref))
  );

  console.log(`via ${sdk} — ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(
    `${CODE}: ${decoded.steps.length} ${profile.authoredHand}-hand steps, ` +
      `${derivation.missingStepIndexes.length}/${derivation.stepCount} letters unresolved`
  );
  console.log(
    `source: users/${ownerId}/sequences/${sequenceId} (${
      owner.exists ? "present" : "already absent"
    })`
  );
  console.log(
    `related: shortcode claims ${shortcodeClaims.length}, public projection ${
      publicProjection.exists ? 1 : 0
    }, public claims ${publicClaims.length}, collections ${collections.length}`
  );

  if (!APPLY) {
    console.log("dry-run — re-run with --apply to back up and delete.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    "scripts",
    "migrations",
    "backups",
    `delete-reviewed-legacy-solo-${CODE}-${stamp}.json`
  );
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        operation:
          "Delete reviewed legacy one-hand sequence with no valid TKA word",
        code: CODE,
        reviewedClassification: {
          motionProfile: profile,
          stepCount: derivation.stepCount,
          missingStepIndexes: derivation.missingStepIndexes,
        },
        documents: {
          shortcode,
          shortcodeClaims,
          owner,
          publicProjection,
          publicClaims,
          collections,
          ownerProfile,
          physicalCards: [],
        },
      },
      null,
      2
    )
  );
  console.log(`backup: ${backupPath}`);

  const batch = db.batch() as AnyRec;
  batch.delete(shortcodeRef);
  for (const claim of shortcodeClaimSnap.docs) batch.delete(claim.ref);
  batch.delete(ownerRef);
  if (publicProjection.exists) batch.delete(publicRef);
  for (const claim of publicClaimSnap.docs) batch.delete(claim.ref);
  for (const collection of collectionSnap.docs) {
    const data = collection.data() as AnyRec;
    const sequenceIds = Array.isArray(data.sequenceIds)
      ? data.sequenceIds.filter((id: unknown) => id !== sequenceId)
      : [];
    batch.update(collection.ref, {
      sequenceIds,
      sequenceCount: sequenceIds.length,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  if (
    ownerProfile.exists &&
    owner.exists &&
    typeof ownerProfile.data?.sequenceCount === "number" &&
    ownerProfile.data.sequenceCount > 0
  ) {
    batch.update(profileRef, {
      sequenceCount: ownerProfile.data.sequenceCount - 1,
      lastActivityDate: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  const verificationRefs = [
    shortcodeRef,
    ownerRef,
    ...(publicProjection.exists ? [publicRef] : []),
    ...shortcodeClaimSnap.docs.map((doc: AnyRec) => doc.ref),
    ...publicClaimSnap.docs.map((doc: AnyRec) => doc.ref),
  ];
  const verification = await Promise.all(
    verificationRefs.map((ref) => copyDocument(ref))
  );
  const survivors = verification.filter((doc) => doc.exists);
  if (survivors.length > 0) {
    throw new Error(
      `delete committed but ${survivors.map((doc) => doc.path).join(", ")} still exist`
    );
  }
  console.log(
    `${CODE}: deleted shortcode, source sequence, projection, and owned claims; verification passed.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
