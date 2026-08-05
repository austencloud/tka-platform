import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getBytes, listAll, ref, uploadBytes } from "firebase/storage";

let testEnv: RulesTestEnvironment;

const ANON_UID = "anon-user-1";
const FULL_UID = "full-user-1";
const ADMIN_UID = "admin-user-1";

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
    storage: {
      rules: readFileSync(resolve(__dirname, "../../../storage.rules"), "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
});

// Long polling is load-bearing, not a preference: over gRPC/WebChannel the
// emulator write stream corrupts on this setup ("RESOURCE_EXHAUSTED: Received
// message larger than max" + max backoff, observed 2026-07-26), which wedges
// the shared emulator process and makes writes in LATER test files silently
// fail to land. See public-sequence-parity.rules.test.ts for the same fix.
const SDK_SETTINGS = { experimentalForceLongPolling: true };

// A guest = anonymous provider; a full user = a real provider (e.g. password).
function anonCtx() {
  return testEnv.authenticatedContext(ANON_UID, {
    firebase: { sign_in_provider: "anonymous" },
  });
}
function fullCtx() {
  return testEnv.authenticatedContext(FULL_UID, {
    firebase: { sign_in_provider: "password" },
  });
}
function adminCtx() {
  return testEnv.authenticatedContext(ADMIN_UID, {
    firebase: { sign_in_provider: "password" },
    role: "admin",
    admin: true,
    isAdmin: true,
  });
}

describe("user profile privilege boundaries", () => {
  async function seedProfiles() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore(SDK_SETTINGS);
      await setDoc(doc(db, `users/${FULL_UID}`), {
        publicProfileVersion: 2,
        displayName: "Full User",
        bio: "Original",
        role: "user",
        isAdmin: false,
      });
      await setDoc(doc(db, `users/${ADMIN_UID}`), {
        publicProfileVersion: 2,
        displayName: "Admin",
        role: "admin",
        isAdmin: true,
      });
    });
  }

  it("allows owner public-profile edits but rejects role escalation", async () => {
    await seedProfiles();
    const ref = doc(fullCtx().firestore(SDK_SETTINGS), `users/${FULL_UID}`);

    await assertSucceeds(updateDoc(ref, { bio: "Updated" }));
    await assertFails(updateDoc(ref, { role: "admin", isAdmin: true }));
    await assertFails(updateDoc(ref, { adminNotes: "read private note" }));
    await assertFails(updateDoc(ref, { followerCount: 999999 }));
  });

  it("rejects privileged fields during owner profile creation", async () => {
    const uid = "new-full-user";
    const db = testEnv
      .authenticatedContext(uid, { firebase: { sign_in_provider: "password" } })
      .firestore(SDK_SETTINGS);

    await assertSucceeds(
      setDoc(doc(db, `users/${uid}`), {
        publicProfileVersion: 2,
        displayName: "Safe profile",
      })
    );
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore(SDK_SETTINGS), `users/${uid}`));
    });
    await assertFails(
      setDoc(doc(db, `users/${uid}`), {
        publicProfileVersion: 2,
        displayName: "Self Promoted",
        role: "admin",
        isAdmin: true,
      })
    );
    await assertFails(
      setDoc(doc(db, `users/${uid}`), {
        publicProfileVersion: 2,
        displayName: "Inflated creator",
        sequenceCount: 999999,
        collectionCount: 999999,
      })
    );
  });

  it("lets owners observe a missing profile before safe client provisioning", async () => {
    const fullDb = testEnv
      .authenticatedContext("missing-full-profile", {
        firebase: { sign_in_provider: "password" },
      })
      .firestore(SDK_SETTINGS);
    const anonDb = testEnv
      .authenticatedContext("missing-anon-profile", {
        firebase: { sign_in_provider: "anonymous" },
      })
      .firestore(SDK_SETTINGS);

    await assertSucceeds(
      getDoc(doc(fullDb, "users/missing-full-profile"))
    );
    await assertSucceeds(
      getDoc(doc(anonDb, "users/missing-anon-profile"))
    );
  });

  it("keeps privileged profile mutations available to administrators", async () => {
    await seedProfiles();
    const ref = doc(adminCtx().firestore(SDK_SETTINGS), `users/${FULL_UID}`);
    await assertSucceeds(updateDoc(ref, { role: "tester", isAdmin: false }));
  });

  it("does not trust an admin-looking public profile without signed claims", async () => {
    await seedProfiles();
    const ref = doc(fullCtx().firestore(SDK_SETTINGS), `users/${ADMIN_UID}`);
    await assertFails(updateDoc(ref, { role: "tester", isAdmin: false }));
  });

  it("blocks legacy private fields from public reads until server migration", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(SDK_SETTINGS), `users/${FULL_UID}`), {
        displayName: "Legacy User",
        adminLabel: "Tuesday jam",
        adminNotes: "Private note",
      });
    });
    await assertFails(
      getDoc(
        doc(
          testEnv.unauthenticatedContext().firestore(SDK_SETTINGS),
          `users/${FULL_UID}`
        )
      )
    );
    await assertFails(
      getDoc(doc(fullCtx().firestore(SDK_SETTINGS), `users/${FULL_UID}`))
    );
    await assertSucceeds(
      getDoc(doc(adminCtx().firestore(SDK_SETTINGS), `users/${FULL_UID}`))
    );
    await assertFails(
      getDocs(
        collection(
          testEnv.unauthenticatedContext().firestore(SDK_SETTINGS),
          "users"
        )
      )
    );
    await assertFails(
      updateDoc(doc(fullCtx().firestore(SDK_SETTINGS), `users/${FULL_UID}`), {
        publicProfileVersion: 2,
      })
    );
  });

  it("keeps migrated public profiles queryable", async () => {
    await seedProfiles();
    await assertSucceeds(
      getDocs(
        query(
          collection(
            testEnv.unauthenticatedContext().firestore(SDK_SETTINGS),
            "users"
          ),
          where("publicProfileVersion", "==", 2)
        )
      )
    );
  });

  it("denies public user lists that do not constrain the migration marker", async () => {
    await seedProfiles();
    await assertFails(
      getDocs(
        collection(
          testEnv.unauthenticatedContext().firestore(SDK_SETTINGS),
          "users"
        )
      )
    );
  });

  it("denies marked profiles containing email, location, or unknown fields", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore(SDK_SETTINGS);
      await setDoc(doc(db, "users/private-email"), {
        publicProfileVersion: 2,
        displayName: "Email",
        email: "private@example.test",
      });
      await setDoc(doc(db, "users/private-location"), {
        publicProfileVersion: 2,
        displayName: "Location",
        lastLocation: { lat: 1, lng: 2 },
      });
      await setDoc(doc(db, "users/private-unknown"), {
        publicProfileVersion: 2,
        displayName: "Unknown",
        secretAnswer: "private",
      });
    });
    const db = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
    await assertFails(getDoc(doc(db, "users/private-email")));
    await assertFails(getDoc(doc(db, "users/private-location")));
    await assertFails(getDoc(doc(db, "users/private-unknown")));
    const ownerDb = testEnv
      .authenticatedContext("private-create", {
        firebase: { sign_in_provider: "password" },
      })
      .firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(ownerDb, "users/private-create"), {
        publicProfileVersion: 2,
        displayName: "Unsafe",
        secretAnswer: "private",
      })
    );
  });

  it("keeps private admin metadata inaccessible to every client", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(SDK_SETTINGS), `userAdminMetadata/${FULL_UID}`),
        { adminNotes: "Private note" }
      );
    });
    await assertFails(
      getDoc(
        doc(
          testEnv.unauthenticatedContext().firestore(SDK_SETTINGS),
          `userAdminMetadata/${FULL_UID}`
        )
      )
    );
    await assertFails(
      getDoc(
        doc(adminCtx().firestore(SDK_SETTINGS), `userAdminMetadata/${FULL_UID}`)
      )
    );
  });
});

