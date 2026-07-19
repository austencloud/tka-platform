// Regression guard for the email-link confirm-step hardening
// (docs/superpowers/specs/active/2026-07-18-onboarding-firestore-security.md,
// requirement 5): the single-use oobCode must never be consumed
// (signInWithEmailLink / linkWithCredential) without an explicit caller
// supplying an email — i.e. only after the human clicks "Finish signing in"
// in EmailLinkConfirmModal. Detection (isEmailLinkPending) must stay
// read-only and never call the code-consuming APIs itself.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isSignInWithEmailLink: vi.fn(),
  signInWithEmailLink: vi.fn(async () => ({})),
  linkWithCredential: vi.fn(async () => ({})),
  setPersistence: vi.fn(async () => undefined),
  credentialWithLink: vi.fn(() => ({ providerId: "password" })),
}));

vi.mock("firebase/auth", () => ({
  isSignInWithEmailLink: h.isSignInWithEmailLink,
  signInWithEmailLink: h.signInWithEmailLink,
  linkWithCredential: h.linkWithCredential,
  setPersistence: h.setPersistence,
  browserLocalPersistence: {},
  indexedDBLocalPersistence: {},
  EmailAuthProvider: {
    credentialWithLink: h.credentialWithLink,
  },
}));

const authRef = vi.hoisted(() => ({
  current: { currentUser: null as { isAnonymous: boolean; uid: string; providerData: unknown[] } | null },
}));
vi.mock("$lib/shared/auth/firebase", () => ({
  auth: authRef.current,
}));

// The success path dynamically imports these two on the way out (password
// gate flag + anon-upgrade admin notification). Both are fire-and-forget
// side effects unrelated to what this suite verifies (the confirm gate), and
// both pull in heavy unmocked dependency chains (Firestore, gamification,
// library repo, posthog) — stub them so the suite stays a hermetic unit test.
vi.mock("$lib/shared/onboarding/state/password-onboarding-state.svelte", () => ({
  passwordOnboardingState: { markRequired: vi.fn() },
}));
vi.mock("$lib/shared/auth/services/anonymous-upgrade", () => ({
  notifyUpgradeSignup: vi.fn(async () => undefined),
  upgradeMagicLinkCollision: vi.fn(async () => []),
}));

import {
  isEmailLinkPending,
  getSavedEmailForSignIn,
  completeEmailLinkSignIn,
} from "$lib/shared/auth/services/email-link-completion";

const EMAIL_KEY = "emailForSignIn";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  authRef.current.currentUser = null;
  // window.location.href is read but never parsed by this module beyond
  // passing it straight to the (mocked) Firebase calls — jsdom's default
  // href is fine, and isSignInWithEmailLink's return value is fully
  // controlled per-test below.
});

describe("isEmailLinkPending — detection only, never consumes the code", () => {
  it("returns false when the URL is not a sign-in link, without calling the consuming APIs", () => {
    h.isSignInWithEmailLink.mockReturnValue(false);
    expect(isEmailLinkPending()).toBe(false);
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
    expect(h.linkWithCredential).not.toHaveBeenCalled();
  });

  it("returns true when the URL is a pending sign-in link, without calling the consuming APIs", () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    expect(isEmailLinkPending()).toBe(true);
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
    expect(h.linkWithCredential).not.toHaveBeenCalled();
  });
});

describe("getSavedEmailForSignIn — read-only", () => {
  it("reads the saved email from localStorage without consuming anything", () => {
    window.localStorage.setItem(EMAIL_KEY, "guest@example.com");
    expect(getSavedEmailForSignIn()).toBe("guest@example.com");
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
  });

  it("returns null when nothing is saved (wrong-device case)", () => {
    expect(getSavedEmailForSignIn()).toBeNull();
  });
});

describe("completeEmailLinkSignIn — the code-consuming call", () => {
  it("does NOT call signInWithEmailLink when no saved email and no explicit email are given", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    const result = await completeEmailLinkSignIn();

    expect(result).toEqual({
      completed: false,
      errorCode: "auth/missing-email",
      errorMessage: "Email address is required to complete sign-in.",
    });
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
    expect(h.linkWithCredential).not.toHaveBeenCalled();
  });

  it("no-ops entirely when the URL isn't a pending link", async () => {
    h.isSignInWithEmailLink.mockReturnValue(false);
    const result = await completeEmailLinkSignIn("someone@example.com");
    expect(result).toEqual({ completed: false });
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
  });

  it("consumes the code via signInWithEmailLink once a saved email exists (same-device confirm)", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    window.localStorage.setItem(EMAIL_KEY, "guest@example.com");
    authRef.current.currentUser = { isAnonymous: false, uid: "u1", providerData: [] };

    const result = await completeEmailLinkSignIn();

    expect(result.completed).toBe(true);
    expect(h.signInWithEmailLink).toHaveBeenCalledTimes(1);
    expect(h.signInWithEmailLink.mock.calls[0][1]).toBe("guest@example.com");
    // The consumed email is cleared so a reload doesn't try again.
    expect(window.localStorage.getItem(EMAIL_KEY)).toBeNull();
  });

  it("consumes the code via signInWithEmailLink using an explicit email (wrong-device confirm, no window.prompt)", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    // No saved email on this device.
    authRef.current.currentUser = { isAnonymous: false, uid: "u1", providerData: [] };

    const result = await completeEmailLinkSignIn("typed@example.com");

    expect(result.completed).toBe(true);
    expect(h.signInWithEmailLink.mock.calls[0][1]).toBe("typed@example.com");
  });

  it("routes an anonymous current user through linkWithCredential, not signInWithEmailLink", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    window.localStorage.setItem(EMAIL_KEY, "guest@example.com");
    authRef.current.currentUser = { isAnonymous: true, uid: "anon-1", providerData: [] };

    const result = await completeEmailLinkSignIn();

    expect(result.completed).toBe(true);
    expect(h.linkWithCredential).toHaveBeenCalledTimes(1);
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
  });

  it("never falls back to window.prompt when no email is available (wrong-device path)", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("typed-via-prompt@example.com");

    // No saved email, no explicit email — the old code path would have
    // fallen back to window.prompt() here. The new code must not.
    const result = await completeEmailLinkSignIn();

    expect(promptSpy).not.toHaveBeenCalled();
    expect(result.errorCode).toBe("auth/missing-email");
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });
});
