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
  where,
} from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const ANON_UID = "anon-user-1";
const FULL_UID = "full-user-1";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "the-kinetic-alphabet",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

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

describe("anonymous guests: own data", () => {
  it("can write their own sequence", async () => {
    const db = anonCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `users/${ANON_UID}/sequences/s1`), { userId: ANON_UID, steps: [] })
    );
  });
  it("can write their own learning progress", async () => {
    const db = anonCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `users/${ANON_UID}/learningProgress/p1`), { userId: ANON_UID, value: 1 })
    );
  });
});

describe("anonymous guests: community write paths are denied", () => {
  it("cannot create feedback", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `feedback/f1`), { userId: ANON_UID, text: "x" })
    );
  });
  it("cannot publish to publicSequences", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `publicSequences/seq1`), { ownerId: ANON_UID, steps: [] })
    );
  });
  it("cannot claim a username", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `usernames/cooldude`), { userId: ANON_UID })
    );
  });
  it("cannot create a userLocation (community map)", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `userLocations/${ANON_UID}`), { userId: ANON_UID, lat: 0, lng: 0 })
    );
  });
  it("cannot create a shortcode", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `shortcodes/abc123`), { encoded: "abc" })
    );
  });
  it("cannot create a userReport", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `userReports/r1`), {
        reporterId: ANON_UID,
        reportedUserId: "someone-else",
      })
    );
  });
  it("cannot create a video", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `videos/v1`), { creatorId: ANON_UID })
    );
  });
  it("cannot publish a publicHandPath", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `publicHandPaths/hp1`), { ownerId: ANON_UID })
    );
  });
  it("cannot publish a publicSoloProp", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `publicSoloProps/sp1`), { ownerId: ANON_UID })
    );
  });
  it("cannot create a festivalSubmission", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `festivalSubmissions/fs1`), {})
    );
  });
  it("cannot cast a hallOfShame vote", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `hallOfShameVotes/${ANON_UID}_seqX`), {
        voterId: ANON_UID,
        sequenceId: "seqX",
      })
    );
  });
  it("cannot create a hallOfShame report", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `hallOfShameReports/r1`), { reporterId: ANON_UID })
    );
  });
});

describe("full users: community write paths succeed", () => {
  it("can create feedback", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `feedback/f1`), { userId: FULL_UID, text: "x" })
    );
  });
  it("can publish to publicSequences", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `publicSequences/seq1`), { ownerId: FULL_UID, steps: [] })
    );
  });
  it("can claim a username", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `usernames/cooldude`), { userId: FULL_UID })
    );
  });
  it("can create a shortcode", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `shortcodes/abc123`), { encoded: "abc" })
    );
  });
  it("can create a userReport", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `userReports/r1`), {
        reporterId: FULL_UID,
        reportedUserId: "someone-else",
      })
    );
  });
  it("can create a video", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `videos/v1`), { creatorId: FULL_UID })
    );
  });
  it("can publish a publicHandPath", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `publicHandPaths/hp1`), { ownerId: FULL_UID })
    );
  });
  it("can publish a publicSoloProp", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `publicSoloProps/sp1`), { ownerId: FULL_UID })
    );
  });
  it("can create a festivalSubmission", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `festivalSubmissions/fs1`), {})
    );
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
      const db = ctx.firestore();
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
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, `users/${OWNER}/collections/pub`)));
  });

  it("an unauthenticated user CANNOT read a PRIVATE collection", async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER}/collections/priv`)));
  });

  it("a signed-in stranger CANNOT read someone else's PRIVATE collection", async () => {
    await seed();
    const db = userCtx(OTHER).firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER}/collections/priv`)));
  });

  it("the owner CAN read their own PRIVATE collection", async () => {
    await seed();
    const db = userCtx(OWNER).firestore();
    await assertSucceeds(getDoc(doc(db, `users/${OWNER}/collections/priv`)));
  });

  it("a collectionGroup query filtered to isPublic==true is ALLOWED (the discovery feed)", async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      getDocs(query(collectionGroup(db, "collections"), where("isPublic", "==", true)))
    );
  });

  it("a bare collectionGroup query (no isPublic filter) is DENIED — no enumeration of private collections", async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(collectionGroup(db, "collections")));
  });
});

describe("collections: publishing requires a full account (2026-07-18 hardening)", () => {
  it("an anonymous guest CANNOT create a collection with isPublic == true", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `users/${ANON_UID}/collections/pub`), {
        ownerId: ANON_UID,
        isPublic: true,
        name: "Guest attempt",
      })
    );
  });

  it("an anonymous guest CAN create a private collection (isPublic == false)", async () => {
    const db = anonCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `users/${ANON_UID}/collections/priv`), {
        ownerId: ANON_UID,
        isPublic: false,
        name: "Guest private",
      })
    );
  });

  it("an anonymous guest CANNOT convert an existing private collection to public", async () => {
    const db = anonCtx().firestore();
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
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `users/${FULL_UID}/collections/pub`), {
        ownerId: FULL_UID,
        isPublic: true,
        name: "Full user public",
      })
    );
  });

  it("a full user CAN edit a collection that stays public (isPublic untouched in the patch)", async () => {
    const db = fullCtx().firestore();
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
    const db = fullCtx().firestore();
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
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `sequences/legacy1`), { userId: ANON_UID, steps: [] })
    );
  });

  it("a full user CAN create a root-level /sequences doc", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `sequences/legacy2`), { userId: FULL_UID, steps: [] })
    );
  });

  it("root /sequences is NOT world-readable without isPublic (private doc denied to a stranger)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `sequences/priv1`), {
        userId: FULL_UID,
        isPublic: false,
      });
    });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `sequences/priv1`)));
  });

  it("root /sequences IS readable when isPublic == true", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `sequences/pub1`), {
        userId: FULL_UID,
        isPublic: true,
      });
    });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, `sequences/pub1`)));
  });

  it("root /collections is fully closed (block deleted — default deny)", async () => {
    const db = fullCtx().firestore();
    await assertFails(
      setDoc(doc(db, `collections/c1`), { userId: FULL_UID, isPublic: true })
    );
  });
});

describe("journeyPoints: public read + create, no update/delete", () => {
  const SHORTCODE = "ABCD";
  const pointData = {
    printId: "print-abc",
    lat: 41.8781,
    lng: -87.6298,
    city: "Chicago",
    country: "US",
    timestamp: new Date(),
  };

  it("unauthenticated user can read journeyPoints collection", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      getDocs(collection(db, "shortcodes", SHORTCODE, "journeyPoints"))
    );
  });

  it("unauthenticated user can create a journeyPoint", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      addDoc(collection(db, "shortcodes", SHORTCODE, "journeyPoints"), pointData)
    );
  });

  it("unauthenticated user cannot update a journeyPoint", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(
        doc(db, "shortcodes", SHORTCODE, "journeyPoints", "point1"),
        { printId: "updated" },
        { merge: true }
      )
    );
  });

  it("unauthenticated user cannot delete a journeyPoint", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      deleteDoc(doc(db, "shortcodes", SHORTCODE, "journeyPoints", "point1"))
    );
  });
});
