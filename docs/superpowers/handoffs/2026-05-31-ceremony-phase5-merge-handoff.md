# Ceremony Phase 5 (stateless → module functions) — Merge Handoff

Branch `ceremony/stateless-phase5` in this isolated clone (`E:\tka-platform-ceremony`).
`origin` = `E:\tka-platform`. Work was done here so HMR never stormed your :5173.

**Do NOT merge while other agents are working main.** Land it when main is idle.

## What's on the branch

Two infra commits + five class→module-function conversions, each green-gated
(svelte-check error count held at the **baseline of 17 errors / 29 warnings** —
identical to main, i.e. zero new errors). The branch was rebased onto current
`origin/main` after the conversions, so it sits directly on top of main with no
file conflicts (the 59 files of upstream churn during this work touched none of
the 13 files these conversions edit).

| Commit | What |
|---|---|
| `docs(ceremony)` ×2 | Spec + plan under `docs/superpowers/specs|plans/2026-05-31-ceremony-phase5-*` |
| `fix(ceremony): inventory…` | Repaired `scripts/ceremony-inventory.mjs` — it classified by PascalCase *filename* and the May flatten kebab-renamed the files, so it saw 12 candidates instead of 111. Now indexes all `/services/` .ts. |
| `chore(ceremony): record baseline` | Baseline capture |
| MuseumGridBuilder | class → `buildMuseumGrid()` module (public build merged into the function the consumer already called) |
| ArchiveLoaderImpl | eager singleton → `loadAllArchived()` |
| CellCacheKeyDeriver | injected-dep singleton → `deriveCacheKey()` (imports the shared hasher instead of injecting it); key output byte-identical → no cache invalidation |
| MultiFilter | → `applyFilters` / `getFilteredCount`; **getter `getMultiFilter.ts` deleted** |
| BrowseSectionManager | 492-line class → 15 module functions; **getter `getBrowseSectionManager.ts` deleted** |

## How to land

```bash
cd E:\tka-platform                       # your main repo
git fetch E:\tka-platform-ceremony ceremony/stateless-phase5
git log --oneline FETCH_HEAD             # eyeball the 8 commits
# fast-forward or rebase-merge onto main when idle:
git merge --ff-only FETCH_HEAD           # if main hasn't moved since the rebase
#   …or if main moved:
git rebase --onto main origin/main FETCH_HEAD && git merge --ff-only -
npm run check                            # confirm still 17 errors / 29 warnings
```

If `--ff-only` refuses (main advanced), cherry-pick the 6 non-doc commits or
re-rebase the branch onto the new main here in the clone first, then merge.

## Scope reality (important — the "~80 safe" estimate was wrong)

The `phase5-shape.cjs` "SAFE" set is **contaminated with dead code** — it marks a
class SAFE when nothing `new`s/type-refs it, but some are SAFE *because nothing
uses them at all*. Use `scripts/phase5-livecheck.cjs` (live import/getter probe)
to separate live from dead. The genuinely clean-and-live convertible set is
**~6–10, not ~80**. Five are now done; the rest is the hard tail.

**Convertibility is decided by consumption shape, not the stateless label:**

- **Pattern B — `export const x = new X()` in the class's own file** → cleanest.
  Already runs at module load on server+client, no guard, zero behavior change.
  (ArchiveLoaderImpl, CellCacheKeyDeriver.)
- **Pattern A — separate `getXxx.ts` lazy singleton** → usually wraps an
  `if (!browser) throw` SSR guard. **svelte-check does NOT catch a dropped
  runtime guard.** Drop it only when the class is pure logic (no DOM/window/
  Firestore) AND has no SSR call site. (MultiFilter, BrowseSectionManager —
  pure, defensive guard, client-only browse engine → safe to drop.)

## Deferred — do NOT blind-convert (each would be real damage)

- **Dead code** (flag for a separate deletion pass, don't convert): `AsciiRenderer`
  (ScribeSpell uses sibling `BrailleHybridRenderer`), `TopologyBetaSeparator`,
  `TopologyPropLoader`, `TunnelModeSequenceManager` — zero imports / zero `new`.
- **Load-bearing browser guard:** `SheetRouter` (heavy `window.location` /
  `addEventListener`), `UserDocumentManager` (auth + Firestore writes; `authState`
  is SSR-sensitive). Guard is real; needs guard preserved inside the functions or
  proof of no SSR caller.
- **Polymorphic / inheritance:** `FeedbackTesterWorkflowService` (`implements
  IFeedbackTesterWorkflow`), `EraRendererBase` (extended by subclasses), the 17
  `*LOOPExecutor` family (`implements ILOOPExecutor` strategy pattern).
- **Sensitive:** `RenderContextRegistry` (memory-flagged load-bearing async init,
  export-resize + trail reset) — convert only with runtime verification.
- **Co-located:** `MemoryUrlCache` (defined inside `ThumbnailRenderOrchestrator.ts`).
- **Multi-instance (real objects, keep as class):** MandalaGeometryCalculator,
  PixelRenderer, RenderContextFactory, SvgImageCache, CommandDispatcher,
  VoiceSessionReplayer, SvgToBrailleConverter.

## Still pending (not started)

- **Phase 3:** ~10 type-only interfaces → `types.ts`, drop `I` prefix.
- **Phase C:** kebab-rename the ~173 residual PascalCase `.ts` (incl.
  `BrowseSectionManager.ts`) via a re-runnable codemod.
- **Dead-code deletion pass** for the four dead classes above.

Phase 6 (getter return-types) is intentionally out of scope.
