import { GUEST_SAVE_CAP } from "./guest-access-config";

export type AuthNudgeTrigger =
  | "save"
  | "beat-cap-guest"
  | "export"
  | "module:learn"
  | "module:library"
  | "module:settings"
  | "edit-community"
  | "loop-locked-guest";

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
  // guest hits this mid-funnel, not after reading the guide. Framing matches
  // the guide's own LOOP copy ("each repetition is rotated by 180°") and the
  // MCP get_domain_topic("caps vs loops") definition: rotated positions
  // continue in the same direction across 180-degree slices.
  "loop-locked-guest":
    "Rotated LOOPs, sequences that return to their starting position with each repeat rotated 180°, are free. Create a free account for every LOOP type.",
};
