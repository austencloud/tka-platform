/**
 * Parity-repair phase 2 rules: dual-compatible publicSequences writes and the
 * publicSequenceHashes claim collection.
 *
 * The write shapes under test mirror what public-sequence-persister.ts
 * produces inside its transaction. Schema-2 writes must satisfy the full
 * field-shape proof; legacy-shape writes stay allowed for old cached clients
 * until phase 4. The getAfter() claim-linkage proof is DEFERRED to phase 4 —
 * the emulator cannot evaluate getAfter at all (see the PHASE 4 DEFERRED test
 * below), and an unverifiable rule that gates every publish must not ship.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const OWNER_UID = "publisher-1";
const OTHER_UID = "publisher-2";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "the-kinetic-alphabet",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
  // ONE clear up front. NO per-test clearFirestore: the emulator's REST clear
  // can resolve before it finishes applying, racing the very next seed write
  // out of existence (observed 2026-07-26: "SEED LOST" fired intermittently on
  // the first test after a clear). Isolation comes from unique document ids
  // per test instead.
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// Long polling is load-bearing, not a preference: over gRPC/WebChannel the
// emulator write stream corrupts on this setup (observed 2026-07-26:
// "RESOURCE_EXHAUSTED: Received message larger than max (1684300900 vs
// 4194304)" followed by max backoff) — batches then stall, resolve without
// landing, and tests flake nondeterministically.
const SDK_SETTINGS = { experimentalForceLongPolling: true };

function ownerCtx() {
  return testEnv.authenticatedContext(OWNER_UID, {
    firebase: { sign_in_provider: "password" },
  });
}
function otherCtx() {
  return testEnv.authenticatedContext(OTHER_UID, {
    firebase: { sign_in_provider: "password" },
  });
}
function ownerDb() {
  return ownerCtx().firestore(SDK_SETTINGS);
}
function otherDb() {
  return otherCtx().firestore(SDK_SETTINGS);
}

/** Unique ids per test so tests cannot collide without any per-test clear. */
function ids(tag: string) {
  const hash = (tag + "a".repeat(64)).slice(0, 64);
  return { seqId: `seq-${tag}`, hash, claimId: `2_${hash}` };
}

function schemaTwoDoc(
  seqId: string,
  hash: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id: seqId,
    ownerId: OWNER_UID,
    sourceRef: `users/${OWNER_UID}/sequences/${seqId}`,
    word: "ABCD",
    sequenceLength: 4,
    contentHash: hash,
    contentHashVersion: 2,
    publicProjectionSchemaVersion: 2,
    publicProjectionRevision: 1,
    publicProjectionDigest: "d".repeat(64),
    thumbnails: [],
    tags: [],
    ...overrides,
  };
}

function claimDoc(
  seqId: string,
  hash: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    sequenceId: seqId,
    ownerId: OWNER_UID,
    contentHash: hash,
    contentHashVersion: 2,
    createdAt: new Date(),
    ...overrides,
  };
}

/** Seed a committed schema-2 publish the way production commits one: the
 *  owner's own batched doc+claim write, which the rules provably accept. */
async function seedPublishedSequence(seqId: string, hash: string, claimId: string) {
  const db = ownerDb();
  const batch = writeBatch(db);
  batch.set(doc(db, `publicSequences/${seqId}`), schemaTwoDoc(seqId, hash));
  batch.set(doc(db, `publicSequenceHashes/${claimId}`), claimDoc(seqId, hash));
  await batch.commit();
  const seeded = await getDoc(doc(db, `publicSequences/${seqId}`));
  if (!seeded.exists()) throw new Error(`SEED LOST: publicSequences/${seqId}`);
}

