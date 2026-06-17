import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

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
