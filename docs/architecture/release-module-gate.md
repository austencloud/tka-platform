# ADR: Release Module Gate

**Date:** 2026-07-12
**Status:** Accepted
**Related:** `scripts/lib/release-module-gate.mjs`, `scripts/release.js`,
`tests/unit/release-module-gate.test.ts`, memory `project_release_module_gating`

## Context

Every release, commits belonging to modules that are not yet live (Learn/Play,
the Guide, Mandala, Train) leaked into the user-facing changelog and had to be
hand-caught by eye ("don't ship that, Learn isn't live yet"). Austen floated
per-module release notes; that was judged heavier than the problem and mostly
churn no user reads.

The lean win: the release script already had a source of truth for what's
live — `PRODUCTION_MODULES` in `src/lib/shared/environment/environment-features.ts`
— but `release.js` git-history mode only ever parsed commit *subjects*, never
which module a commit belonged to. So it couldn't tell a dark-module commit from
a live one.

## Decision

A pure module, `scripts/lib/release-module-gate.mjs`, classifies each commit's
release visibility and `release.js` reports/optionally-drops the dark ones in
git-history mode.

**Resolution order (per commit):**

1. **Dark denylist** (`DARK_DENYLIST`) — hand-maintained list for sub-features
   that are dark even though their module is live. `PRODUCTION_MODULES` can't
   express sub-feature gates. Seeded with the shop LOOP deck listing (matched by
   subject `/LOOP (deck|listing|configurator|…)/i` + path
   `src/lib/features/store/LoopDeck*`). Add a block when a new dark sub-feature
   appears; delete it the day it ships.
2. **Commit scope** (authoritative intent) — `feat(play):` → alias table →
   `learn`. `SCOPE_TO_MODULE` holds only mismatches (the learn family:
   play/guide/quiz/codex/…; `store` → `shop`). A scope that is itself a
   `ModuleId` resolves directly.
3. **File fallback** — only when scope names no module. Resolves to the SINGLE
   feature dir the commit owns, or `null` when cross-cutting: touches
   `src/lib/shared/` (infra that serves live surfaces) or spans more than one
   feature module. This is deliberate — an earlier version that gated on a lone
   feature dir wrongly flagged the live Share/Download export sweep (scope
   `export`, files in `mandala`/`video` + shared) as dark.

**Gating outcome** (`released`): `false` = behind a dark flag (module gated, or
denylist hit) → flagged; `true` = module live → shown; `null` = unresolved /
shared / cross-cutting → shown. Only what we are confident is dark is withheld.

**Integration:** in `release.js` git-history mode, after
`generateChangelogFromGitHistory()`. Default is **advisory** — prints a
"🚧 Behind a dark flag" report grouped by reason (visible in `--dry-run`, which
is where the changelog is drafted). The **`--auto-gate`** flag drops flagged
entries from the changelog before display. Feedback-mode releases are not gated
(no commit→module data).

## Consequences

- **Caught, on real data:** across `v0.28.0..HEAD`, 65 genuine leaks flagged
  (38 learn = play/guide, 21 shop LOOP, 4 mandala, 1 train, 1 admin) with the
  live Share/Download export sweep correctly shown.
- Single source of truth: flip a module live in `environment-features.ts` and
  the gate follows — no second list to maintain.
- The alias and denylist tables are hand-maintained by design: small, greppable,
  one line per addition. This is the accepted cost of not building sub-feature
  flag introspection (no central registry to read).
- Scope discipline is load-bearing. The gate leans on the project's strong
  conventional-commit scopes; a mis-scoped commit resolves via files or falls to
  `null` (shown) — a miss degrades to today's manual catch, never a wrong drop
  of a live change (unless `--auto-gate` is used on a genuinely mis-resolved
  commit, which the advisory default exists to prevent).

## Not done (YAGNI)

- Sub-feature flag introspection — the manual denylist covers that class.
- Gating feedback-mode releases.
- Per-module release notes.