describe("publicSequences: dual-compatible writes", () => {
  it("allows a legacy-shape write (no schema-2 stamp) from a full user", async () => {
    const db = ownerDb();
    await assertSucceeds(
      setDoc(doc(db, "publicSequences/seq-legacy-shape"), {
        ownerId: OWNER_UID,
        word: "AB",
        thumbnails: [],
      })
    );
  });

  it("allows a well-formed schema-2 publish batched with its claim, and it LANDS", async () => {
    // assertSucceeds on a batch is not proof — a denied batch commit has been
    // observed to resolve while the emulator logged PERMISSION_DENIED on the
    // write stream. Read back.
    const { seqId, hash, claimId } = ids("batchok");
    const db = ownerDb();
    const batch = writeBatch(db);
    batch.set(doc(db, `publicSequences/${seqId}`), schemaTwoDoc(seqId, hash));
    batch.set(doc(db, `publicSequenceHashes/${claimId}`), claimDoc(seqId, hash));
    await assertSucceeds(batch.commit());
    const landedDoc = await getDoc(doc(db, `publicSequences/${seqId}`));
    const landedClaim = await getDoc(doc(db, `publicSequenceHashes/${claimId}`));
    if (!landedDoc.exists() || !landedClaim.exists()) {
      throw new Error("batch reported success but writes did not land");
    }
  });

  it("PHASE 4 DEFERRED: claim linkage is not yet rules-enforced (emulator getAfter is broken)", async () => {
    // The design wants a schema-2 write DENIED unless its claim exists after
    // the transaction (getAfter). firebase-tools 14.23.0 fails every getAfter
    // with "Service call error" (issues #2983/#2067 class), so that rule is
    // unverifiable and is deferred to the phase 4 strict rules. Until then a
    // claimless schema-2 write passes rules — the client persister is what
    // guarantees the claim. This test pins the CURRENT contract so phase 4
    // flips it deliberately.
    const { seqId, hash } = ids("noclaim");
    const db = ownerDb();
    await assertSucceeds(
      setDoc(doc(db, `publicSequences/${seqId}`), schemaTwoDoc(seqId, hash))
    );
  });

  it("denies a schema-2 write missing its identity fields", async () => {
    const { seqId } = ids("badshape");
    const db = ownerDb();
    await assertFails(
      setDoc(
        doc(db, `publicSequences/${seqId}`),
        schemaTwoDoc(seqId, "tooshort", { contentHash: "tooshort" })
      )
    );
    await assertFails(
      setDoc(
        doc(db, `publicSequences/${seqId}`),
        schemaTwoDoc(seqId, ids("badshape").hash, { word: "" })
      )
    );
  });

  it("denies a schema-2 write whose sourceRef points at another user", async () => {
    const { seqId, hash, claimId } = ids("badsrc");
    const db = ownerDb();
    const batch = writeBatch(db);
    batch.set(
      doc(db, `publicSequences/${seqId}`),
      schemaTwoDoc(seqId, hash, {
        sourceRef: `users/${OTHER_UID}/sequences/${seqId}`,
      })
    );
    batch.set(doc(db, `publicSequenceHashes/${claimId}`), claimDoc(seqId, hash));
    await assertFails(batch.commit());
  });

  it("allows a narrow update on a schema-2 doc when its claim already exists", async () => {
    const { seqId, hash, claimId } = ids("patch");
    await seedPublishedSequence(seqId, hash, claimId);

    // The thumbnail-patch shape the persister transaction issues: partial
    // update inside an atomic operation, claim untouched (getAfter sees the
    // existing claim).
    const db = ownerDb();
    const patch = writeBatch(db);
    patch.update(doc(db, `publicSequences/${seqId}`), {
      thumbnails: ["t.png"],
      publicProjectionRevision: 2,
      publicProjectionDigest: "e".repeat(64),
    });
    await assertSucceeds(patch.commit());
  });

  it("denies a non-owner rewriting someone else's public doc", async () => {
    const { seqId, hash, claimId } = ids("hijack");
    await seedPublishedSequence(seqId, hash, claimId);

    // The pre-fix rule checked only the INCOMING ownerId, so an attacker
    // writing their own uid sailed through. Update now also requires owning
    // the existing document.
    const db = otherDb();
    await assertFails(
      setDoc(doc(db, `publicSequences/${seqId}`), {
        ownerId: OTHER_UID,
        word: "STOLEN",
      })
    );
  });
});

