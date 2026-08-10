import { GUEST_SAVE_CAP } from "./guest-access-config";

export type AuthNudgeTrigger =
  | "save"
  | "step-cap-guest"
  | "export"
  | "module:learn"
  | "module:library"
  | "module:settings"
  | "edit-community"
  | "loop-locked-guest"
  | "community-setups"
  | "saved-setups"
  | "share-setup"
  | "share-sequence"
  | "viewer-signin-publish"
  | "viewer-signin-download"
  | "viewer-signin-account"
  | "guest-first-save"
  | "prop-collection"
  | "share-image-signin";

export type AuthMode = "signin" | "signup";

export interface AuthPromptContent {
  key: string;
  title: string;
  body: string;
}

// One phrasing for the account ask across every entry: "Create a free
// account to <do the specific thing>." The button that pairs with this copy
// (AuthNudge.svelte) reads "Create account". No "Sign up free" / "Create
// Account - free" variants — those drifted into four incompatible phrasings
// (2026-06-18 finding, closed 2026-07-18).
export const AUTH_NUDGE_TEXTS: Record<AuthNudgeTrigger, string> = {
  save: `Guests can save ${GUEST_SAVE_CAP} sequences. Create a free account to save more.`,
  "step-cap-guest":
    "Guests can create sequences up to 8 steps. Create a free account for up to 64 steps.",
  export: "Create a free account to export your sequences.",
  "module:learn": "Create a free account to start learning TKA notation.",
  "module:library":
    "Your saved sequences live here. Log in or create a free account to see them.",
  "module:settings": "Create a free account to customize your settings.",
  "edit-community": "Create a free account to edit and remix sequences.",
  // Lead with the ask, never with a definition. A guest hits this after
  // tapping Mirrored/Inverted/etc., so opening with "Rotated LOOPs are
  // sequences that..." reads as a non sequitur (Austen, 2026-08-10). What
  // rotated means is the guide's job; this nudge only names the unlock and
  // what stays free meanwhile.
  "loop-locked-guest":
    "Create a free account to use every LOOP type. Rotated LOOPs stay free without one.",
  "community-setups":
    "Create a free account to use community setups and build sequences up to 64 steps.",
  "saved-setups": "Create a free account to keep setups across sessions.",
  // Community cards show the creator's name and avatar, so sharing a setup
  // needs a full account. The state layer blocks the write as a second gate.
  "share-setup":
    "Create a free account to share your setup with the community.",
  "share-sequence":
    "Create a free account to send sequences, make links, and share or download Choreo Cards.",
  // Sequence viewer / /q scan funnel - the three reasons that actually reach
  // the shared AuthModal (publish/download require a full account per
  // gated-action-policy.ts; account is the /q header chip's plain sign-in).
  // save/favorite/remix/sendTo provision a guest silently and never prompt, so
  // they need no key here. The viewer maps reason -> trigger in
  // auth-action-queue.svelte.ts (`signInTriggerFor`); it holds no auth copy of
  // its own, so this stays the single source of truth for the ask.
  "viewer-signin-publish": "Create a free account to publish this sequence.",
  "viewer-signin-download": "Create a free account to download this sequence.",
  "viewer-signin-account":
    "Create a free account to save your scans and build your library.",
  // SP3 first-session activation (Part B): fires once, after a guest's first
  // save persists - see docs/superpowers/specs/active/2026-07-22-first-session-activation-design.md.
  "guest-first-save":
    "Create a free account to keep your sequences and find them on any device.",
  "prop-collection":
    "Create a free account to keep your earned prop collection.",
  // Share intake, trace 3: the user shared an image while signed out.
  // services/implementations/MessageImageSender.ts:32-34 rejects anonymous/guest
  // uploads outright, so this is a hard requirement, not a nudge. Phrased as
  // the ask rather than the refusal - the bytes are already safe in IndexedDB
  // and the send resumes by itself once they are in.
  "share-image-signin":
    "Create a free account to send the image you shared. It's saved until you do.",
};

// The nudge card and the auth modal meet the user at different moments. The
// nudge explains the gate; after they choose an account action, the modal names
// the exact thing they were trying to do and gets out of the way.
const AUTH_PROMPT_CONTENTS: Record<AuthNudgeTrigger, AuthPromptContent> = {
  save: {
    key: "save",
    title: "Keep saving sequences",
    body: "A free account keeps every sequence in your library and opens it on any device.",
  },
  "step-cap-guest": {
    key: "step-cap-guest",
    title: "Keep adding steps",
    body: "A free account raises the limit from 8 steps to 64.",
  },
  export: {
    key: "export",
    title: "Export this sequence",
    body: "Sign in or create an account to download animations and Choreo Cards.",
  },
  "module:learn": {
    key: "module:learn",
    title: "Start learning",
    body: "Sign in or create an account to start learning TKA notation.",
  },
  "module:library": {
    key: "module:library",
    title: "Open your library",
    body: "Sign in or create an account to open your saved sequences.",
  },
  "module:settings": {
    key: "module:settings",
    title: "Save your settings",
    body: "Sign in or create an account to customize your settings.",
  },
  "edit-community": {
    key: "edit-community",
    title: "Edit this sequence",
    body: "Sign in or create an account to edit and remix this sequence.",
  },
  "loop-locked-guest": {
    key: "loop-locked-guest",
    title: "Try every LOOP type",
    body: "A free account lets you use every LOOP type.",
  },
  "community-setups": {
    key: "community-setups",
    title: "Use this setup",
    body: "A free account lets you use community setups and build sequences up to 64 steps.",
  },
  "saved-setups": {
    key: "saved-setups",
    title: "Keep your setups",
    body: "Sign in or create an account to keep setups across sessions.",
  },
  "share-setup": {
    key: "share-setup",
    title: "Share this setup",
    body: "Sign in or create an account to share this setup with the community.",
  },
  "share-sequence": {
    key: "share-sequence",
    title: "Share this sequence",
    body: "Sign in or create an account to send it, make a link, or download a Choreo Card.",
  },
  "viewer-signin-publish": {
    key: "viewer-signin-publish",
    title: "Publish this sequence",
    body: "Sign in or create an account to publish this sequence.",
  },
  "viewer-signin-download": {
    key: "viewer-signin-download",
    title: "Download this sequence",
    body: "Sign in or create an account to download this sequence.",
  },
  "viewer-signin-account": {
    key: "viewer-signin-account",
    title: "Keep your scans",
    body: "A free account keeps your scans in your library.",
  },
  "guest-first-save": {
    key: "guest-first-save",
    title: "Save this sequence",
    body: "A free account keeps it in your library and opens it on any device.",
  },
  "prop-collection": {
    key: "prop-collection",
    title: "Keep your prop collection",
    body: "A free account keeps the props you earn in your collection.",
  },
  "share-image-signin": {
    key: "share-image-signin",
    title: "Send this image",
    body: "Sign in to send this image. It is saved and will send when you return.",
  },
};

const GENERIC_AUTH_PROMPTS: Record<AuthMode, AuthPromptContent> = {
  signup: {
    key: "generic-signup",
    title: "Create your account",
    body: "Save your sequences and open them on any device.",
  },
  signin: {
    key: "generic-signin",
    title: "Welcome back",
    body: "Sign in to open your saved work.",
  },
};

export function getAuthPromptContent(
  trigger: AuthNudgeTrigger | null | undefined,
  mode: AuthMode
): AuthPromptContent {
  return trigger ? AUTH_PROMPT_CONTENTS[trigger] : GENERIC_AUTH_PROMPTS[mode];
}
