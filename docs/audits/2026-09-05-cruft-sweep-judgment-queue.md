# Cruft sweep judgment queue - 2026-09-05

Branch: `codex/cruft-sweep`. Scope was `src/lib` only, using the owner's two
cruft signatures: (1) fake values that callers consume as real, (2) exports,
fields, services or components referenced nowhere in `src/`, `packages/`,
`mcp-server*`, `scripts/`, or routes.

Method: a whole-repo identifier census (11,131 files across `src`, `packages`,
`scripts`, `tests`, `mcp-server*`, `tka-feedback-mcp`, `functions`, `cloudflare`,
`tools`, `agent-hub`, including `.svelte`, `.json` and `.md`) flagged 3,814
`src/lib` exports whose only mentions are inside their own defining file. Every
removal in this branch was then re-verified by hand with `rg` on both the bare
filename and the symbol name, checking for `import(` dynamic imports and
string-keyed registries.

The items below were found but **not** removed. Each needs a product ruling,
is module-level, or sits on an active in-flight project.

## Feature-level dead islands (product ruling needed)

### `src/lib/shared/sync/` device sync is unwired end to end

`deviceSyncState` (`state/device-sync-state.svelte.ts:182`) and
`getDeviceSyncCoordinator()` (`get-device-sync-coordinator.ts`) have zero
references outside their own files. `DeviceSyncState.initialize(coordinator)`
is never called, so the coordinator is never constructed and the whole LAN
device-sync surface is unreachable from the app. Removing it means removing a
feature, which is Austen's call. Note `get-device-sync-coordinator.ts` also
pulls in `get-peer-connection-manager`, `get-adaptive-heartbeat`,
`get-message-batcher` and `get-mobile-connection-adapter`, so the dead subtree
is larger than one file.

### `src/lib/shared/video/` training-data-store + video-source-provider

`TrainingDataStore` (159 lines) and `VideoSourceProvider` (136 lines), plus
their getters `get-training-data-store.ts` / `get-video-source-provider.ts`,
are referenced only by each other. They look like scaffolding for the skel2tka
video pipeline, which is an active project, so deleting them could collide with
in-flight work.

### `src/lib/features/store/get-merch-checkout-creator.ts`

`getMerchCheckoutCreator()` has zero references. The underlying
`services/merch-checkout-creator.ts` is 21 lines. Shop unification is an
unpushed workstream where pushing equals production, so this was left alone to
avoid conflicting with that branch.

### `src/lib/shared/comparison/get-sequence-equivalence-detector.ts`

`getSequenceEquivalenceDetector()` has zero references, but the file carries a
long comment documenting a deliberate `browser`-guard removal and three known
defects in the canonicalizer hash it depends on. The `SequenceEquivalenceDetector`
class itself is also unreferenced. Deleting it would discard that documented
analysis, so it needs a decision on whether the detector is parked or abandoned.

## Parallel getter layer, mostly unused (convention question)

`src/lib/features/create/generate/circular/get-loop-executors.ts` defines 16
singleton getters. Only `getLOOPExecutorSelector()` is consumed outside the file
(`get-loop-validator.ts`, `get-sequence-extender.ts`). The other 15 are either
unused or only used to construct one another inside the file, because the real
consumers import the module-level `export const strictMirroredLOOPExecutor = new ...`
singletons from `services/*-loop-executor.ts` directly. That is a duplicated
instantiation path for TKA generation, not obvious cruft: the getters may be the
intended DI seam. Needs a call on which path is canonical before touching either.

## Deliberate stubs that are documented as such (leave alone unless re-scoped)

- `src/lib/features/learn/domain/concepts.ts:646` `isConceptUnlocked()` always
  returns `true` and ignores both arguments. The `TODO(learn-unlock)` comment
  says this is intentional so admins can review all content, and spells out how
  to re-enable prerequisite gating. This is signature (1) - a fake value that
  the Learn UI consumes as real - but it is a product decision, not cruft.
- `src/lib/features/skel2tka/services/training-data-persister.ts` no longer has
  the `syncToFirebase()` stub (removed on this branch), but the file header
  still describes Firebase sync as planned. Left as-is; it is now accurate that
  no sync surface exists.

## Honest-but-incomplete functions (low value, not removed)

- `src/lib/shared/application/state/app-state.svelte.ts:269` `resetAppState()`
  is exposed on `window` as a debug helper. It resets UI, initialization and
  metrics state, then logs `"resetToDefaults not implemented in SettingsState"`.
  It is a partial reset advertised as a full one, but it is a devtools-only
  global with no UI caller, so the fix is either to implement the settings reset
  or drop the debug global - both product calls.
- `src/lib/features/create/shared/services/create-module-event-handler.ts:259,264`
  export handlers carry `TODO: Implement actual export service call`. Needs a
  look at whether the export path is wired elsewhere before judging.
- `src/lib/features/learn/quiz/services/quiz-repo-manager.ts:84`
  `TODO: Load from actual lesson configuration files`. Same situation.

## Scale note

The 3,814-entry census is the raw candidate pool, not a removal list. A large
share of it is types and helpers used only within their own module, plus
`.svelte`-heavy directories (`shared/3d` alone accounts for 648 entries) where
the previous knip run's 50% false-positive rate came from. Anyone continuing
this work should keep verifying per symbol rather than trusting the census.
