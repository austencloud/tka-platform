import { describe, it, expect, vi, beforeEach } from "vitest";

// Keep the cloud-sync path hermetic: no real Firestore in a unit run.
// Mirrors tests/unit/onboarding/generate-tour-state.test.ts.
vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn(async () => ({})),
}));

const { mockDocSnap } = vi.hoisted(() => ({
  mockDocSnap: { exists: false, data: {} as Record<string, unknown> },
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({
    exists: () => mockDocSnap.exists,
    data: () => mockDocSnap.data,
  })),
  setDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => 0),
}));

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: { effectiveUserId: null as string | null },
}));
vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: mockAuthState,
}));

type PasswordOnboarding =
  typeof import("$lib/shared/onboarding/state/password-onboarding-state.svelte").passwordOnboardingState;

/** Re-import the singleton with a clean module + localStorage each time so we
 *  can exercise its construction-time read of the persisted flags. */
async function freshState(): Promise<PasswordOnboarding> {
  vi.resetModules();
  const mod = await import(
    "$lib/shared/onboarding/state/password-onboarding-state.svelte"
  );
  return mod.passwordOnboardingState;
}

describe("passwordOnboardingState — syncFromCloud reset-on-missing-doc", () => {
  beforeEach(() => {
    localStorage.clear();
    mockAuthState.effectiveUserId = null;
    mockDocSnap.exists = false;
    mockDocSnap.data = {};
  });

  it("resets a stale local hasPassword=true when the cloud doc is missing (reused-device leak)", async () => {
    localStorage.setItem("tka-has-password", "true");
    mockAuthState.effectiveUserId = "new-account-uid";
    mockDocSnap.exists = false;

    const state = await freshState();
    expect(state.hasPassword).toBe(true); // stale, inherited local flag

    await state.syncFromCloud();

    expect(state.hasPassword).toBe(false);
    expect(localStorage.getItem("tka-has-password")).toBeNull();
    expect(state.cloudSynced).toBe(true);
  });

  it("leaves a locally-flagged `required` alone on a missing doc (must survive until password is set)", async () => {
    mockAuthState.effectiveUserId = "magic-link-uid";
    mockDocSnap.exists = false;

    const state = await freshState();
    state.markRequired();
    expect(state.required).toBe(true);

    await state.syncFromCloud();

    expect(state.hasPassword).toBe(false);
    expect(state.required).toBe(true);
  });

  it("confirms hasPassword=true when the cloud doc says so", async () => {
    mockAuthState.effectiveUserId = "returning-uid";
    mockDocSnap.exists = true;
    mockDocSnap.data = { hasPassword: true, required: false };

    const state = await freshState();
    await state.syncFromCloud();

    expect(state.hasPassword).toBe(true);
    expect(state.required).toBe(false);
  });

  // NOTE: unlike first-run-state/generate-tour-state, the pre-existing
  // no-effectiveUserId branch here returns without setting cloudSynced=true.
  // That's an existing gap outside this spec's scope (not one of the four
  // findings in 2026-07-18-onboarding-account-state-hygiene.md) - not
  // asserted here to avoid encoding a behavior this task didn't request.
});