describe("protected user document boundaries", () => {
  async function seedProtectedDocuments() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore(SDK_SETTINGS);
      await setDoc(doc(db, `userPrivateProfiles/${FULL_UID}`), {
        email: "owner@example.test",
        lastLocation: { city: "Chicago" },
      });
      await setDoc(
        doc(db, `users/${FULL_UID}/settings/notificationPreferences`),
        { notificationPreferences: { push: true } }
      );
      await setDoc(doc(db, `users/${FULL_UID}/settings/featureOverrides`), {
        enabledFeatures: ["beta"],
        disabledFeatures: [],
      });
      await setDoc(doc(db, `users/${FULL_UID}/moderation/status`), {
        hasActiveWarning: true,
        lastWarningReportId: "report-1",
      });
    });
  }

  it("limits private profiles to the owner and admin reads", async () => {
    await seedProtectedDocuments();
    const path = `userPrivateProfiles/${FULL_UID}`;
    const owner = fullCtx().firestore(SDK_SETTINGS);
    const other = anonCtx().firestore(SDK_SETTINGS);
    const admin = adminCtx().firestore(SDK_SETTINGS);
    const signedOut = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);

    await assertSucceeds(getDoc(doc(owner, path)));
    await assertSucceeds(updateDoc(doc(owner, path), { email: "new@test.io" }));
    await assertFails(updateDoc(doc(owner, path), { adminNotes: "no" }));
    await assertFails(getDoc(doc(other, path)));
    await assertFails(updateDoc(doc(other, path), { email: "no@test.io" }));
    await assertFails(getDoc(doc(signedOut, path)));
    await assertSucceeds(getDoc(doc(admin, path)));
    await assertFails(updateDoc(doc(admin, path), { email: "admin@test.io" }));
  });

  it("keeps settings private and scopes admin writes to feature overrides", async () => {
    await seedProtectedDocuments();
    const notifications = `users/${FULL_UID}/settings/notificationPreferences`;
    const overrides = `users/${FULL_UID}/settings/featureOverrides`;
    const owner = fullCtx().firestore(SDK_SETTINGS);
    const other = anonCtx().firestore(SDK_SETTINGS);
    const admin = adminCtx().firestore(SDK_SETTINGS);
    const signedOut = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);

    await assertSucceeds(getDoc(doc(owner, notifications)));
    await assertSucceeds(
      updateDoc(doc(owner, notifications), {
        notificationPreferences: { push: false },
      })
    );
    await assertFails(getDoc(doc(other, notifications)));
    await assertFails(getDoc(doc(signedOut, notifications)));
    await assertSucceeds(getDoc(doc(admin, notifications)));
    await assertFails(
      updateDoc(doc(admin, notifications), {
        notificationPreferences: { push: false },
      })
    );
    await assertSucceeds(
      updateDoc(doc(admin, overrides), {
        enabledFeatures: [],
        disabledFeatures: ["beta"],
      })
    );
    await assertFails(
      updateDoc(doc(owner, overrides), {
        enabledFeatures: ["beta", "premium"],
      })
    );
  });

  it("lets owners acknowledge warnings without controlling moderation state", async () => {
    await seedProtectedDocuments();
    const path = `users/${FULL_UID}/moderation/status`;
    const owner = fullCtx().firestore(SDK_SETTINGS);
    const other = anonCtx().firestore(SDK_SETTINGS);
    const admin = adminCtx().firestore(SDK_SETTINGS);
    const signedOut = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);

    await assertSucceeds(getDoc(doc(owner, path)));
    await assertSucceeds(
      updateDoc(doc(owner, path), { hasActiveWarning: false })
    );
    await assertFails(updateDoc(doc(owner, path), { hasActiveWarning: true }));
    await assertFails(
      setDoc(doc(owner, `users/${FULL_UID}/moderation/new-status`), {
        hasActiveWarning: false,
      })
    );
    await assertFails(getDoc(doc(other, path)));
    await assertFails(getDoc(doc(signedOut, path)));
    await assertSucceeds(getDoc(doc(admin, path)));
    await assertSucceeds(
      updateDoc(doc(admin, path), {
        hasActiveWarning: true,
        lastWarningReportId: "report-2",
      })
    );
    await assertSucceeds(deleteDoc(doc(admin, path)));
  });
});

