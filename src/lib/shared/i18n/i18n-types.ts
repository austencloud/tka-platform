// AUTO-GENERATED - DO NOT EDIT
// Run: npm run i18n:types
// Generated: 2026-01-29T05:21:45.757Z
// Keys: 1435

import enMessages from "../../../../messages/en.json";

/** All valid translation keys (1435 keys) */
export type TranslationKey = keyof typeof enMessages;

/** Type-safe message lookup */
export type Messages = typeof enMessages;

/** Check if a key exists */
export function isValidKey(key: string): key is TranslationKey {
  return key in enMessages;
}