describe("admin unpublish allowance", () => {
  const ADMIN_UID = "labeler-admin";
  const PROFILED_UID = "profiled-regular";

  function adminDb() {
    return testEnv
      .authenticatedContext(ADMIN_UID, {
        firebase: { sign_in_provider: "password" },
      })
      .firestore(SDK_SETTINGS);
  }
  function profiledDb() {
    return testEnv
      .authenticatedContext(PROFILED_UID, {
        firebase: { sign_in_provider: "password" },
      })
      .firestore(SDK_SETTINGS);
  }

  it("lets an admin delete another owner's public doc and claim; a profiled non-admin cannot", async () => {
    // The loop-labeler runs unpublishPublicSequence client-side as an admin;
    // owner-check-first ordering means profile-less users still deny via
    // error absorption, and role:'user' profiles deny outright.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `users/${ADMIN_UID}`), { role: "admin" });
      await setDoc(doc(db, `users/${PROFILED_UID}`), { role: "user" });
    });

    const denied = ids("admindeny");
    await seedPublishedSequence(denied.seqId, denied.hash, denied.claimId);
    await assertFails(
      deleteDoc(doc(profiledDb(), `publicSequences/${denied.seqId}`))
    );
    await assertFails(
      deleteDoc(doc(profiledDb(), `publicSequenceHashes/${denied.claimId}`))
    );

    const allowed = ids("adminok");
    await seedPublishedSequence(allowed.seqId, allowed.hash, allowed.claimId);
    await assertSucceeds(
      deleteDoc(doc(adminDb(), `publicSequences/${allowed.seqId}`))
    );
    await assertSucceeds(
      deleteDoc(doc(adminDb(), `publicSequenceHashes/${allowed.claimId}`))
    );
  });
});

describe("publicSequenceHashes: claim rules", () => {
  it("denies a claim whose id does not match its hash pair", async () => {
    const { seqId, hash } = ids("mismatch");
    const db = ownerDb();
    await assertFails(
      setDoc(
        doc(db, `publicSequenceHashes/2_${"b".repeat(64)}`),
        claimDoc(seqId, hash)
      )
    );
  });

  it("denies a claim carrying someone else's ownerId", async () => {
    const { seqId, hash, claimId } = ids("notyours");
    const db = otherDb();
    await assertFails(
      setDoc(doc(db, `publicSequenceHashes/${claimId}`), claimDoc(seqId, hash))
    );
  });

  it("denies claim updates outright — the mapping is immutable", async () => {
    const { seqId, hash, claimId } = ids("immutable");
    const db = ownerDb();
    await setDoc(doc(db, `publicSequenceHashes/${claimId}`), claimDoc(seqId, hash));
    await assertFails(
      updateDoc(doc(db, `publicSequenceHashes/${claimId}`), {
        sequenceId: "hijacked",
      })
    );
  });

  it("lets the owner release their claim and denies everyone else", async () => {
    const { seqId, hash, claimId } = ids("release");
    const seedDb = ownerDb();
    await setDoc(
      doc(seedDb, `publicSequenceHashes/${claimId}`),
      claimDoc(seqId, hash)
    );
    const seeded = await getDoc(doc(seedDb, `publicSequenceHashes/${claimId}`));
    if (!seeded.exists()) throw new Error("SEED LOST: claim");

    await assertFails(
      deleteDoc(doc(otherDb(), `publicSequenceHashes/${claimId}`))
    );
    await assertSucceeds(
      deleteDoc(doc(ownerDb(), `publicSequenceHashes/${claimId}`))
    );
  });

  it("denies claim creation from an anonymous session", async () => {
    const { seqId, hash, claimId } = ids("anon");
    const db = testEnv
      .authenticatedContext("anon-1", {
        firebase: { sign_in_provider: "anonymous" },
      })
      .firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(
        doc(db, `publicSequenceHashes/${claimId}`),
        claimDoc(seqId, hash, { ownerId: "anon-1" })
      )
    );
  });
});