describe("anonymous guests: own data", () => {
  it("can write their own sequence", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, `users/${ANON_UID}/sequences/s1`), {
        userId: ANON_UID,
        steps: [],
      })
    );
  });
  it("can write their own learning progress", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, `users/${ANON_UID}/learningProgress/p1`), {
        userId: ANON_UID,
        value: 1,
      })
    );
  });
});

describe("anonymous guests: community write paths are denied", () => {
  it("cannot create feedback", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `feedback/f1`), { userId: ANON_UID, text: "x" })
    );
  });
  it("cannot publish to publicSequences", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `publicSequences/seq1`), { ownerId: ANON_UID, steps: [] })
    );
  });
  it("cannot claim a username", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `usernames/cooldude`), { userId: ANON_UID })
    );
  });
  it("cannot create a userLocation (community map)", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `userLocations/${ANON_UID}`), {
        userId: ANON_UID,
        lat: 0,
        lng: 0,
      })
    );
  });
  it("cannot create a shortcode", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(setDoc(doc(db, `shortcodes/abc123`), { encoded: "abc" }));
  });
  it("cannot create a userReport", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `userReports/r1`), {
        reporterId: ANON_UID,
        reportedUserId: "someone-else",
      })
    );
  });
  it("cannot create a video", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(setDoc(doc(db, `videos/v1`), { creatorId: ANON_UID }));
  });
  it("cannot publish a publicHandPath", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `publicHandPaths/hp1`), { ownerId: ANON_UID })
    );
  });
  it("cannot publish a publicSoloProp", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `publicSoloProps/sp1`), { ownerId: ANON_UID })
    );
  });
  it("cannot create a festivalSubmission", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(setDoc(doc(db, `festivalSubmissions/fs1`), {}));
  });
  it("cannot cast a hallOfShame vote", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `hallOfShameVotes/${ANON_UID}_seqX`), {
        voterId: ANON_UID,
        sequenceId: "seqX",
      })
    );
  });
  it("cannot create a hallOfShame report", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `hallOfShameReports/r1`), { reporterId: ANON_UID })
    );
  });
});

