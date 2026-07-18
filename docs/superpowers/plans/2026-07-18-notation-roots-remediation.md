# Notation / Roots Remediation Completion Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Finish the notation/roots redesign at audit quality, preserve unrelated worktree edits, and merge the verified branch into `main`.

**Architecture:** Keep `/notation` as the canonical public lineage page, retain `/roots/software` as a separately linked public page, and keep `/roots` as a server redirect. Historical copy and diagrams stay source-backed. Route registries, preview tooling, screenshot tooling, and generated metadata move together so the public information architecture has no stale Roots entry.

**Tech Stack:** Svelte 5, SvelteKit, TypeScript, Vitest source-contract tests, Prettier.

---

### Task 1: Reconcile and lock the audited content

**Files:**

- Modify: `src/routes/(public)/notation/+page.svelte`
- Modify: `tests/unit/notation-qft-diagram-contract.test.ts`
- Create: `tests/unit/notation-roots-remediation-contract.test.ts`

1. Compare each audit finding with the current page and remove any remaining unsupported hierarchy, exclusivity, or lineage claim.
2. Make the Shape Matrix figure visibly communicate its two twelve-style axes without importing the lab's interactive renderer.
3. Add source-contract coverage for QFT numbering, bounded peer framing, the 144-cell matrix, real PoiNotation operators, and the software-lineage link.
4. Run the two contract test files and keep them green.

### Task 2: Verify route and tooling migration

**Files:**

- Verify/modify: `src/config/domains.ts`
- Verify/modify: `src/routes/+layout.svelte`
- Verify/modify: `src/lib/features/landing-preview/LandingPreviewModule.svelte`
- Verify/modify: `src/lib/features/lab/services/screenshot-orchestrator.ts`
- Verify/modify: `tests/screenshots/devices.ts`
- Verify/modify: `src/routes/sitemap.xml/+server.ts`
- Verify/modify: `src/routes/(public)/roots/software/+page.svelte`
- Verify/modify: `scripts/component-manifest.json`

1. Confirm `/roots` redirects to `/notation`, while `/roots/software` remains in landing mode and receives marketing chrome.
2. Confirm Notation replaces Roots in preview and screenshot registries.
3. Confirm the sitemap and software-page breadcrumb labels match the new canonical route.
4. Add these invariants to the remediation contract test.

### Task 3: Scope and format the change set

**Files:** Only notation/roots implementation, migration tooling, shared editorial styles, audit documentation, and their tests.

1. Identify functional edits in every staged and unstaged file.
2. Leave unrelated Option Picker, Poi Lab, and other concurrent edits untouched and unstaged.
3. Run Prettier only on in-scope source and test files.
4. Regenerate or minimally update generated metadata using the repository's canonical mechanism; do not commit formatting-only churn unrelated to this feature.
5. Run `git diff --check` and inspect the exact staged diff.

### Task 4: Full verification

1. Run the targeted notation/SEO test set.
2. Run `npm run check` and require zero errors and zero warnings.
3. Run the production build. Resolve in-scope failures; document any proven external blocker.
4. Run AI-copy and audit checks against the final page source.

### Task 5: Commit and merge

1. Review the final staged file list and diff summary.
2. Commit the notation/roots redesign and remediation with an intentional message.
3. Inspect the `main` worktree for conflicting local changes.
4. Merge `feat/notation-roots-merge` into `main` without discarding unrelated work.
5. Verify the resulting `main` history and working-tree state.
