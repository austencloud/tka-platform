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
  });
}

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
    const signedOut = testEnv
      .unauthenticatedContext()
      .firestore(SDK_SETTINGS);

    await assertFails(getDoc(doc(signedOut, setupPath(FULL_UID))));
    await assertSucceeds(
      getDoc(doc(signedOut, `users/${FULL_UID}`))
    );
  });
});