describe("Hall of Shame age verification", () => {
  async function seedApprovedEntry() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(SDK_SETTINGS), "hallOfShame/approved-entry"),
        {
          ownerId: "another-user",
          status: "approved",
          hidden: false,
        }
      );
    });
  }

  it("accepts age verification from the owner-private profile", async () => {
    await seedApprovedEntry();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(SDK_SETTINGS), `userPrivateProfiles/${FULL_UID}`),
        { ageVerifiedAt: new Date() }
      );
    });

    await assertSucceeds(
      getDoc(
        doc(fullCtx().firestore(SDK_SETTINGS), "hallOfShame/approved-entry")
      )
    );
  });

  it("does not trust a legacy public age-verification field", async () => {
    await seedApprovedEntry();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(SDK_SETTINGS), `users/${FULL_UID}`), {
        publicProfileVersion: 2,
        displayName: "Legacy Verified User",
        ageVerifiedAt: new Date(),
      });
    });

    await assertFails(
      getDoc(
        doc(fullCtx().firestore(SDK_SETTINGS), "hallOfShame/approved-entry")
      )
    );
  });
});

describe("full users: community write paths succeed", () => {
  it("can create feedback", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, `feedback/f1`), { userId: FULL_UID, text: "x" })
    );
  });
  it("can no longer publish a legacy-shape doc to publicSequences (phase 4)", async () => {
    // The full publish-transaction shape (schema 2 + owner parity + claim,
    // all getAfter-proven) lives in public-sequence-parity.rules.test.ts.
    // Here: the phase-2 legacy allowance is gone — a bare write is denied
    // even for a full user.
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `publicSequences/seq1`), { ownerId: FULL_UID, steps: [] })
    );
  });
  it("can claim a username", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, `usernames/cooldude`), { userId: FULL_UID })
    );
  });
  it("can create a shortcode with the strict mint shape (phase 4)", async () => {
    // Payload-derived label fields are required at mint; a hash-less mint
    // carries no claim. The claim-linked mint shape is covered in
    // public-sequence-parity.rules.test.ts.
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, `shortcodes/abc123`), {
        encoded: "abc",
        payloadWord: "AB",
        payloadStepCount: 2,
        payloadSchemaVersion: 2,
      })
    );
    // The pre-phase-4 label-less mint is the drift class the label repair
    // cleaned — denied.
    await assertFails(setDoc(doc(db, `shortcodes/abc124`), { encoded: "abc" }));
  });
  it("can create a userReport", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, `userReports/r1`), {
        reporterId: FULL_UID,
        reportedUserId: "someone-else",
      })
    );
  });
  it("can create a video", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(setDoc(doc(db, `videos/v1`), { creatorId: FULL_UID }));
  });
  it("can publish a publicHandPath", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, `publicHandPaths/hp1`), { ownerId: FULL_UID })
    );
  });
  it("can publish a publicSoloProp", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, `publicSoloProps/sp1`), { ownerId: FULL_UID })
    );
  });
  it("can create a festivalSubmission", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(setDoc(doc(db, `festivalSubmissions/fs1`), {}));
  });
});

describe("collections: private is server-private, public is world-readable", () => {
  const OWNER = "coll-owner-1";
  const OTHER = "coll-other-1";

  function userCtx(uid: string) {
    return testEnv.authenticatedContext(uid, {
      firebase: { sign_in_provider: "password" },
    });
  }

  async function seed() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore(SDK_SETTINGS);
      await setDoc(doc(db, `users/${OWNER}/collections/pub`), {
        ownerId: OWNER,
        isPublic: true,
        name: "Public picks",
      });
      await setDoc(doc(db, `users/${OWNER}/collections/priv`), {
        ownerId: OWNER,
        isPublic: false,
        name: "Gift ideas",
      });
    });
  }

  it("anyone (unauthenticated) can read a PUBLIC collection", async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
    await assertSucceeds(getDoc(doc(db, `users/${OWNER}/collections/pub`)));
  });

  it("an unauthenticated user CANNOT read a PRIVATE collection", async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
    await assertFails(getDoc(doc(db, `users/${OWNER}/collections/priv`)));
  });

  it("a signed-in stranger CANNOT read someone else's PRIVATE collection", async () => {
    await seed();
    const db = userCtx(OTHER).firestore(SDK_SETTINGS);
    await assertFails(getDoc(doc(db, `users/${OWNER}/collections/priv`)));
  });

  it("the owner CAN read their own PRIVATE collection", async () => {
    await seed();
    const db = userCtx(OWNER).firestore(SDK_SETTINGS);
    await assertSucceeds(getDoc(doc(db, `users/${OWNER}/collections/priv`)));
  });

  it("a collectionGroup query filtered to isPublic==true is ALLOWED (the discovery feed)", async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
    await assertSucceeds(
      getDocs(
        query(collectionGroup(db, "collections"), where("isPublic", "==", true))
      )
    );
  });

  it("a bare collectionGroup query (no isPublic filter) is DENIED — no enumeration of private collections", async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
    await assertFails(getDocs(collectionGroup(db, "collections")));
  });
});

