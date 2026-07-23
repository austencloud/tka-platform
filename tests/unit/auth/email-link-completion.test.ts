// Regression guard for the email-link confirm-step hardening
// (docs/superpowers/specs/active/2026-07-18-onboarding-firestore-security.md,
// requirement 5): the single-use oobCode must never be consumed until the
// human clicks "Finish signing in" in EmailLinkConfirmModal. Detection
// (isEmailLinkPending) stays read-only, while the cross-device path resolves
// the original email from short-lived opaque state instead of asking again.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isSignInWithEmailLink: vi.fn(),
  parseActionCodeURL: vi.fn(),
  signInWithEmailLink: vi.fn(async () => ({})),
  linkWithCredential: vi.fn(async () => ({})),
  setPersistence: vi.fn(async () => undefined),
  credentialWithLink: vi.fn(() => ({ providerId: "password" })),
  resolveEmail: vi.fn(async () => ({
    data: {
      success: true,
      email: "linked@example.com",
    },
  })),
  httpsCallable: vi.fn(),
  getFunctionsInstance: vi.fn(async () => ({ name: "functions" })),
  markFirstRunSkipped: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  isSignInWithEmailLink: h.isSignInWithEmailLink,
  parseActionCodeURL: h.parseActionCodeURL,
  signInWithEmailLink: h.signInWithEmailLink,
  linkWithCredential: h.linkWithCredential,
  setPersistence: h.setPersistence,
  browserLocalPersistence: {},
  indexedDBLocalPersistence: {},
  EmailAuthProvider: {
    credentialWithLink: h.credentialWithLink,
  },
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: h.httpsCallable,
}));

const authRef = vi.hoisted(() => ({
  current: {
    currentUser: null as {
      isAnonymous: boolean;
      uid: string;
      providerData: unknown[];
    } | null,
  },
}));
vi.mock("$lib/shared/auth/firebase", () => ({
  auth: authRef.current,
  getFunctionsInstance: h.getFunctionsInstance,
}));

// Successful magic-link auth skips profile setup and anonymous upgrades can
// send an admin notification. Stub both side effects so this suite stays
// focused on link completion.
vi.mock("$lib/shared/onboarding/state/first-run-state.svelte", () => ({
  firstRunState: { markSkipped: h.markFirstRunSkipped },
}));
vi.mock("$lib/shared/auth/services/anonymous-upgrade", () => ({
  notifyUpgradeSignup: vi.fn(async () => undefined),
  upgradeMagicLinkCollision: vi.fn(async () => []),
}));

import {
  isEmailLinkPending,
  getSavedEmailForSignIn,
  getPendingEmailLinkRecipient,
  completeEmailLinkSignIn,
} from "$lib/shared/auth/services/email-link-completion";

const EMAIL_KEY = "emailForSignIn";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/create");
  authRef.current.currentUser = null;
  h.parseActionCodeURL.mockReturnValue(null);
  h.httpsCallable.mockReturnValue(h.resolveEmail);
  h.resolveEmail.mockResolvedValue({
    data: {
      success: true,
      email: "linked@example.com",
    },
  });
  // Firebase's action-link parser is mocked above, so each test can opt into
  // an opaque-state link without constructing a real oobCode.
});

function setOpaqueLinkState(state = "a".repeat(43)) {
  h.parseActionCodeURL.mockReturnValue({
    continueUrl: `https://tkaflowarts.com/create?magicLinkState=${state}`,
  });
  return state;
}

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

describe("getPendingEmailLinkRecipient — identity preview", () => {
  it("resolves the state-bound email without consuming the Firebase code", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    const state = setOpaqueLinkState();

    await expect(getPendingEmailLinkRecipient()).resolves.toBe(
      "linked@example.com"
    );
    expect(h.resolveEmail).toHaveBeenCalledWith({
      action: "resolve-email",
      state,
    });
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
    expect(h.linkWithCredential).not.toHaveBeenCalled();
  });
});

