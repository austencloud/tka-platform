/**
 * Repairs the one legacy Google review profile whose username predates the
 * current 20-character, letters/numbers/underscore/hyphen contract.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-google-review-username.ts
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-google-review-username.ts --apply
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Firestore } from "firebase-admin/firestore";
import { initFirestore } from "../lib/firestore-provider.js";

export const REVIEW_USER_ID = "Tv39DzbAy9O9BZeH5QHmithJ2gC2";
export const LEGACY_REVIEW_USERNAME = "tkascribe.review_7949";
export const REPAIRED_REVIEW_USERNAME = "tkascribereview7949";

type Data = Record<string, unknown>;

export interface ReviewUsernameRepairPlan {
  profilePatch: {
    username: string;
    usernameLowercase: string;
  } | null;
  createDestinationClaim: boolean;
  deleteSourceClaim: boolean;
  changed: boolean;
}

function claimOwner(data: Data | null): string | null {
  return typeof data?.userId === "string" ? data.userId : null;
}

export function buildReviewUsernameRepairPlan(
  profile: Data | null,
  sourceClaim: Data | null,
  destinationClaim: Data | null
): ReviewUsernameRepairPlan {
  const destinationOwnerForAbsentProfile = claimOwner(destinationClaim);

  if (!profile) {
    // The account carries no Firestore profile. That is only safe to treat as
    // "nothing to repair" when no legacy residue is left anywhere: the invalid
    // claim is gone and the valid name is either unclaimed or already this
    // account's. Any other shape means real state we must not paper over, so
    // it still throws.
    const legacyResidue =
      sourceClaim !== null ||
      (destinationOwnerForAbsentProfile !== null &&
        destinationOwnerForAbsentProfile !== REVIEW_USER_ID);

    if (legacyResidue) {
      throw new Error(
        `Review profile users/${REVIEW_USER_ID} does not exist, but legacy username state remains.`
      );
    }

    return {
      profilePatch: null,
      createDestinationClaim: false,
      deleteSourceClaim: false,
      changed: false,
    };
  }

  const currentUsername = profile.username;
  if (
    currentUsername !== LEGACY_REVIEW_USERNAME &&
    currentUsername !== REPAIRED_REVIEW_USERNAME
  ) {
    throw new Error(
      `Review profile username drifted to ${JSON.stringify(currentUsername)}; refusing to overwrite it.`
    );
  }

  const destinationOwner = claimOwner(destinationClaim);
  if (destinationOwner && destinationOwner !== REVIEW_USER_ID) {
    throw new Error(
      `Destination username is already owned by ${destinationOwner}; refusing to steal it.`
    );
  }

  const profileNeedsRepair =
    currentUsername !== REPAIRED_REVIEW_USERNAME ||
    profile.usernameLowercase !== REPAIRED_REVIEW_USERNAME;
  const createDestinationClaim = destinationOwner !== REVIEW_USER_ID;
  const deleteSourceClaim = claimOwner(sourceClaim) === REVIEW_USER_ID;

  return {
    profilePatch: profileNeedsRepair
      ? {
          username: REPAIRED_REVIEW_USERNAME,
          usernameLowercase: REPAIRED_REVIEW_USERNAME,
        }
      : null,
    createDestinationClaim,
    deleteSourceClaim,
    changed: profileNeedsRepair || createDestinationClaim || deleteSourceClaim,
  };
}

function snapshotData(snapshot: {
  exists: boolean;
  data(): Data | undefined;
}): Data | null {
  return snapshot.exists ? (snapshot.data() ?? null) : null;
}

async function readPlan(db: Firestore): Promise<ReviewUsernameRepairPlan> {
  const profileRef = db.collection("users").doc(REVIEW_USER_ID);
  const sourceClaimRef = db.collection("usernames").doc(LEGACY_REVIEW_USERNAME);
  const destinationClaimRef = db
    .collection("usernames")
    .doc(REPAIRED_REVIEW_USERNAME);
  const [profile, sourceClaim, destinationClaim] = await Promise.all([
    profileRef.get(),
    sourceClaimRef.get(),
    destinationClaimRef.get(),
  ]);

  return buildReviewUsernameRepairPlan(
    snapshotData(profile),
    snapshotData(sourceClaim),
    snapshotData(destinationClaim)
  );
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  if (apply && process.env.TKA_ADMIN !== "1") {
    throw new Error("--apply requires TKA_ADMIN=1.");
  }

  const { db, FieldValue, isAdmin } = (await initFirestore()) as {
    db: Firestore;
    FieldValue: { serverTimestamp(): unknown };
    isAdmin: boolean;
  };
  if (!isAdmin) {
    throw new Error("This repair requires Admin SDK credentials.");
  }

  const plan = await readPlan(db);
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        userId: REVIEW_USER_ID,
        from: LEGACY_REVIEW_USERNAME,
        to: REPAIRED_REVIEW_USERNAME,
        plan,
      },
      null,
      2
    )
  );

  if (!apply) {
    console.log("[review-username] Dry-run complete. No documents written.");
    return;
  }

  const profileRef = db.collection("users").doc(REVIEW_USER_ID);
  const sourceClaimRef = db.collection("usernames").doc(LEGACY_REVIEW_USERNAME);
  const destinationClaimRef = db
    .collection("usernames")
    .doc(REPAIRED_REVIEW_USERNAME);

  await db.runTransaction(async (transaction) => {
    const [profile, sourceClaim, destinationClaim] = await transaction.getAll(
      profileRef,
      sourceClaimRef,
      destinationClaimRef
    );
    const currentPlan = buildReviewUsernameRepairPlan(
      snapshotData(profile),
      snapshotData(sourceClaim),
      snapshotData(destinationClaim)
    );

    if (currentPlan.profilePatch) {
      transaction.set(
        profileRef,
        {
          ...currentPlan.profilePatch,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (currentPlan.createDestinationClaim) {
      transaction.set(destinationClaimRef, {
        userId: REVIEW_USER_ID,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    if (currentPlan.deleteSourceClaim) {
      transaction.delete(sourceClaimRef);
    }
  });

  const verification = await readPlan(db);
  if (verification.changed) {
    throw new Error(
      `[review-username] Post-apply verification still proposes writes: ${JSON.stringify(verification)}`
    );
  }

  console.log(
    `[review-username] Verified users/${REVIEW_USER_ID} as ${REPAIRED_REVIEW_USERNAME}.`
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error("[review-username] Repair failed:", error);
    process.exitCode = 1;
  });
}