describe("collections: publishing requires a full account (2026-07-18 hardening)", () => {
  it("an anonymous guest CANNOT create a collection with isPublic == true", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `users/${ANON_UID}/collections/pub`), {
        ownerId: ANON_UID,
        isPublic: true,
        name: "Guest attempt",
      })
    );
  });

  it("an anonymous guest CAN create a private collection (isPublic == false)", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, `users/${ANON_UID}/collections/priv`), {
        ownerId: ANON_UID,
        isPublic: false,
        name: "Guest private",
      })
    );
  });

  it("an anonymous guest CANNOT convert an existing private collection to public", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await setDoc(doc(db, `users/${ANON_UID}/collections/c1`), {
      ownerId: ANON_UID,
      isPublic: false,
      name: "Guest folder",
    });
    await assertFails(
      setDoc(
        doc(db, `users/${ANON_UID}/collections/c1`),
        { isPublic: true },
        { merge: true }
      )
    );
  });

  it("a full user CAN publish their own collection", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, `users/${FULL_UID}/collections/pub`), {
        ownerId: FULL_UID,
        isPublic: true,
        name: "Full user public",
      })
    );
  });

  it("a full user CAN edit a collection that stays public (isPublic untouched in the patch)", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await setDoc(doc(db, `users/${FULL_UID}/collections/pub2`), {
      ownerId: FULL_UID,
      isPublic: true,
      name: "Before rename",
    });
    await assertSucceeds(
      setDoc(
        doc(db, `users/${FULL_UID}/collections/pub2`),
        { name: "After rename" },
        { merge: true }
      )
    );
  });

  it("a full user CAN un-publish (isPublic true -> false) their own collection", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await setDoc(doc(db, `users/${FULL_UID}/collections/pub3`), {
      ownerId: FULL_UID,
      isPublic: true,
      name: "Going private",
    });
    await assertSucceeds(
      setDoc(
        doc(db, `users/${FULL_UID}/collections/pub3`),
        { isPublic: false },
        { merge: true }
      )
    );
  });
});

describe("legacy root /sequences and /collections (2026-07-18 hardening)", () => {
  it("an anonymous guest CANNOT create a root-level /sequences doc", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `sequences/legacy1`), { userId: ANON_UID, steps: [] })
    );
  });

  it("a full user CAN create a root-level /sequences doc", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, `sequences/legacy2`), { userId: FULL_UID, steps: [] })
    );
  });

  it("root /sequences is NOT world-readable without isPublic (private doc denied to a stranger)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(SDK_SETTINGS), `sequences/priv1`), {
        userId: FULL_UID,
        isPublic: false,
      });
    });
    const db = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
    await assertFails(getDoc(doc(db, `sequences/priv1`)));
  });

  it("root /sequences IS readable when isPublic == true", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(SDK_SETTINGS), `sequences/pub1`), {
        userId: FULL_UID,
        isPublic: true,
      });
    });
    const db = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
    await assertSucceeds(getDoc(doc(db, `sequences/pub1`)));
  });

  it("root /collections is fully closed (block deleted — default deny)", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(doc(db, `collections/c1`), { userId: FULL_UID, isPublic: true })
    );
  });
});

describe("physical-card instrumentation is private and server-written", () => {
  const SHORTCODE = "ABCD";
  const pointData = {
    printId: "print-abc",
    lat: 41.8781,
    lng: -87.6298,
    city: "Chicago",
    country: "US",
    timestamp: new Date(),
  };

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore(SDK_SETTINGS);
      await setDoc(doc(db, "users", ADMIN_UID), {
        role: "admin",
      });
      await setDoc(
        doc(db, "shortcodes", SHORTCODE, "journeyPoints", "point1"),
        pointData
      );
    });
  });

  it("signed-out scanners cannot read historical journey points", async () => {
    const db = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
    await assertFails(
      getDocs(collection(db, "shortcodes", SHORTCODE, "journeyPoints"))
    );
  });

  it("browsers cannot create journey points or scan events", async () => {
    const db = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
    await assertFails(
      addDoc(
        collection(db, "shortcodes", SHORTCODE, "journeyPoints"),
        pointData
      )
    );
    await assertFails(
      addDoc(collection(db, "shortcodes", SHORTCODE, "scanEvents"), {
        printId: "spoofed",
        timestamp: new Date(),
      })
    );
  });

  it("full users cannot bypass server ingestion", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertFails(
      addDoc(collection(db, "shortcodes", SHORTCODE, "scanEvents"), {
        printId: "spoofed",
        timestamp: new Date(),
      })
    );
  });

  it("admins can inspect private scan source data but cannot mutate it from a browser", async () => {
    const db = adminCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      getDocs(collection(db, "shortcodes", SHORTCODE, "journeyPoints"))
    );
    await assertFails(
      setDoc(
        doc(db, "shortcodes", SHORTCODE, "journeyPoints", "point1"),
        { printId: "updated" },
        { merge: true }
      )
    );
    await assertFails(
      deleteDoc(doc(db, "shortcodes", SHORTCODE, "journeyPoints", "point1"))
    );
  });

  it("keeps print runs and physical-card inventory admin-readable and browser-write-closed", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore(SDK_SETTINGS);
      await setDoc(doc(db, "cardPrintRuns", "run1"), { status: "ready" });
      await setDoc(doc(db, "physicalCards", "card1"), {
        printRunId: "run1",
      });
    });

    const signedOut = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
    const full = fullCtx().firestore(SDK_SETTINGS);
    const admin = adminCtx().firestore(SDK_SETTINGS);
    await assertFails(getDoc(doc(signedOut, "physicalCards", "card1")));
    await assertFails(getDoc(doc(full, "cardPrintRuns", "run1")));
    await assertSucceeds(getDoc(doc(admin, "physicalCards", "card1")));
    await assertSucceeds(getDoc(doc(admin, "cardPrintRuns", "run1")));
    await assertFails(
      setDoc(doc(full, "physicalCards", "fake"), {
        printRunId: "run1",
      })
    );
  });
});

