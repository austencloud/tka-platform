# Viewer Shell Anti-Drift Guardrails — Design

**Date:** 2026-07-05
**Status:** Approved (Austen: "come up with and execute a really solid game plan")
**Context:** Follow-up to the SequenceViewerShell unification (commits `fcd3a516d8`, `5d3adfb542`)

## Problem

The /q scan page and the in-app sequence-viewer drawer drifted apart repeatedly:
hand-rolled headers, hardcoded theme palettes shadowing the theme pipeline, and
forked breakpoint/export-layout rules. The fix was extracting ALL viewer chrome
into one shared component, `SequenceViewerShell.svelte`, rendered by both hosts.
That makes the surfaces identical by construction — but nothing prevents a future
change from re-forking them. History shows it will happen without enforcement.

## Drift threat model

1. **Host rebuilds chrome.** A host adds its own header/rail/export markup
   instead of extending the shell (the original bug).
2. **Host CSS shadows theme vars.** A host declares `--theme-*` / `--semantic-*`
   custom properties locally, overriding the `:root` values set by
   `applyThemeForBackground()` for its whole subtree (the color-mismatch bug).
3. **Behavior forks.** A host adopts a different mobile breakpoint or layout
   rule than the drawer (the 960-vs-768 and export-narrow bugs).
4. **Third-surface divergence.** `/sequence/[id]` still hand-assembles viewer
   chrome from internals (pre-shell legacy). Extending it entrenches a fork.

## Decision

Apply the codebase's proven consolidation-defense playbook (chip-primitives,
crossfade-primitive): **rule + ADR + CI contract test.**

### Components

1. **`.claude/rules/sequence-viewer-shell.md`** — always-loaded ENFORCED rule.
   Names the shell canonical, defines the host contract (thin hosts, deltas via
   props), forbids host-side chrome and theme-var declarations, and routes
   `/sequence/[id]` work toward migration instead of extension.

2. **`tests/unit/sequence-viewer-shell-contract.test.ts`** — static source
   contract test. Reads host sources with `fs`, asserts:
   - both hosts render `<SequenceViewerShell`
   - neither host declares `--theme-*` / `--semantic-*` custom properties
     (usage via `var()` remains allowed)
   - neither host imports chrome internals (ViewerHeader, ViewerSplitPane,
     ViewerOverflowMenu, ExportImagePanel, VideoPreviewPanel, PracticeBar,
     PracticeSetupBar, DeleteConfirmDialog, viewer-actions)
   - both hosts use the shared `< 768` mobile breakpoint
   - no host contains shell-owned markup markers (`drawer-header`,
     `viewer-and-export`)

   Lives in `tests/unit/` because the default vitest config only includes
   `tests/unit/**`, `tests/integration/**`, `tests/debug/**`,
   `src/**/__tests__/**`, and the prop-tracking-lab — a colocated file next to
   the components would never run in CI.

3. **`docs/architecture/sequence-viewer-shell.md`** — ADR documenting what the
   shell owns, the host contract, the extension pattern, and the
   `/sequence/[id]` gap.

4. **Move `viewer-actions.test.ts` → `tests/unit/`.** Discovered during design:
   the file sat outside every vitest `include` glob, so its three
   header-actions tests never ran in CI. (~80 other colocated src tests share
   this problem — out of scope here, flagged for a separate pass.)

### Rejected alternatives

- **Screenshot-diff parity CI job.** Flaky, expensive, and violates
  `component-test-discipline` (don't widen the browser-test layer for its own
  sake). The shell already guarantees identity by construction; a runtime pixel
  diff would mostly test the toolchain.
- **Migrating `/sequence/[id]` to the shell now.** Correct end state, wrong
  moment — that route carries fullscreen controls, LAN sync, and handoff logic;
  it is its own project. The rule requires migration on the next substantial
  viewer change there and forbids extending its legacy chrome meanwhile.
- **Memory entry.** The rule file is checked in and always loaded; a memory
  duplicate would violate the don't-record-what-the-repo-records principle.

## Success criteria

- Contract test passes today and fails if any of the five assertions break.
- Rule file loads in every future session (lives in `.claude/rules/`).
- `npm run test -- --run tests/unit/viewer-actions.test.ts` executes 3 tests.
