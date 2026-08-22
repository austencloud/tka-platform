#!/usr/bin/env node
/**
 * Retired parity-unsafe entry point.
 *
 * The former implementation hand-built `publicSequences` documents without
 * updating the owner record, content-hash claim, or projection stamps. That
 * can create exactly the parity incident this script was meant to repair.
 * Keep this fail-closed shim so old notes and shell history point operators to
 * the canonical migration instead of silently reintroducing drift.
 */

console.error(`
This script is retired because direct publicSequences writes break parity.

Use the canonical targeted publisher instead:
  TKA_ADMIN=1 pnpm exec tsx scripts/migrations/publish-missing-public-mirrors.ts --target <ownerId>:<sequenceId>

For existing mismatches, use:
  TKA_ADMIN=1 pnpm exec tsx scripts/migrations/reconcile-sequence-public-projections.ts
`);

process.exit(1);