describe("Instagram custom-auth handshake", () => {
  const STATE = "state-doc";

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore(SDK_SETTINGS);
      await setDoc(doc(db, "instagramOAuthStates", STATE), {
        requesterUid: ANON_UID,
        status: "pending",
      });
      await setDoc(doc(db, "instagramAuthLinks", "instagram_123"), {
        uid: ANON_UID,
        instagramUserId: "123",
      });
      await setDoc(
        doc(db, "instagramDataDeletionRequests", "confirmation-code"),
        { status: "complete" }
      );
    });
  });

  it("lets the initiating session watch its exact state document", async () => {
    await assertSucceeds(
      getDoc(
        doc(anonCtx().firestore(SDK_SETTINGS), "instagramOAuthStates", STATE)
      )
    );
  });

  it("keeps OAuth state private from other and signed-out clients", async () => {
    const other = testEnv
      .authenticatedContext("other-user")
      .firestore(SDK_SETTINGS);
    const signedOut = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);
    await assertFails(getDoc(doc(other, "instagramOAuthStates", STATE)));
    await assertFails(getDoc(doc(signedOut, "instagramOAuthStates", STATE)));
  });

  it("denies all client writes and identity-link reads", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertFails(
      setDoc(
        doc(db, "instagramOAuthStates", STATE),
        { requesterUid: ANON_UID, status: "complete" },
        { merge: true }
      )
    );
    await assertFails(getDoc(doc(db, "instagramAuthLinks", "instagram_123")));
    await assertFails(
      getDoc(doc(db, "instagramDataDeletionRequests", "confirmation-code"))
    );
  });
});

