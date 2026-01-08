#!/usr/bin/env node
/**
 * i18n Type Generator
 *
 * Generates TypeScript types from messages/en.json for type-safe translations.
 * Run with: npm run i18n:types
 */

const fs = require('fs');
const path = require('path');

const messagesPath = path.resolve(__dirname, '../messages/en.json');
const outputPath = path.resolve(__dirname, '../src/lib/shared/i18n/i18n-types.ts');

// Load and parse messages
const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'));
const keys = Object.keys(messages).filter(k => !k.startsWith('$'));

// Generate TypeScript file
const output = `// AUTO-GENERATED - DO NOT EDIT
// Run: npm run i18n:types
// Generated: ${new Date().toISOString()}
// Keys: ${keys.length}

import enMessages from "../../../../messages/en.json";

/** All valid translation keys (${keys.length} keys) */
export type TranslationKey = keyof typeof enMessages;

/** Type-safe message lookup */
export type Messages = typeof enMessages;

/** Check if a key exists */
export function isValidKey(key: string): key is TranslationKey {
  return key in enMessages;
}
`;

fs.writeFileSync(outputPath, output);
console.log(`\n  Generated i18n types: ${keys.length} keys`);
console.log(`  Output: src/lib/shared/i18n/i18n-types.ts\n`);
