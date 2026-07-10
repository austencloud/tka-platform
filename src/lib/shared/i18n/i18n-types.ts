// AUTO-GENERATED - DO NOT EDIT
// Run: npm run i18n:types
// Generated: 2026-07-10T05:51:22.792Z
// Keys: 1747

import enMessages from "../../../../messages/en.json";

/** All valid translation keys (1747 keys) */
export type TranslationKey = keyof typeof enMessages;

/** Type-safe message lookup */
export type Messages = typeof enMessages;

/** Check if a key exists */
export function isValidKey(key: string): key is TranslationKey {
  return key in enMessages;
}
