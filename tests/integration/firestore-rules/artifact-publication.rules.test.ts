/**
 * Visual-artifact publication boundary (Browse Phase 3, publish-first): the
 * four-resource matrix. Owners publish directly — ledger entry, immutable
 * revision, and guest envelope in one batch whose shape the rules verify —
 * and may withdraw and republish their own work. Admins alone perform
 * takedowns, and `removed` is terminal for that exact content. Guests read
 * only live envelopes and — via the parent-exists cascade — only live
 * revisions. The write shapes under test mirror what
 * tunnel-publication-service.ts and artifact-publication-review.ts produce.
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
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const OWNER_UID = "artifact-owner-1";
const OTHER_UID = "artifact-owner-2";
const ADMIN_UID = "artifact-admin-1";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "the-kinetic-alphabet",
    firestore: {
      rules: readFileSync(
        resolve(__dirname, "../../../firestore.rules"),
        "utf8"
      ),
      host: "127.0.0.1",
      port: 8080,
    },
  });
  // ONE clear up front; isolation via unique ids per test (see
  // public-sequence-parity.rules.test.ts for the race this avoids).
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// Long polling is load-bearing on this setup — see the parity suite.
const SDK_SETTINGS = { experimentalForceLongPolling: true };

function ownerDb() {
  return testEnv
    .authenticatedContext(OWNER_UID, {
      firebase: { sign_in_provider: "password" },
    })
    .firestore(SDK_SETTINGS);
}
function otherDb() {
  return testEnv
    .authenticatedContext(OTHER_UID, {
      firebase: { sign_in_provider: "password" },
    })
    .firestore(SDK_SETTINGS);
}
function anonDb() {
  return testEnv
    .authenticatedContext("anon-visitor", {
      firebase: { sign_in_provider: "anonymous" },
    })
    .firestore(SDK_SETTINGS);
}
function guestDb() {
  return testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
}
function adminDb() {
  return testEnv
    .authenticatedContext(ADMIN_UID, {
      role: "admin",
      admin: true,
      firebase: { sign_in_provider: "password" },
    })
    .firestore(SDK_SETTINGS);
}

/** Unique, rule-shaped ids per test tag. */
function ids(tag: string) {
  const contentDigest = (tag.replace(/[^a-f0-9]/g, "") + "a".repeat(64)).slice(
    0,
    64
  );
  const sourceDigest = (tag.replace(/[^a-f0-9]/g, "") + "b".repeat(64)).slice(
    0,
    64
  );
  const artifactId = `tunnel-${tag}`;
  const revisionId = `v1_${contentDigest}`;
  return {
    artifactId,
    contentDigest,
    sourceDigest,
    revisionId,
    requestId: `${artifactId}_${revisionId}`,
    requestPath: `artifactPublicationRequests/${artifactId}_${revisionId}`,
    envelopePath: `publicArtifacts/${artifactId}`,
    revisionPath: `publicArtifacts/${artifactId}/revisions/${revisionId}`,
  };
}

function requestDoc(
  x: ReturnType<typeof ids>,
  overrides: Record<string, unknown> = {}
) {
  return {
    requestId: x.requestId,
    artifactId: x.artifactId,
    artifactType: "tunnel",
    ownerId: OWNER_UID,
    ownerDisplayName: "Austen",
    title: "My Tunnel",
    revisionId: x.revisionId,
    contentDigest: x.contentDigest,
    digestAlgorithm: "SHA-256",
    digestVersion: 1,
    payload: { steps: [], poster: "data:image/webp;base64,AA" },
    posterUrl: "https://example.test/poster.webp",
    sourceRevision: {
      artifactId: x.artifactId,
      revisionId: `v1_${x.sourceDigest}`,
      contentDigest: x.sourceDigest,
      digestAlgorithm: "SHA-256",
      digestVersion: 1,
    },
    status: "published",
    requestedAt: new Date(),
    schemaVersion: 1,
    ...overrides,
  };
}

function revisionDoc(
  x: ReturnType<typeof ids>,
  overrides: Record<string, unknown> = {}
) {
  return {
    artifactId: x.artifactId,
    revisionId: x.revisionId,
    contentDigest: x.contentDigest,
    digestAlgorithm: "SHA-256",
    digestVersion: 1,
    artifactType: "tunnel",
    ownerId: OWNER_UID,
    payload: { steps: [], poster: "data:image/webp;base64,AA" },
    createdAt: new Date(),
    schemaVersion: 1,
    ...overrides,
  };
}