describe("messaging attachments", () => {
  const SENDER = "message-sender";
  const RECIPIENT = "message-recipient";
  const OUTSIDER = "message-outsider";
  const CONVERSATION = "conversation-1";

  function messageCtx(uid: string) {
    return testEnv.authenticatedContext(uid, {
      firebase: { sign_in_provider: "password" },
    });
  }

  async function seedConversation() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(SDK_SETTINGS), `conversations/${CONVERSATION}`),
        {
          type: "direct",
          participants: [SENDER, RECIPIENT],
          participantInfo: {
            [SENDER]: { userId: SENDER, displayName: "Sender" },
            [RECIPIENT]: { userId: RECIPIENT, displayName: "Recipient" },
          },
          unreadCount: { [SENDER]: 0, [RECIPIENT]: 0 },
        }
      );
    });
  }

  async function seedMessage(
    options: {
      id?: string;
      content?: string;
      attachments?: Array<Record<string, unknown>> | null;
      editHistory?: Array<{ content: string; editedAt: Date }> | null;
      isDeleted?: boolean;
    } = {}
  ) {
    const {
      id = "message-1",
      content = "Original message",
      attachments = null,
      editHistory = null,
      isDeleted = false,
    } = options;

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(SDK_SETTINGS),
          `conversations/${CONVERSATION}/messages/${id}`
        ),
        {
          senderId: SENDER,
          senderName: "Sender",
          content,
          createdAt: new Date("2026-07-31T12:00:00Z"),
          readBy: [SENDER],
          attachments,
          editHistory,
          isDeleted,
        }
      );
    });
  }

  function messageRef(uid: string, id = "message-1") {
    return doc(
      messageCtx(uid).firestore(SDK_SETTINGS),
      `conversations/${CONVERSATION}/messages/${id}`
    );
  }

  it("keeps direct-message membership immutable", async () => {
    await seedConversation();
    const conversationRef = doc(
      messageCtx(SENDER).firestore(SDK_SETTINGS),
      `conversations/${CONVERSATION}`
    );

    await assertFails(
      updateDoc(conversationRef, { participants: [SENDER, OUTSIDER] })
    );
    await assertSucceeds(
      updateDoc(conversationRef, { [`unreadCount.${SENDER}`]: 0 })
    );
  });

  it("allows client sequence messages but reserves image messages for the callable", async () => {
    await seedConversation();
    const messages = collection(
      messageCtx(SENDER).firestore(SDK_SETTINGS),
      `conversations/${CONVERSATION}/messages`
    );
    const base = {
      senderId: SENDER,
      senderName: "Sender",
      content: "",
      readBy: [SENDER],
    };

    await assertSucceeds(
      addDoc(messages, {
        ...base,
        attachments: [{ type: "sequence", url: "/sequence/raw%3Atest" }],
      })
    );
    await assertFails(
      addDoc(messages, {
        ...base,
        attachments: [
          { type: "image", storagePath: "message-images/fake/fake/fake.webp" },
        ],
      })
    );
  });

  it("lets the sender edit text while appending the previous version", async () => {
    await seedConversation();
    await seedMessage();
    const editedAt = new Date("2026-07-31T12:05:00Z");

    await assertSucceeds(
      updateDoc(messageRef(SENDER), {
        content: "Corrected message",
        editedAt,
        editHistory: [{ content: "Original message", editedAt }],
      })
    );

    await assertFails(
      updateDoc(messageRef(RECIPIENT), {
        content: "Recipient rewrite",
        editedAt,
        editHistory: [{ content: "Original message", editedAt }],
      })
    );
  });

  it("keeps edit history append-only", async () => {
    await seedConversation();
    const firstEditAt = new Date("2026-07-31T12:05:00Z");
    await seedMessage({
      content: "Second version",
      editHistory: [{ content: "Original message", editedAt: firstEditAt }],
    });
    const secondEditAt = new Date("2026-07-31T12:10:00Z");

    await assertSucceeds(
      updateDoc(messageRef(SENDER), {
        content: "Final version",
        editedAt: secondEditAt,
        editHistory: [
          { content: "Original message", editedAt: firstEditAt },
          { content: "Second version", editedAt: secondEditAt },
        ],
      })
    );

    await seedMessage({
      id: "message-2",
      content: "Second version",
      editHistory: [{ content: "Original message", editedAt: firstEditAt }],
    });
    await assertFails(
      updateDoc(messageRef(SENDER, "message-2"), {
        content: "History rewrite",
        editedAt: secondEditAt,
        editHistory: [
          { content: "Fabricated original", editedAt: firstEditAt },
          { content: "Second version", editedAt: secondEditAt },
        ],
      })
    );
  });

  it("rejects empty plain-text edits but allows clearing an attachment caption", async () => {
    await seedConversation();
    await seedMessage();
    const editedAt = new Date("2026-07-31T12:05:00Z");

    await assertFails(
      updateDoc(messageRef(SENDER), {
        content: "",
        editedAt,
        editHistory: [{ content: "Original message", editedAt }],
      })
    );
    await assertFails(
      updateDoc(messageRef(SENDER), {
        content: "x".repeat(2001),
        editedAt,
        editHistory: [{ content: "Original message", editedAt }],
      })
    );

    await seedMessage({
      id: "message-2",
      content: "Photo caption",
      attachments: [{ type: "image", storagePath: "message-images/x.webp" }],
    });
    await assertSucceeds(
      updateDoc(messageRef(SENDER, "message-2"), {
        content: "",
        editedAt,
        editHistory: [{ content: "Photo caption", editedAt }],
      })
    );
  });

  it("allows the fixed delete tombstone and prevents restoring deleted messages", async () => {
    await seedConversation();
    await seedMessage();

    await assertSucceeds(
      updateDoc(messageRef(SENDER), {
        content: "[Message deleted]",
        isDeleted: true,
      })
    );

    const editedAt = new Date("2026-07-31T12:05:00Z");
    await assertFails(
      updateDoc(messageRef(SENDER), {
        content: "Restored message",
        editedAt,
        editHistory: [{ content: "[Message deleted]", editedAt }],
      })
    );
    await assertFails(
      updateDoc(messageRef(SENDER), {
        content: "Restored message",
        isDeleted: false,
      })
    );
  });

  it("lets only participants create valid staging images", async () => {
    await seedConversation();
    const path = `message-image-staging/${SENDER}/${CONVERSATION}/message-1/attachment-1`;
    const senderRef = ref(messageCtx(SENDER).storage(), path);
    const outsiderRef = ref(messageCtx(OUTSIDER).storage(), path);
    const anonymousRef = ref(
      testEnv
        .authenticatedContext(SENDER, {
          firebase: { sign_in_provider: "anonymous" },
        })
        .storage(),
      `message-image-staging/${SENDER}/${CONVERSATION}/message-1/anonymous`
    );

    await assertSucceeds(
      uploadBytes(senderRef, new Uint8Array([1, 2, 3]), {
        contentType: "image/png",
      })
    );
    await assertFails(
      uploadBytes(outsiderRef, new Uint8Array([1, 2, 3]), {
        contentType: "image/png",
      })
    );
    await assertFails(
      uploadBytes(anonymousRef, new Uint8Array([1, 2, 3]), {
        contentType: "image/png",
      })
    );
  });

  it("rejects unsupported, oversized, and overwrite attempts in staging", async () => {
    await seedConversation();
    const storage = messageCtx(SENDER).storage();
    const validRef = ref(
      storage,
      `message-image-staging/${SENDER}/${CONVERSATION}/message-1/valid`
    );
    const wrongTypeRef = ref(
      storage,
      `message-image-staging/${SENDER}/${CONVERSATION}/message-1/wrong-type`
    );
    const oversizedRef = ref(
      storage,
      `message-image-staging/${SENDER}/${CONVERSATION}/message-1/oversized`
    );

    await assertFails(
      uploadBytes(wrongTypeRef, new Uint8Array([1]), {
        contentType: "image/gif",
      })
    );
    await assertFails(
      uploadBytes(oversizedRef, new Uint8Array(10 * 1024 * 1024 + 1), {
        contentType: "image/jpeg",
      })
    );
    await assertSucceeds(
      uploadBytes(validRef, new Uint8Array([1]), { contentType: "image/webp" })
    );
    await assertFails(
      uploadBytes(validRef, new Uint8Array([2]), { contentType: "image/webp" })
    );
  });

  it("allows exact final-image reads for participants without allowing listing", async () => {
    await seedConversation();
    const path = `message-images/${CONVERSATION}/message-1/attachment-1.webp`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(
        ref(context.storage(), path),
        new Uint8Array([4, 5, 6]),
        {
          contentType: "image/webp",
        }
      );
    });

    await assertSucceeds(getBytes(ref(messageCtx(RECIPIENT).storage(), path)));
    await assertFails(getBytes(ref(messageCtx(OUTSIDER).storage(), path)));
    await assertFails(
      listAll(
        ref(messageCtx(RECIPIENT).storage(), `message-images/${CONVERSATION}`)
      )
    );
  });
});

