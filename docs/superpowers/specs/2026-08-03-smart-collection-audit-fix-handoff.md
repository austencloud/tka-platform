# Smart Collection Audit Fix Pass — Handoff (2026-08-03)

## Mission

Finish the Smart Collection composer so no user thinks "huh, weird" at any
viewport (per the [2026-08-02 handoff](2026-08-02-smart-collection-responsive-composer-audit-handoff.md)
and the [Smart Collections design](shipped/2026-07-06-smart-collections-design.md)).
This session ran the required cold audit (four read-only Opus partitions over
`https://localhost:5173/test/smart-collections`), reconciled 60+ findings into
one ledger, and landed the first three fix batches. The ledger is the working
document and the source of truth for what remains:
[2026-08-03-smart-collection-cold-audit-findings.md](2026-08-03-smart-collection-cold-audit-findings.md).

## Done — verified

Everything below is in commit **`648c96b245`** on `main`, pushed to origin
(13 files, +3737/−747 — this commit also lands the PREVIOUS session's
uncommitted redesign, since the fixes are inseparable from it). Full
`svelte-check` was 0 errors / 0 warnings immediately before the commit
(exit 0, log tail "svelte-check found 0 errors and 0 warnings").

Per-finding evidence (measurements, screenshot filenames, probe outputs) is
recorded inline in the ledger's `[x]` entries. Highlights with their proof:

- **Audit ran, four partitions** — reports in this session's transcript;
  ~340 evidence frames under the session scratchpad `audit-*` dirs.
- **A1 footer contradiction** — 960×412 screenshot shows the "LOOPs stack"
  hint AND the new "LOOPs apply as you tap them" footer coexisting.
- **A2 selected-state on re-entry** — probe: `builder-refine/filter-level`
  renders Level 2 `aria-pressed=true` + accent ring.
- **A3 focus** — probe: after tile activation and after Back,
  `document.activeElement` is the incoming screen's `h2` (lands ~500ms in).
- **A4/F-1 phantom tab stops REFUTED** — behavioral sweep at real 820px:
  0 of 11 zero-sized controls accepted focus (display:none ancestor).
- **A3b/F-3 missing dialog REFUTED** — builder renders `<dialog open>` with
  `aria-labelledby="smart-builder-title"`.
- **B3 stable sets** — probe at 1920: selecting Mirrored+Swapped keeps all
  7 LOOP options (zero-count ones disabled at count 0) and all 10 catalog
  tiles (Grid mode disabled, not unmounted).
- **B5/B6 rule strip + split chips** — screenshot at 1920 shows
  "31 matches | Mirrored | Swapped" strip; probe: chip bodies are labeled
  "Edit X filter", × segments "Remove X filter", and body click reopens the
  picker on that filter's editor.
- **C1 scale tiers** — measured at 4224×2376 (real 3840): Length cards
  163×224 → 276×384, dead band above the grid 800 → 81px, grid-mode art
  144 → 265px, heading 32px, numerals 80px; at 2816×1584 (real 2560)
  position pictographs 179px. 1920/1440 untouched (height-gated).
- **C3 compact half** — screenshots: 412×960 shows rule (254px) stacked
  over a 564px inline result pane; 960×412 shows the rule column (384px)
  beside a live 3-col result grid with all 5 matches.
- **A7/A8/A9/A10/D6/D7/D11 etc.** — each verified by probe or screenshot,
  recorded in the ledger entry.

## Believed done — unverified

- **B1 counting gate** (`countSettled` in SmartCollectionBuilderSheet):
  implemented and type-checked, but no cold-cache trace proves the X-1
  timeline is gone. Handoff loose end #4 (cold/warm/offline profiling) is
  still fully open.
- **The final all-viewport composition sweep after the last CSS batch.** My
  verification was per-fix. Nobody has re-run the full 10-viewport × 7-step
  matrix on top of the final state. Screenshots at 1440 and full-frame 4K
  composition (not just geometry probes) are owed — 4K/2560 full-page
  `Page.captureScreenshot` kept timing out (see Gotchas).
