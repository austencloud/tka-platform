import { GUEST_SAVE_CAP } from "./guest-access-config";

export type AuthNudgeTrigger =
  | "save"
  | "beat-cap-guest"
  | "export"
  | "module:learn"
  | "module:library"
  | "module:settings"
  | "edit-community"
  | "loop-locked-guest"
  | "viewer-signin-publish"
  | "viewer-signin-download"
  | "viewer-signin-account"
  | "guest-first-save";

// One phrasing for the account ask across every entry: "Create a free
// account to <do the specific thing>." The button that pairs with this copy
// (AuthNudge.svelte) reads "Create account". No "Sign up free" / "Create
// Account - free" variants — those drifted into four incompatible phrasings
// (2026-06-18 finding, closed 2026-07-18).
export const AUTH_NUDGE_TEXTS: Record<AuthNudgeTrigger, string> = {
  save: `Guests can save ${GUEST_SAVE_CAP} sequences. Create a free account to save more.`,
  "beat-cap-guest":
    "Guests can create sequences up to 8 beats. Create a free account for up to 64 beats.",
  export: "Create a free account to export your sequences.",
  "module:learn": "Create a free account to start learning TKA notation.",
  "module:library":
    "Your saved sequences live here. Log in or create a free account to see them.",
  "module:settings": "Create a free account to customize your settings.",
  "edit-community": "Create a free account to edit and remix sequences.",
  // Gloss inline rather than gating the nudge behind a LOOP explanation - a
  // guest hits this mid-funnel, not after reading the guide. Degree-free on
  // purpose: rotated LOOPs span halved (180°) and quartered (90°) rotation
  // (MCP get_domain_topic("rotated LOOP")), so the gloss names the mechanism,
  // not one angle.
  "loop-locked-guest":
    "Rotated LOOPs, sequences that return to their start by repeating the pattern rotated around the grid, are free. Create a free account for every LOOP type.",
  // SignInSheet.svelte (sequence-viewer, /q scan funnel) - the three reasons
  // that actually reach the sheet (publish/download require a full account
  // per gated-action-policy.ts; account is the /q header chip's plain
  // sign-in). save/favorite/remix/sendTo never prompt, so they keep their
  // own local "Sign in to..." copy in SignInSheet.svelte - not an account
  // ask, out of scope here.
  "viewer-signin-publish": "Create a free account to publish this sequence.",
  "viewer-signin-download": "Create a free account to download this sequence.",
  "viewer-signin-account":
    "Create a free account to save your scans and build your library.",
  // SP3 first-session activation (Part B): fires once, after a guest's first
  // save persists - see docs/superpowers/specs/active/2026-07-22-first-session-activation-design.md.
  "guest-first-save":
    "Create a free account to keep your sequences and find them on any device.",
};
