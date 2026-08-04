# Unified Filter Workspace — Handoff (2026-08-04)

## Mission

Two-stage implementation, both stages designed and approved:

1. **Connective work** — Match any / Match all in the LOOPs/T&D editors +
   grouped rule-strip sentence + saved-spec migration (the Smart Collection
   builder's last open interaction problem: the same tap widens in six
   categories but narrows in LOOPs/T&D).
2. **Unified filter workspace** — the builder's filter interaction layer
   becomes THE filter workspace for the main gallery (and every browse
   surface), per the approved spec:
   [2026-08-04-unified-filter-workspace-design.md](2026-08-04-unified-filter-workspace-design.md).

Stage 1 blocks stage 2 (the gallery must inherit settled semantics and the
final strip — never build the strip twice). Parent context: the 2026-08-03
audit/fix arc, ledger and prior handoff in
[2026-08-03-smart-collection-audit-fix-handoff.md](2026-08-03-smart-collection-audit-fix-handoff.md).

## Done — verified

- **Dense length catalog fix** — commit `0d5cf46069` on `main`, pushed.
  Dropping the ≥3 noise floor had grown the builder's Length editor to
  ~15–19 values, past every count-keyed `:has(nth-child(5/7))` composition;
  fallback was two giant monument columns (desktop) and a forced
  one-per-row `!important` column (tall phones) — scrolling at every mobile
  viewport. Fix: `dense` class past 8 values → compact flex-wrapped chips,
  pinned per-row counts per tier, height-keyed growth at the C1 seams
  (1150/1900px), 44px rows under 520px height, tall-phone block scoped to
  `:not(.dense)`. Evidence: DevTools geometry probes at
  3840/2560/1920/1440/820×1180/750×832/960×412/412×960/375×667 all report
  0 drill-screen overflow (probe outputs in the 2026-08-03→04 session);
  screenshots read clean at 1440 (6/6/3), tablet (5/5/5), fold landscape
  (44px rows), Cover P + iPhone SE (4/4/4/3). `svelte-check` exit 0,
  "0 errors and 0 warnings".
- **All ten builder screens fit at Cover P** — probes at 412×960 (emulated
  453×1056 for the 110% zoom) on every fixture variant (`filter-chooser`,
  `-level`, `-length`, `-letter`, `-position`, `-gridmode`, `-loop`,
  `-author`, `-family`, `-max_turn_intensity`): 0 overflow each. The
  "everything scrolls on mobile" report was Length alone.
- **Unified filter workspace spec** — commit `c6444e1bb1`, pushed.
  Brainstormed with Austen 2026-08-04, all decisions recorded in the spec's
  decisions log.
- **Handoff doc bookkeeping** — `f3055c7711` updated the 2026-08-03 handoff
  with the dense-length fix.

## Believed done — unverified

Nothing new from this session. Inherited unverified items from the
2026-08-03 handoff still stand (B1 counting gate cold-cache trace, final
all-viewport composition sweep of the last CSS batch, main-gallery visual
smoke test of the shared base CSS).

## In flight

Nothing uncommitted from this work. The working tree carries many
UNRELATED other-session edits (shop hero, museum, scripts, tests) —
preserve them; commit only with explicit pathspecs. Branch: `main`;
other sessions commit to it continuously — fetch before starting.

## Loose ends (ranked)

1. **Build the connective work (stage 1).** Design was proposed to Austen
   2026-08-03 and is now implicitly approved by the 2026-08-04 spec (its
   sequencing section assumes all three parts):
   (a) rule strip + receipt become a grouped sentence with visible
   connectives — "Start: Alpha or Beta · Level: 1 or 2 · LOOPs: Mirrored
   and Swapped" — replacing the flat chip row;
   (b) LOOPs and T&D editors get a two-option SegmentedControl
   "Match any | Match all", defaulting to **Match any**, so stacking widens
   by default in all eight categories and AND is an explicit labeled opt-in;
   (c) the connective is stored in SmartFilterSpec; EXISTING saved specs
   with multiple LOOP/T&D entries default to "all" on load (their meaning
   when saved) — small spec-model migration. If any implementation reality
   contradicts (b)'s default or (c)'s migration, surface to Austen rather
   than improvising. Key files: `SmartCollectionBuilderSheet.svelte`,
   `src/lib/shared/browse/services/multi-filter.ts`
   (`OR_STACKING_TYPES`), the SmartFilterSpec model +
   `smart-filter-spec.test.ts`, `GalleryDrill.svelte` (strip render).
2. **Then write the implementation plan for the unified workspace spec**
   (superpowers:writing-plans) and execute it. The spec is the authority;
   its architecture rule "each converted screen's page-mode CSS fork is
   deleted in the same phase" is the guard against a three-mode
   GalleryDrill — do not defer deletions.
3. **Inherited from 2026-08-03 (still open, now partly folded into the
   spec):** main-gallery OR side-effect smoke test (chip bar,
   persisted-filter reload, counts — becomes the spec's migration check);
   C4 grid intentionality remainders; BrowsePanel sparse-results pass
   (promoted to fast-follow by the spec); Phase D remainder; R rulings;
   production save walk; workbench W items.

## Decisions already made

All decisions in the spec's decisions log (Austen, 2026-08-04): in-page
workspace, complete option sets with dimmed zeros everywhere, connective
first, Save-as-Smart-Collection strip affordance, AddSequencesSheet
converts in the same project, GalleryFilterSheet phone fate settled by
feel during verification (desktop retires). Plus, from 2026-08-03: the
desktop editor column stays width-capped (height-keyed scaling); options
never unmount mid-session; chip body = edit, × = remove; Length dense
chips stay dense (numerals have no art) but other value screens KEEP their
art — unify layout math only.

## Gotchas

All gotchas in the 2026-08-03 handoff apply verbatim (110% localhost zoom →
emulate ×1.1 and verify `innerWidth`; fixture frames
`?frame=1&surface=builder-refine&variant=filter-*` mount the real tree but
need ~1.5–2.5s settle after the modal enter transition; cold page load
takes 10–30s before `.value-list` exists — poll, don't assume wedged;
full-page `Page.captureScreenshot` can wedge a tab holding ~90 preview
canvases — close the tab, don't retry; `:global()` takes exactly one
selector; port 5173 is Austen's HTTPS/2 server, never restart). New from
this session:

- `GalleryDrill.svelte` base `.value-list` is a **flex column**; a dense/
  compact override that sets `display: flex` must also set
  `flex-flow: row wrap` or items stack in wrapped columns (this bit me).
- The `@media (max-width: 480px) and (min-height: 820px)` tall-phone block
  uses `!important` on the length list; it is now scoped to
  `:not(.dense)`. Any new list mode must account for it the same way.
- The dense section lives at the very END of GalleryDrill's `<style>` and
  wins by specificity + order; inserting rules after it re-opens the
  cascade fight.
- Flex-wrap + `justify-content: center` self-centers any partial final row
  — prefer it over `:has(nth-child(N))` count-keyed grids for
  data-driven option lists. The count-keyed compositions are exactly what
  broke when the catalog grew.
- `tests/unit/browse/founding-collections.test.ts` fails at import time
  (protobufjs env issue), pre-existing, unrelated.
