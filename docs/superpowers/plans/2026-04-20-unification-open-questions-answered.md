# Unification Plan — Open Questions, Decisions Committed

**Date:** 2026-04-20
**Context:** Austen delegated decision authority for autonomous execution. These are the commitments.

## Q1. esbuild config for `mcp-server-pkg`

**Decision:** Standard esbuild config.

- Entry: `src/index.ts`
- Outfile: `dist/index.js`
- Bundle: true, Platform: node, Format: esm, Target: node18
- External: `['canvas', '@resvg/resvg-js', '@modelcontextprotocol/sdk', 'zod']` (native/binary deps stay external)
- Sourcemap: inline (single shipped artifact, debuggable)
- Minify: false (MCP audits benefit from readable bundled output)
- `@tka/sequence-engine` intentionally NOT in external — bundled in

## Q2. Firestore migration batch size + backup path

**Decision:**
- Batch size: 500 (Firestore batched-write limit)
- Backup: use Firestore native export (`gcloud firestore export`) to `gs://tka-platform-backups/firestore/sequence-field-drop-YYYY-MM-DD/`
- Dry-run flag required; migration script prints counts per batch before any writes
- Revertible via `gcloud firestore import` from the backup

## Q3. Parity corpus selection

**Decision:** Confirmed as proposed:
- All deck sequences (complete enumerated corpus)
- Last 30 days of prod writes from Firestore
- 50 manually enumerated edge cases covering: period-4 non-rotated LOOPs (the original bug's neighborhood), high-turn sequences, float motion types, bridge-inserted sequences, REWOUND sequences, single-beat partials, level 7 (45° rotation) sequences
- Corpus IDs logged deterministically in `tests/parity/corpus-manifest.json`

## Q4. README/CHANGELOG sign-off

**Decision:** I draft initial versions following CLAUDE.md writing guidelines (no em dashes, no superlatives, specific not vague, "the fire jam test"). Austen reviews before publish-to-npm (Phase 7, which is anyway gated on his credentials). Drafts land in Phase 7 tasks; publish gate is explicit user approval.

## Q5. Public API scope for `@tka/domain` and `@tka/render-core`

**Decision:** Conservative start.

**`@tka/domain` exports (0.1.0):**
- Letter enum + letter mapping data
- Letter type classifications (Type 1-6)
- Position data (alpha/beta/gamma, numbering, mirror pairs)
- Grid location/mode enums
- LOOP type enum + labels + descriptions
- Compound letter definitions
- Read-only getter functions (no setters — this is reference data)

**`@tka/render-core` exports (0.1.0):**
- Arrow position calculation (cascading tier system — the canonical one)
- Prop geometry math (center points, dimensions, rotation offsets)
- Grid point coordinates
- Motion-to-arrow mapping utilities
- Pure calculation functions only; no DOM, no SVG string assembly (that's render-composition's job)

Non-exports kept internal: curriculum progression, experimental analyzers, beam-search internals.

## Q6. Extend flow entry point

**Decision:** `SequenceExtender` at `src/lib/features/create/shared/services/implementations/SequenceExtender.ts` is the rewire target. The `packages/sequence-engine/dist/loop/extension/SequenceExtender.js` seen by the plan agent is a stale built artifact from a prior copy; not the authoritative source. Phase 3's "rewire SequenceExtender" targets the app-side file, which currently calls app-side `Strict*LOOPExecutor` classes. Post-Phase 3, it calls engine's `executeLOOP` directly.