describe("generator setups: private saved configs", () => {
  const setupPath = (uid: string, id = "s1") =>
    `users/${uid}/generatorSetups/${id}`;

  it("lets an owner create, read, update, and delete a setup", async () => {
    const db = fullCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, setupPath(FULL_UID)), {
        name: "Setup 1",
        config: { level: 1 },
      })
    );
    await assertSucceeds(getDoc(doc(db, setupPath(FULL_UID))));
    await assertSucceeds(
      updateDoc(doc(db, setupPath(FULL_UID)), {
        name: "Renamed",
      })
    );
    await assertSucceeds(deleteDoc(doc(db, setupPath(FULL_UID))));
  });

  it("lets an anonymous owner use private setups", async () => {
    const db = anonCtx().firestore(SDK_SETTINGS);
    await assertSucceeds(
      setDoc(doc(db, setupPath(ANON_UID)), {
        name: "Setup 1",
        config: {},
      })
    );
    await assertSucceeds(getDoc(doc(db, setupPath(ANON_UID))));
  });

  it("denies another authenticated user read and write access", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), setupPath(FULL_UID)), {
        name: "Setup 1",
        config: {},
      });
    });
    const other = anonCtx().firestore(SDK_SETTINGS);

    await assertFails(getDoc(doc(other, setupPath(FULL_UID))));
    await assertFails(
      setDoc(doc(other, setupPath(FULL_UID)), {
        name: "Changed",
      })
    );
  });

  it("lets an admin preview but not mutate another user's setups", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${ADMIN_UID}`), {
        role: "admin",
      });
      await setDoc(doc(context.firestore(), setupPath(FULL_UID)), {
        name: "Setup 1",
        config: {},
      });
    });
    const admin = adminCtx().firestore(SDK_SETTINGS);

    await assertSucceeds(getDoc(doc(admin, setupPath(FULL_UID))));
    await assertFails(
      updateDoc(doc(admin, setupPath(FULL_UID)), {
        name: "Changed",
      })
    );
  });

  it("denies signed-out setup reads without changing public Favorite reads", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${FULL_UID}`), {
        publicProfileVersion: 2,
        favoriteConfig: {
          sourceSetupId: "s1",
          config: {},
        },
      });
      await setDoc(doc(context.firestore(), setupPath(FULL_UID)), {
        name: "Setup 1",
        config: {},
      });
    });
    const signedOut = testEnv.unauthenticatedContext().firestore(SDK_SETTINGS);

    await assertFails(getDoc(doc(signedOut, setupPath(FULL_UID))));
    await assertSucceeds(getDoc(doc(signedOut, `users/${FULL_UID}`)));
  });
});