- **Other GalleryDrill consumers** (handoff loose end #9): the page-variant
  gallery front door and filter sheet share the edited base CSS/snippets. My
  changes were gated on `unifiedFilterChooser`/`onToggle*`/persistent-catalog
  flags, and repo-wide svelte-check is green, but no visual smoke test of the
  main gallery drill was done.

## In flight

- Branch `main`, commit `648c96b245` pushed. Working tree still carries many
  UNRELATED other-session edits (museum, agent-hub, mcp-server, etc.) —
  preserve them; commit only with explicit pathspecs.
- The workbench route and review localStorage state are unchanged
  (`tka-smart-collection-review-v1`; formal gate still 1/7 approved).

## Loose ends (ranked)

1. **C4 — grid intentionality at fold/tablet/phone** (ledger C4, all still
   open): Length wraps 2/3/2 at 820; Start position portrait uses half-empty
   list rows while 832×750's 3-up grid is right (F-5); Level/Grid-mode inset
   their band and drag Back inward (F-10); T&D 2-col at 820 breaks Same/Opp
   row taxonomy (F-13); Length centers orphan rows while Letters left-aligns
   (F-16); letter final-row centering hardcoded to 46 letters (C-11); 375 vs
   412 flip interaction patterns entirely (C-3). All are CSS-tier work in
   `GalleryDrill.svelte`; verify at 750×832 / 832×750 / 820×1180 / 375 / 412.
2. **BrowsePanel virtual-grid pass** (ledger C3-remaining): ragged
   unequal-height preview rows, desktop few-results dead-end, 5-in-4-col
   orphans, 832×750 card slicing. Shared browse-engine surgery — own pass,
   own verification, watch the main gallery for regressions.
3. **Phase D remainder**: D1 (white position plate), D2 (Box/Diamond dot
   style+contrast — in GridSvg), D3 (unlabeled density bar), D4 (applied
   state in "Add a filter" chooser subtitles), D8 (Tog/Opp expansion —
   app-wide chip ripple, needs a scoped decision), D12 (preview a11y
   pollution: word-glyph images not aria-hidden, "Saving to cloud" live
   regions), D13 (Step 7 skeleton), D14–D19.
4. **R rulings for Austen**: R1 variation pill inside "Preview only" (kept),
   R2 "Looks in Community" fact line (kept), R3 composition swap on first
   selection (kept), R4 Level 1/2/3 only (verify against MCP).
5. **Handoff loose ends #3/#4 from 2026-08-02** still open: full production
   interaction walk INCLUDING a real save (stopped at the button — no
   Firestore writes were made), and loading/prewarm profiling.
6. **W items**: workbench settle signal (W1), fixture stages hug content
   (W2), `start-recent` variant (W3).
7. **A5** grid-SVG `<style>` leak — routed to the pictograph pipeline owner
   (see ledger note).

## Decisions already made

All of the 2026-08-02 handoff's "Decisions already made" stand. New ones
established this session (from the audit evidence, consistent with Austen's
recorded direction):

- The desktop editor column stays width-capped (Austen 2026-08-02: extra
  width belongs to results). Large-display scaling is HEIGHT-keyed inside
  the capped pane (`@media (min-height: 1150px/1900px)` + container ≥1200px
  at the end of GalleryDrill's styles) — do not convert it to cqw tiers;
  the drill container never exceeds ~1663px at 4K by design.
- Options and category tiles never unmount mid-session in the builder; they
  dim with an explanation (presence latch + disabled states).
- Chip body = edit, × = remove (FilterChipBase `onremove` split extension).
- Compact Step 3 shows results inline; the "Preview N" full-screen mode
  remains as a secondary door.

## Gotchas

- **Chrome page zoom is 110% for localhost**: emulate at nominal × 1.1 and
  verify `innerWidth` (e.g. 2112×1188 → 1920×1080). All audit partitions and
  this session's probes did this.
- **`Page.captureScreenshot` times out (>120s) once the live preview holds
  ~90 canvases**, especially after big-viewport emulation; a page can get
  permanently wedged — close the tab and open a fresh one (that fixed it
  here). Element-scoped shots and `evaluate_script` geometry keep working.
  This is also audit finding D-25 (a real perf smell worth a trace).
- **Fixture frames** (`?frame=1&surface=…&variant=…`) mount the real tree at
  1:1 — use them, not the scaled workbench iframe. Wait for the modal enter
  transition (~1–2s) before measuring; early probes read ~8% small.
- **getComputedStyle inside display:none subtrees returns specified values**
  — this manufactured the false F-1 "phantom tab stops" blocker. Always
  verify focusability behaviorally.
- **When walking CSSOM, `rule.cssRules` is a truthy empty list on every
  style rule in modern Chrome** — recurse on `.length`, or every plain rule
  is silently skipped.
- **`:global()` in Svelte takes exactly one selector** — a comma inside it
  is a compile error that takes the whole route down.
- The dense-rule fixture applies Level 2 only, so `filter-length` re-entry
  legitimately shows no applied length; use `filter-level` to see A2's
  selected state.
- Facet counts for values of the SAME category correctly exclude that
  category's own filter — don't re-file audit finding C-6's count half.
- Port 5173 is Austen's HTTPS/2 dev server: never restart it; `https://`
  only.
