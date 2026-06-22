// End-to-end integration test for the guest-continuity auth flow.
//
// Runs the REAL wrapper functions (ensureGuestIdentity / upgradeAnonymousWithEmail
// / importDrafts) against the Firebase AUTH EMULATOR. The two heavy deps are
// mocked: the app's HMR-heavy `$lib/shared/auth/firebase` module (replaced with a
// thin getAuthInstance that returns a real emulator-connected Auth), and the
// library repository (replaced with a recording stub).
//
// Requires the auth emulator on 127.0.0.1:9099. Run via `pnpm run test:e2e`,
// which wraps this in `firebase emulators:exec --only auth`.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  type Auth,
} from "firebase/auth";

const EMULATOR_HOST = "http://127.0.0.1:9099";
const PROJECT_ID = "the-kinetic-alphabet";
const ACCOUNTS_ENDPOINT = `${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`;

// vi.mock factories are hoisted above imports, so they can't close over a normal
// top-level `let`. Shared mutable refs via vi.hoisted bridge that gap.
const h = vi.hoisted(() => ({
  testAuth: null as Auth | null,
  repo: null as any,
}));

vi.mock("$lib/shared/auth/firebase", () => ({
  getAuthInstance: async () => h.testAuth,
}));

vi.mock("$lib/shared/library/get-library-repository", () => ({
  getLibraryRepository: () => h.repo,
}));

// notifyUpgradeSignup() fires `getPropUnlockManager().mergeGuestCollection()` on
// the linked path. The real manager pulls in a `.svelte.ts` $state rune module,
// which can't compile in this plugin-less emulator config. Stub it — the upgrade
// logic under test doesn't depend on the merge.
vi.mock("$lib/shared/gamification/get-prop-unlock-manager", () => ({
  getPropUnlockManager: () => ({ mergeGuestCollection: () => undefined }),
}));

// toast-state is a `.svelte.ts` $state rune module — same plugin-less-compile
// problem. notifyUpgradeSignup() calls toast.success() on the linked path.
vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toast: { success: () => undefined, error: () => undefined },
}));

// Static imports are fine: vi.mock is hoisted above them, so these resolve to
// the mocked modules.
import {
  ensureGuestIdentity,
} from "$lib/shared/auth/services/guest-identity";
import {
  importDrafts,
  upgradeAnonymousWithEmail,
} from "$lib/shared/auth/services/anonymous-upgrade";

/** Minimal fake draft. The repo is stubbed, so the exact shape doesn't matter. */
function makeDraft(id: string) {
  return { id, word: id.toUpperCase(), steps: [] } as any;
}

/** Fresh recording repo stub for each test. */
function makeRepoStub() {
  return {
    getUserSequences: vi.fn(async (_uid: string) => [] as any[]),
    saveSequence: vi.fn(async (_seq: any) => undefined),
  };
}

async function clearEmulatorAccounts() {
  await fetch(ACCOUNTS_ENDPOINT, { method: "DELETE" });
}

describe("anonymous identity upgrade (auth emulator E2E)", () => {
  beforeAll(() => {
    const testApp = initializeApp(
      { projectId: PROJECT_ID, apiKey: "fake-api-key" },
      "e2e-test"
    );
    const testAuth = getAuth(testApp);
    connectAuthEmulator(testAuth, EMULATOR_HOST, { disableWarnings: true });
    h.testAuth = testAuth;
  });

  beforeEach(async () => {
    // signOut clears testAuth.currentUser so ensureGuestIdentity starts clean;
    // the REST DELETE wipes the emulator's account store so collisions / uid
    // reuse can't leak across tests.
    await signOut(h.testAuth!);
    await clearEmulatorAccounts();
    h.repo = makeRepoStub();
  });

  it("1. lazily provisions an anonymous identity and is idempotent", async () => {
    expect(h.testAuth!.currentUser).toBeNull();

    await ensureGuestIdentity();
    const user = h.testAuth!.currentUser;
    expect(user).not.toBeNull();
    expect(user!.isAnonymous).toBe(true);

    const firstUid = user!.uid;

    // Second call is a no-op: same uid, no new account minted.
    await ensureGuestIdentity();
    expect(h.testAuth!.currentUser!.uid).toBe(firstUid);
  });

  it("2. links email in place, preserving the anon uid (happy path)", async () => {
    await ensureGuestIdentity();
    const anonUid = h.testAuth!.currentUser!.uid;

    h.repo.getUserSequences.mockResolvedValueOnce([
      makeDraft("d1"),
      makeDraft("d2"),
    ]);

    const res = await upgradeAnonymousWithEmail(
      "newuser@example.com",
      "password123"
    );

    expect(res.status).toBe("linked");

    const user = h.testAuth!.currentUser!;
    expect(user.uid).toBe(anonUid); // SAME uid — linked in place
    expect(user.isAnonymous).toBe(false);

    // Email provider is now linked onto the (formerly anon) account.
    const providerIds = user.providerData.map((p) => p.providerId);
    expect(providerIds).toContain("password");
  });

  it("3. collision signs into the existing account and offers drafts to import", async () => {
    // Pre-create a permanent account, then drop the session so the upgrade
    // starts from a fresh anon user.
    await createUserWithEmailAndPassword(
      h.testAuth!,
      "taken@example.com",
      "password123"
    );
    await signOut(h.testAuth!);

    await ensureGuestIdentity();
    const anonUid = h.testAuth!.currentUser!.uid;
    expect(h.testAuth!.currentUser!.isAnonymous).toBe(true);

    h.repo.getUserSequences.mockResolvedValueOnce([
      makeDraft("d1"),
      makeDraft("d2"),
    ]);

    const res = await upgradeAnonymousWithEmail(
      "taken@example.com",
      "password123"
    );

    expect(res.status).toBe("collision-signed-in");
    expect(res.importable).toBeDefined();
    expect(res.importable!.length).toBe(2);

    const user = h.testAuth!.currentUser!;
    expect(user.uid).not.toBe(anonUid); // signed into the pre-existing account
    expect(user.isAnonymous).toBe(false);
  });

  it("4. importDrafts copies drafts, swallows duplicates, rethrows other errors", async () => {
    // First save succeeds, second is a duplicate (ALREADY_EXISTS, swallowed).
    h.repo.saveSequence
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ code: "ALREADY_EXISTS" });

    const n = await importDrafts([makeDraft("dA"), makeDraft("dB")]);
    expect(n).toBe(1);
    expect(h.repo.saveSequence).toHaveBeenCalledTimes(2);

    // A non-duplicate error must propagate.
    h.repo.saveSequence.mockRejectedValueOnce({ code: "SOMETHING_ELSE" });
    await expect(importDrafts([makeDraft("dC")])).rejects.toMatchObject({
      code: "SOMETHING_ELSE",
    });
  });
});