function envelopeDoc(
  x: ReturnType<typeof ids>,
  overrides: Record<string, unknown> = {}
) {
  return {
    artifactId: x.artifactId,
    artifactType: "tunnel",
    ownerId: OWNER_UID,
    ownerDisplayName: "Austen",
    title: "My Tunnel",
    posterUrl: "https://example.test/poster.webp",
    currentRevisionId: x.revisionId,
    currentContentDigest: x.contentDigest,
    publishedAt: new Date(0),
    updatedAt: new Date(),
    schemaVersion: 1,
    ...overrides,
  };
}

/** A live publication's full committed result, seeded rules-disabled. */
async function seedLivePublication(x: ReturnType<typeof ids>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, x.requestPath), requestDoc(x));
    await setDoc(doc(db, x.revisionPath), revisionDoc(x));
    await setDoc(doc(db, x.envelopePath), envelopeDoc(x));
  });
}

/** A withdrawn publication: ledger + revision persist, envelope is gone. */
async function seedWithdrawnPublication(x: ReturnType<typeof ids>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(
      doc(db, x.requestPath),
      requestDoc(x, { status: "withdrawn" })
    );
    await setDoc(doc(db, x.revisionPath), revisionDoc(x));
  });
}

/** The owner publish batch exactly as tunnel-publication-service.ts writes
 *  it: ledger entry (published) + immutable revision + live envelope, with
 *  server-time publishedAt. */
function publishBatch(
  db: ReturnType<typeof ownerDb>,
  x: ReturnType<typeof ids>,
  overrides: {
    request?: Record<string, unknown>;
    envelope?: Record<string, unknown>;
  } = {}
) {
  const batch = writeBatch(db);
  batch.set(doc(db, x.requestPath), requestDoc(x, overrides.request));
  batch.set(doc(db, x.revisionPath), revisionDoc(x));
  batch.set(
    doc(db, x.envelopePath),
    envelopeDoc(x, {
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...overrides.envelope,
    })
  );
  return batch;
}