describe("completeEmailLinkSignIn — the code-consuming call", () => {
  it("does NOT consume a legacy link when no saved email is available", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    const result = await completeEmailLinkSignIn();

    expect(result).toEqual({
      completed: false,
      errorCode: "auth/missing-email",
      errorMessage: "Request a new sign-in link to continue.",
    });
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
    expect(h.linkWithCredential).not.toHaveBeenCalled();
  });

  it("no-ops entirely when the URL isn't a pending link", async () => {
    h.isSignInWithEmailLink.mockReturnValue(false);
    const result = await completeEmailLinkSignIn();
    expect(result).toEqual({ completed: false });
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
  });

  it("consumes the code via signInWithEmailLink once a saved email exists (same-device confirm)", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    window.localStorage.setItem(EMAIL_KEY, "guest@example.com");
    authRef.current.currentUser = {
      isAnonymous: false,
      uid: "u1",
      providerData: [],
    };

    const result = await completeEmailLinkSignIn();

    expect(result.completed).toBe(true);
    expect(h.signInWithEmailLink).toHaveBeenCalledTimes(1);
    expect(h.signInWithEmailLink.mock.calls[0][1]).toBe("guest@example.com");
    expect(h.markFirstRunSkipped).toHaveBeenCalledWith("u1");
    // The consumed email is cleared so a reload doesn't try again.
    expect(window.localStorage.getItem(EMAIL_KEY)).toBeNull();
  });

  it("resolves the original email from opaque state on another device", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    const state = setOpaqueLinkState();
    authRef.current.currentUser = {
      isAnonymous: false,
      uid: "u1",
      providerData: [],
    };

    const result = await completeEmailLinkSignIn();

    expect(result.completed).toBe(true);
    expect(h.resolveEmail).toHaveBeenCalledWith({
      action: "resolve-email",
      state,
    });
    expect(h.signInWithEmailLink.mock.calls[0][1]).toBe("linked@example.com");
  });

  it("uses the state-bound email instead of stale local storage", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    setOpaqueLinkState();
    window.localStorage.setItem(EMAIL_KEY, "stale@example.com");
    authRef.current.currentUser = {
      isAnonymous: false,
      uid: "u1",
      providerData: [],
    };

    const result = await completeEmailLinkSignIn();

    expect(result.completed).toBe(true);
    expect(h.signInWithEmailLink.mock.calls[0][1]).toBe("linked@example.com");
  });

  it("routes an anonymous current user through linkWithCredential, not signInWithEmailLink", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    window.localStorage.setItem(EMAIL_KEY, "guest@example.com");
    authRef.current.currentUser = {
      isAnonymous: true,
      uid: "anon-1",
      providerData: [],
    };

    const result = await completeEmailLinkSignIn();

    expect(result.completed).toBe(true);
    expect(h.linkWithCredential).toHaveBeenCalledTimes(1);
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
  });

  it("maps an expired opaque state to an expired action code without consuming Firebase's code", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    setOpaqueLinkState();
    h.resolveEmail.mockRejectedValue({
      code: "functions/failed-precondition",
      message: "expired",
    });

    const result = await completeEmailLinkSignIn();

    expect(result).toEqual({
      completed: false,
      errorCode: "auth/expired-action-code",
      errorMessage: "This sign-in link is invalid or expired.",
    });
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
    expect(h.linkWithCredential).not.toHaveBeenCalled();
  });

  it("never falls back to window.prompt when no email is available", async () => {
    h.isSignInWithEmailLink.mockReturnValue(true);
    const promptSpy = vi
      .spyOn(window, "prompt")
      .mockReturnValue("typed-via-prompt@example.com");

    // No saved email or opaque state. The old code path would have fallen
    // back to window.prompt() here. The new code must not.
    const result = await completeEmailLinkSignIn();

    expect(promptSpy).not.toHaveBeenCalled();
    expect(result.errorCode).toBe("auth/missing-email");
    expect(h.signInWithEmailLink).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });
});
