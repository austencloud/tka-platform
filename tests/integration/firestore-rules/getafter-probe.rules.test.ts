/**
 * Emulator capability probe: can THIS firebase-tools version evaluate
 * getAfter() at all? firebase-tools 14.23.0 failed EVERY getAfter call
 * ("Service call error. Function: [getAfter]" — the #2983/#2067 defect
 * class), which is why the phase-4 claim-linkage rules were deferred. The
 * phase-4 strict rules depend on this probe passing; it uses INLINE rules so
 * the answer is about the emulator, not about firestore.rules.
 *
 * Run: firebase emulators:exec --only firestore --project the-kinetic-alphabet \
 *   "vitest run --config tests/config/vitest.rules.config.ts tests/integration/firestore-rules/getafter-probe.rules.test.ts"
 */
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, writeBatch } from "firebase/firestore";

const PROBE_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /probeMain/{id} {
      allow read: if true;
      allow create: if getAfter(/databases/$(database)/documents/probeClaims/$(id)).data.main == id;
    }
    match /probeClaims/{id} {
      allow read, create: if true;
    }
  }
}
`;

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "the-kinetic-alphabet",
    firestore: { rules: PROBE_RULES, host: "127.0.0.1", port: 8080 },
  });
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

const SDK_SETTINGS = { experimentalForceLongPolling: true };

describe("emulator getAfter capability", () => {
  it("accepts a write whose getAfter dependency is satisfied in the same batch", async () => {
    const db = testEnv
      .authenticatedContext("prober", { firebase: { sign_in_provider: "password" } })
      .firestore(SDK_SETTINGS);
    const batch = writeBatch(db);
    batch.set(doc(db, "probeMain/x1"), { v: 1 });
    batch.set(doc(db, "probeClaims/x1"), { main: "x1" });
    await assertSucceeds(batch.commit());
  });

  it("denies a write whose getAfter dependency is absent", async () => {
    const db = testEnv
      .authenticatedContext("prober", { firebase: { sign_in_provider: "password" } })
      .firestore(SDK_SETTINGS);
    const batch = writeBatch(db);
    batch.set(doc(db, "probeMain/x2"), { v: 1 });
    await assertFails(batch.commit());
  });
});
