export type AuthNudgeTrigger =
  | "save"
  | "beat-cap-guest"
  | "export"
  | "module:learn"
  | "module:library"
  | "module:settings"
  | "edit-community"
  | "generate-cap";

export const AUTH_NUDGE_TEXTS: Record<AuthNudgeTrigger, string> = {
  save: "Create a free account to save your sequences. Takes about 10 seconds.",
  "beat-cap-guest":
    "Guests can create sequences up to 8 beats. Sign up free for up to 64.",
  export: "Create a free account to export your sequences.",
  "module:learn": "Sign up free to start learning TKA notation.",
  "module:library":
    "Your saved sequences live here. Log in or create a free account to access your library.",
  "module:settings": "Create a free account to customize your settings.",
  "edit-community": "Create a free account to edit and remix sequences.",
  "generate-cap":
    "Guests can generate sequences up to 8 beats. Sign up free for up to 64.",
};