describe("owner publishing", () => {
  it("the full owner publish batch (ledger+revision+envelope) succeeds and LANDS", async () => {
    const x = ids("publish-ok");
    await assertSucceeds(publishBatch(ownerDb(), x).commit());
    const landed = await getDoc(doc(guestDb(), x.envelopePath));
    if (!landed.exists()) throw new Error(`SEED LOST: ${x.envelopePath}`);
  });

  it("a bare ledger entry claiming published, without the projection, is denied", async () => {
    const x = ids("publish-bare");
    await assertFails(setDoc(doc(ownerDb(), x.requestPath), requestDoc(x)));
  });

  it("a bare envelope without the ledger entry is denied", async () => {
    const x = ids("env-bare");
    const db = ownerDb();
    const batch = writeBatch(db);
    batch.set(doc(db, x.revisionPath), revisionDoc(x));
    batch.set(
      doc(db, x.envelopePath),
      envelopeDoc(x, {
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(batch.commit());
  });

  it("a backdated publishedAt on the owner's envelope is denied", async () => {
    const x = ids("publish-backdate");
    await assertFails(
      publishBatch(ownerDb(), x, {
        envelope: { publishedAt: new Date(0) },
      }).commit()
    );
  });

  it("forging another user's ownerId is denied, and anonymous users cannot publish", async () => {
    const x = ids("publish-forge");
    await assertFails(publishBatch(otherDb(), x).commit());
    const y = ids("publish-anon");
    await assertFails(
      publishBatch(anonDb(), y, {
        request: { ownerId: "anon-visitor" },
        envelope: { ownerId: "anon-visitor" },
      }).commit()
    );
  });

  it("a mismatched content address is denied", async () => {
    const x = ids("publish-shape");
    await assertFails(
      publishBatch(ownerDb(), x, {
        request: { contentDigest: "f".repeat(64) },
      }).commit()
    );
  });

  it("a ledger entry whose provenance names a different artifact is denied", async () => {
    const x = ids("publish-prov");
    await assertFails(
      publishBatch(ownerDb(), x, {
        request: {
          sourceRevision: {
            artifactId: "some-other-artifact",
            revisionId: `v1_${x.sourceDigest}`,
            contentDigest: x.sourceDigest,
            digestAlgorithm: "SHA-256",
            digestVersion: 1,
          },
        },
      }).commit()
    );
  });
});

describe("ledger reads and frozen fields", () => {
  it("ledger reads: owner and admin yes; other users and guests no", async () => {
    const x = ids("req-reads");
    await seedLivePublication(x);
    await assertSucceeds(getDoc(doc(ownerDb(), x.requestPath)));
    await assertSucceeds(getDoc(doc(adminDb(), x.requestPath)));
    await assertFails(getDoc(doc(otherDb(), x.requestPath)));
    await assertFails(getDoc(doc(guestDb(), x.requestPath)));
  });

  it("owner may not edit frozen ledger fields, and nobody may delete", async () => {
    const x = ids("req-frozen");
    await seedLivePublication(x);
    await assertFails(
      updateDoc(doc(ownerDb(), x.requestPath), { title: "Renamed" })
    );
    await assertFails(deleteDoc(doc(ownerDb(), x.requestPath)));
    await assertFails(deleteDoc(doc(adminDb(), x.requestPath)));
  });

  it("a non-admin cannot mark someone's content removed", async () => {
    const x = ids("req-fake-mod");
    await seedLivePublication(x);
    await assertFails(
      updateDoc(doc(otherDb(), x.requestPath), {
        status: "removed",
        reviewedAt: new Date(),
        reviewedBy: OTHER_UID,
      })
    );
  });
});

describe("guest projection", () => {
  it("guests read the envelope and its revision while live", async () => {
    const x = ids("guest-reads");
    await seedLivePublication(x);
    await assertSucceeds(getDoc(doc(guestDb(), x.envelopePath)));
    await assertSucceeds(getDoc(doc(guestDb(), x.revisionPath)));
  });

  it("revisions are immutable and admin-delete-only", async () => {
    const x = ids("rev-immutable");
    await seedLivePublication(x);
    await assertFails(
      updateDoc(doc(adminDb(), x.revisionPath), { schemaVersion: 2 })
    );
    await assertFails(deleteDoc(doc(ownerDb(), x.revisionPath)));
  });

  it("publishing a NEW revision advances the envelope but must preserve publishedAt", async () => {
    const x = ids("publish-v2");
    await seedLivePublication(x);
    const v2 = {
      ...x,
      ...(() => {
        const contentDigest = "c".repeat(64);
        const revisionId = `v1_${contentDigest}`;
        return {
          contentDigest,
          revisionId,
          requestId: `${x.artifactId}_${revisionId}`,
          requestPath: `artifactPublicationRequests/${x.artifactId}_${revisionId}`,
          revisionPath: `publicArtifacts/${x.artifactId}/revisions/${revisionId}`,
        };
      })(),
    };

    // Forged publishedAt → denied.
    await assertFails(
      publishBatch(ownerDb(), v2, {
        envelope: { publishedAt: new Date() },
      }).commit()
    );

    // Preserved publishedAt (the seeded new Date(0)) → allowed.
    await assertSucceeds(
      publishBatch(ownerDb(), v2, {
        envelope: { publishedAt: new Date(0) },
      }).commit()
    );
  });
});

describe("withdrawal, republish, and takedown", () => {
  it("owner withdrawal: delete envelope + mark ledger withdrawn, atomically", async () => {
    const x = ids("withdraw-ok");
    await seedLivePublication(x);
    const db = ownerDb();
    const batch = writeBatch(db);
    batch.delete(doc(db, x.envelopePath));
    batch.update(doc(db, x.requestPath), { status: "withdrawn" });
    await assertSucceeds(batch.commit());
  });

  it("owner cannot mark a published ledger entry withdrawn while its envelope stays live", async () => {
    const x = ids("withdraw-live");
    await seedLivePublication(x);
    await assertFails(
      updateDoc(doc(ownerDb(), x.requestPath), { status: "withdrawn" })
    );
  });

  it("an unrelated user cannot delete someone else's envelope", async () => {
    const x = ids("withdraw-other");
    await seedLivePublication(x);
    await assertFails(deleteDoc(doc(otherDb(), x.envelopePath)));
  });

  it("after withdrawal, guests lose revision reads; owner and admin keep them", async () => {
    const x = ids("cascade");
    await seedLivePublication(x);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), x.envelopePath));
    });
    await assertFails(getDoc(doc(guestDb(), x.revisionPath)));
    await assertSucceeds(getDoc(doc(ownerDb(), x.revisionPath)));
    await assertSucceeds(getDoc(doc(adminDb(), x.revisionPath)));
  });

  it("owner republish of withdrawn content: relist ledger + envelope, atomically", async () => {
    const x = ids("republish-ok");
    await seedWithdrawnPublication(x);
    const db = ownerDb();
    const batch = writeBatch(db);
    batch.update(doc(db, x.requestPath), {
      status: "published",
      requestedAt: new Date(),
    });
    batch.set(
      doc(db, x.envelopePath),
      envelopeDoc(x, {
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(batch.commit());
  });

  it("a bare withdrawn→published flip without relisting is denied", async () => {
    const x = ids("republish-bare");
    await seedWithdrawnPublication(x);
    await assertFails(
      updateDoc(doc(ownerDb(), x.requestPath), {
        status: "published",
        requestedAt: new Date(),
      })
    );
  });

  it("removed is terminal: the owner cannot republish taken-down content", async () => {
    const x = ids("removed-terminal");
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(
        doc(db, x.requestPath),
        requestDoc(x, {
          status: "removed",
          reviewedAt: new Date(),
          reviewedBy: ADMIN_UID,
        })
      );
      await setDoc(doc(db, x.revisionPath), revisionDoc(x));
    });
    const db = ownerDb();
    const batch = writeBatch(db);
    batch.update(doc(db, x.requestPath), {
      status: "published",
      requestedAt: new Date(),
    });
    batch.set(
      doc(db, x.envelopePath),
      envelopeDoc(x, {
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(batch.commit());
  });

  it("admin takedown: delete envelope + mark ledger removed, atomically", async () => {
    const x = ids("remove-ok");
    await seedLivePublication(x);
    const db = adminDb();
    const batch = writeBatch(db);
    batch.delete(doc(db, x.envelopePath));
    batch.update(doc(db, x.requestPath), {
      status: "removed",
      reviewedAt: new Date(),
      reviewedBy: ADMIN_UID,
      reviewNote: "Guideline violation",
    });
    await assertSucceeds(batch.commit());
  });

  it("guests can never write the envelope", async () => {
    const x = ids("env-guest");
    await assertFails(setDoc(doc(guestDb(), x.envelopePath), envelopeDoc(x)));
  });
});

/**
 * Browse Phase 5A. The public boundary was written type-generic from the
 * start (`artifactType in ['tunnel','mandala','scene']`), so mandalas needed no
 * rules change there — these cases prove that claim rather than assume it. The
 * private mandala revisions subcollection IS new, and is covered below.
 */
describe("mandala publication (Phase 5A)", () => {
  /** Same rule-shaped ids, under a mandala artifact id. */
  function mandalaIds(tag: string) {
    const base = ids(tag);
    const artifactId = `mandala-${tag}`;
    return {
      ...base,
      artifactId,
      requestId: `${artifactId}_${base.revisionId}`,
      requestPath: `artifactPublicationRequests/${artifactId}_${base.revisionId}`,
      envelopePath: `publicArtifacts/${artifactId}`,
      revisionPath: `publicArtifacts/${artifactId}/revisions/${base.revisionId}`,
    };
  }

  // The mandala public payload carries geometry, not pixels — the poster is
  // derived at publish time and lives only in Storage.
  const MANDALA_PAYLOAD = {
    steps: [],
    variant: "both",
    leftPropType: "staff",
    rightPropType: "staff",
  };

  function mandalaPublishBatch(
    db: ReturnType<typeof ownerDb>,
    x: ReturnType<typeof mandalaIds>
  ) {
    const batch = writeBatch(db);
    batch.set(
      doc(db, x.requestPath),
      requestDoc(x, {
        requestId: x.requestId,
        artifactId: x.artifactId,
        artifactType: "mandala",
        title: "Bloom",
        payload: MANDALA_PAYLOAD,
        sourceRevision: {
          artifactId: x.artifactId,
          revisionId: `v1_${x.sourceDigest}`,
          contentDigest: x.sourceDigest,
          digestAlgorithm: "SHA-256",
          digestVersion: 1,
        },
      })
    );
    batch.set(
      doc(db, x.revisionPath),
      revisionDoc(x, {
        artifactId: x.artifactId,
        artifactType: "mandala",
        payload: MANDALA_PAYLOAD,
      })
    );
    batch.set(
      doc(db, x.envelopePath),
      envelopeDoc(x, {
        artifactId: x.artifactId,
        artifactType: "mandala",
        title: "Bloom",
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    return batch;
  }

  it("the owner publish batch succeeds for a mandala and LANDS", async () => {
    const x = mandalaIds("mandala-ok");
    await assertSucceeds(mandalaPublishBatch(ownerDb(), x).commit());
    const landed = await getDoc(doc(guestDb(), x.envelopePath));
    if (!landed.exists()) throw new Error(`SEED LOST: ${x.envelopePath}`);
  });

  it("guests read a live mandala envelope and its revision", async () => {
    const x = mandalaIds("mandala-guest");
    await assertSucceeds(mandalaPublishBatch(ownerDb(), x).commit());
    await assertSucceeds(getDoc(doc(guestDb(), x.envelopePath)));
    await assertSucceeds(getDoc(doc(guestDb(), x.revisionPath)));
  });

  it("an unknown artifactType is denied at the same boundary", async () => {
    const x = mandalaIds("mandala-badtype");
    const db = ownerDb();
    const batch = writeBatch(db);
    batch.set(
      doc(db, x.requestPath),
      requestDoc(x, {
        requestId: x.requestId,
        artifactId: x.artifactId,
        artifactType: "hologram",
      })
    );
    batch.set(
      doc(db, x.revisionPath),
      revisionDoc(x, { artifactId: x.artifactId, artifactType: "hologram" })
    );
    batch.set(
      doc(db, x.envelopePath),
      envelopeDoc(x, {
        artifactId: x.artifactId,
        artifactType: "hologram",
        publishedAt: serverTimestamp(),
      })
    );
    await assertFails(batch.commit());
  });

  it("owner withdrawal of a mandala removes it from guest reads", async () => {
    const x = mandalaIds("mandala-withdraw");
    await assertSucceeds(mandalaPublishBatch(ownerDb(), x).commit());
    const db = ownerDb();
    const batch = writeBatch(db);
    batch.delete(doc(db, x.envelopePath));
    batch.update(doc(db, x.requestPath), { status: "withdrawn" });
    await assertSucceeds(batch.commit());
    await assertFails(getDoc(doc(guestDb(), x.revisionPath)));
    await assertSucceeds(getDoc(doc(ownerDb(), x.revisionPath)));
  });
});

describe("private mandala revisions (Phase 5A)", () => {
  const digest = "c".repeat(64);
  const revisionId = `v1_${digest}`;

  function path(uid: string, mandalaId: string) {
    return `users/${uid}/mandala-collection/${mandalaId}/revisions/${revisionId}`;
  }

  function privateRevision(mandalaId: string, overrides = {}) {
    return {
      artifactId: mandalaId,
      artifactType: "mandala",
      revisionId,
      contentDigest: digest,
      digestAlgorithm: "SHA-256",
      digestVersion: 1,
      payload: {
        steps: [],
        variant: "both",
        leftPropType: "staff",
        rightPropType: "staff",
      },
      createdAt: 123,
      ...overrides,
    };
  }

  it("the owner writes a content-addressed revision", async () => {
    const id = "mandala-priv-ok";
    await assertSucceeds(
      setDoc(doc(ownerDb(), path(OWNER_UID, id)), privateRevision(id))
    );
  });

  it("a revision id that does not match its digest is denied", async () => {
    const id = "mandala-priv-mismatch";
    await assertFails(
      setDoc(
        doc(ownerDb(), path(OWNER_UID, id)),
        privateRevision(id, { contentDigest: "d".repeat(64) })
      )
    );
  });

  it("a revision naming a different mandala is denied", async () => {
    const id = "mandala-priv-wrongparent";
    await assertFails(
      setDoc(
        doc(ownerDb(), path(OWNER_UID, id)),
        privateRevision(id, { artifactId: "some-other-mandala" })
      )
    );
  });

  it("a revision claiming another artifact type is denied", async () => {
    const id = "mandala-priv-wrongtype";
    await assertFails(
      setDoc(
        doc(ownerDb(), path(OWNER_UID, id)),
        privateRevision(id, { artifactType: "tunnel" })
      )
    );
  });

  it("revisions are immutable, private to the owner, and not user-deletable", async () => {
    const id = "mandala-priv-immutable";
    await assertSucceeds(
      setDoc(doc(ownerDb(), path(OWNER_UID, id)), privateRevision(id))
    );
    await assertFails(
      updateDoc(doc(ownerDb(), path(OWNER_UID, id)), { createdAt: 999 })
    );
    await assertFails(deleteDoc(doc(ownerDb(), path(OWNER_UID, id))));
    await assertFails(getDoc(doc(otherDb(), path(OWNER_UID, id))));
    await assertFails(getDoc(doc(guestDb(), path(OWNER_UID, id))));
    await assertSucceeds(getDoc(doc(adminDb(), path(OWNER_UID, id))));
  });
});
