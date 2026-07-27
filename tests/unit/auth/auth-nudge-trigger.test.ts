// Regression guard for the nudge-copy consolidation
// (docs/superpowers/specs/active/2026-07-18-onboarding-nudge-copy-export-gate.md).
// AUTH_NUDGE_TEXTS is the single source of the guest→account "ask" copy;
// this locks the collapsed phrasing so a future edit can't silently
// reintroduce a competing "Sign up free" / "Create Account - free" variant.

import { describe, expect, it } from "vitest";
import {
  AUTH_NUDGE_TEXTS,
  type AuthNudgeTrigger,
} from "$lib/shared/auth/domain/auth-nudge-trigger";
import { GUEST_SAVE_CAP } from "$lib/shared/auth/domain/guest-access-config";

const BANNED_PHRASES = [
  "Sign up free",
  "sign up free",
  "Create Account - free",
  "unlock",
  "Unlock",
];

const entries = Object.entries(AUTH_NUDGE_TEXTS) as [AuthNudgeTrigger, string][];

describe("AUTH_NUDGE_TEXTS — one phrasing for the account ask", () => {
  it("has exactly the 12 live triggers (generate-cap deleted as a dead duplicate of step-cap-guest; viewer-signin-* added for SignInSheet.svelte's consolidated account ask; guest-first-save added for SP3 first-session activation)", () => {
    expect(Object.keys(AUTH_NUDGE_TEXTS).sort()).toEqual(
      [
        "step-cap-guest",
        "edit-community",
        "export",
        "guest-first-save",
        "loop-locked-guest",
        "module:learn",
        "module:library",
        "module:settings",
        "save",
        "viewer-signin-account",
        "viewer-signin-download",
        "viewer-signin-publish",
      ].sort()
    );
  });

  it("every entry avoids the competing phrasings the audit flagged", () => {
    for (const [trigger, text] of entries) {
      for (const banned of BANNED_PHRASES) {
        expect(text, `${trigger} contains banned phrase "${banned}"`).not.toContain(banned);
      }
    }
  });

  it("every entry uses the canonical 'create a free account' ask (case-insensitive)", () => {
    for (const [trigger, text] of entries) {
      expect(
        text.toLowerCase(),
        `${trigger} missing canonical ask phrase`
      ).toContain("create a free account");
    }
  });

  it("no entry contains an em dash (writing-guide rule)", () => {
    for (const [trigger, text] of entries) {
      expect(text, `${trigger} contains an em dash`).not.toMatch(/—/);
    }
  });

  it("the save cap nudge interpolates GUEST_SAVE_CAP, not a hardcoded number", () => {
    expect(AUTH_NUDGE_TEXTS.save).toContain(`${GUEST_SAVE_CAP}`);
  });

  it("the loop-locked-guest nudge glosses 'Rotated LOOPs' instead of dropping bare jargon", () => {
    const text = AUTH_NUDGE_TEXTS["loop-locked-guest"];
    expect(text).toContain("Rotated LOOPs");
    // The gloss: a plain-language clause explaining what "rotated" means here,
    // grounded in the domain framing (returns to start, pattern rotated per
    // repeat). Deliberately degree-free: rotated LOOPs include both halved
    // (180°) and quartered (90°) rotation, so naming one degree would be wrong.
    expect(text).toContain("return");
    expect(text).toContain("rotated");
    expect(text).not.toContain("180°");
    // Domain rule: "turn" is reserved for prop/body turns, never a LOOP's
    // rotation slice (tka-domain.md). Word-boundary regex so "return"/
    // "returns" (legitimately part of the gloss) don't false-positive.
    expect(text.toLowerCase()).not.toMatch(/\bturns?\b/);
  });
});
