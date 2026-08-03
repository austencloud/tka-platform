# Guide Card Stage — Handoff (2026-07-15)

**For:** the next agent picking up the Level-1 guide "card stage" work.
**From:** the session that built the rollout + the dark-card / aside-layout fixes.
**Status:** feature built and mostly committed; **two fixes from this turn are
UNCOMMITTED and need review + a scoped commit.** Nothing here is blocked.

> Read this whole file first. Then read the memory topic
> `C:\Users\Austen\.claude\projects\E--tka-platform\memory\project_guide_card_stage.md`
> — it holds the durable policies; this file is the point-in-time state + next steps.

---

## 1. What the feature is

The Level-1 guide's crawlable **flow view** (`/guide/level-1/<slug>`, rendered by
`FlowFrame.svelte`) shows genuine WORD SEQUENCES as hybrid **card stages**: a live
2D animation canvas (`InlineAnimationPlayer`) stacked above a vertical
hold-in-hand **ChoreoCard** of the same sequence, ringed in the sequence-viewer's
gold playback glow while in view.

- Component: `src/routes/(public)/guide/level-1/_components/GuideCardStage.svelte`
- Host/grouper: `src/routes/(public)/guide/level-1/_components/FlowFrame.svelte`
- Card: `src/lib/features/choreo-card/components/ChoreoCard.svelte`

SEO is load-bearing: each stage keeps a prerendered `sr-only`
`describePictograph` block so the per-pictograph notation stays in SSR HTML for
crawlers + assistive tech. **Never drop the sr-only block.**

---

## 2. Current git state — READ CAREFULLY

The bulk of the rollout is **committed** in `6205705f00`
(*"feat(guide): render guide sequences as live ChoreoCard stages"* — 23 files:
all 17 carded content files, GuideCardStage, FlowFrame, GuidePageHost,
guide-content-blocks.ts, guide.css, ChoreoCard). Note: that commit was made by a
parallel session, not by this one.

**UNCOMMITTED — the two fixes made this turn (verify, then commit with a scoped
pathspec when Austen says so):**

```
 M src/lib/features/choreo-card/components/ChoreoCard.svelte          # lightMode override prop
 M src/routes/(public)/guide/level-1/_components/FlowFrame.svelte      # auto-aside grouping + solo row
 M src/routes/(public)/guide/level-1/_components/GuideCardStage.svelte # cardMode + lightMode=false + transparent bg
```

Commit them (only when asked) with an explicit pathspec — the index is shared
across parallel sessions (see `.claude/rules/commit-only-your-own-changes.md`):

```bash
git commit -m "fix(guide): dark 5:7 card fill + auto-aside single cards" -- \
  src/lib/features/choreo-card/components/ChoreoCard.svelte \
  src/routes/\(public\)/guide/level-1/_components/FlowFrame.svelte \
  src/routes/\(public\)/guide/level-1/_components/GuideCardStage.svelte
```

**Do NOT run a bare `git commit`** (would sweep in other sessions' staged work).
**Do NOT commit anything until Austen asks** — his standing rule is that commits
are his call.

---

## 3. How it works (architecture)

### 3a. The routing rule — which sequences become cards

Genuine WORD sequence (a nameable word: AABB, ACAC, SOTR, LOOPs) → **card**.
Side-by-side letter **catalog** (`boxGroup`, captions like `"D · E · F — β→α"`),
motion/letter **atom**, or 2-step **demo** → stays a strip/figure.

Set on the content block: `card: true` on the `pictographGroup`. That's the ONLY
signal FlowFrame reads. `layout: "strip"` + `stepLabels` do NOT disqualify a card
(the card path overrides them — several carded pages carry both).

Card word is derived in `FlowFrame.groupSequence` from the strip's own step
letters, then `simplifyRepeatedWord` (SOTR×2 → SOTR, SSSS → S). Verify a card's
word via its `aria-label="View sequence <WORD>"`.

### 3b. Card render — MUST be dark 5:7 (this turn's fix)

`GuideCardStage` renders `<ChoreoCard cardMode={true} lightMode={false} …>`.

- **Why `cardMode`:** without it, ChoreoCard renders `variant="wordcard"`, whose
  natural aspect is ~1.2 (LANDSCAPE, e.g. 960×800). Forced into the 5:7 (0.714
  portrait) `.card-box` via `object-fit: contain` → **white letterbox bands** =
  the "white empty space behind the card" bug. `cardMode` makes the RENDER itself
  5:7 (960×1344) → fills the box exactly (no letterbox) AND gives the true
  vertical hold-in-hand card (the wordcard variant is landscape, can never be
  vertical).
- **Why `lightMode={false}`:** `cardMode` normally forces a light/paper card.
  ChoreoCard now has a `lightMode?` override prop:
  `const effectiveLightMode = lightModeProp ?? (printMode || cardMode)`. The guide
  passes `false` for a DARK card matching the dark canvas above it.
- `GuideCardStage .card-box` also zeroes ChoreoCard's paper-white background +
  light stroke via `:global` overrides so nothing white shows.

### 3c. Layout — automatic by run length (this turn's fix)

`FlowFrame.renderItems` groups blocks:

- **2+ consecutive cards → `.flow-card-row`** — breaks out to the route width
  (3-up+, USES 4K). Cards capped at 300px so a lone one never balloons.
- **a LONE card → `.flow-aside-group`** — card on one side, the section's text
  (its heading + preceding prose + any prose right after) beside it, as a ~60rem
  figure block. This fixed the "massive empty space / void" bug: a lone 300px
  card centred in the wide band left huge gutters. Aside fills the width with
  card + explanation.
- **lone card with NO nearby prose → `.flow-card-row.solo`** — card width,
  centred, no wide band.

`GuidePageHost.svelte` sets `container-type: inline-size` on `.guide-page-route`;
`guide.css` sets `.guide-content > .guide-page-route { grid-column: full }`
(desktop only, `@media (min-width: 769px)`) so the route spans full width and card
rows can break out with `cqw`. Prose stays narrow-centred.

---

## 4. Carded inventory (committed in 6205705f00)

17 content files, 50 card groups. All verified rendering + correct simplified
words + crawl blocks present.

- **LOOP/word pages (multi-card rows or asides):** words, examples-abc/acac/cccc,
  gamma-loops, type2-loops, prop-reversal-loops, full-reversal-loops,
  sixteen-count, eight-letter-words, permutations, misc-permutations.
  (`permutations` + `misc-permutations` are LOOP pages despite the name.)
- **Letter-word pages:** lt1-gamma-words (7), lt1-abc-ghi (6), lt1-dj-ek-fl (3),
  lt1-mp-nq-or-stuv (3), lt2-wxyz (2).

**Deliberately NOT carded (stay strips/figures):** reversals (2-step demos),
lt3-dash-letters, lt456-phi-psi-lambda, hm-* + staff-motions/hand-motions
(motion atoms), the-grid / hand-positions / staff-positions, base-letters,
codex/codex-2. The letter CATALOG groups on mixed pages (`D · E · F`, `boxGroup`)
also stay strips even while their sibling word-groups card. hm-type56's `word:`
fields are position transitions ("α → β"), not words → strips.

Un-carded files were audited for hidden word-sequences — none remain.

---

## 5. Verification (how to prove it's right)

Dev server: this session ran `vite --port 5176` (HTTPS). Austen's own dev server
is `:5173` — never touch it. Start your own free port if needed
(`vite --port 5174`), see `.claude/rules/fast-iteration-loop.md`.

**Type check** (capture once, grep the log — don't re-run to re-filter):
```bash
npm run check > /tmp/check.log 2>&1
```
Expect the guide-card files clean. **KNOWN UNRELATED FAILURE:** the gate currently
shows 2 errors in `src/lib/shared/pictograph/arrow/rendering/services/__tests__/arrow-svg-parser-half.test.ts`
(`'dims.center' is possibly 'undefined'`), committed by another session in
`795408d7f6` (halved-pictograph work). NOT part of this feature. Do not "fix" it
blind — it's orientation-sensitive domain work; flag it to Austen / that session.

**Browser runtime checks** (read-only `evaluate_script` — cheap, no screenshot):
- Card fills 5:7, no white: `.card-box img` `naturalWidth/naturalHeight ≈ 0.714`;
  card corner luma `< 30` (dark).
- Lone-card page is aside, no void: `.flow-aside-group` count > 0, `.flow-card-row`
  count 0, `document.documentElement.scrollWidth - innerWidth <= 0`.
- Multi-card page uses width: `.flow-card-row` width ≈ `min(90rem, 94cqw)`,
  3 `.card-stage` inside.
- Card word: `aria-label="View sequence <WORD>"`.

Representative pages: `/guide/level-1/permutations` (asides),
`/guide/level-1/gamma-loops` (3-up row), `/guide/level-1/lt1-dj-ek-fl`
(mixed: 3 word-card asides + 4 catalog strips).

Note: this session's Chrome-DevTools `resize_page` was stuck at the launch
viewport — could not re-measure at an emulated 4K. The breakout CSS was verified
at 2560 in an earlier session (routeW 906 → 2330). If you need a fresh 4K measure,
resize the actual debug-Chrome window.

---

## 6. Open items / next steps (in rough priority)

1. **Austen's visual pass on the fixes.** He was reviewing remotely; get his eyes
   on `/guide/level-1/permutations` (dark card + aside) before committing.
2. **Aside vertical balance (polish, optional).** The stage (square canvas +
   ~403px card) is ~700px tall; a short heading+prose beside it centres with
   vertical whitespace above/below. Acceptable as a figure, but if Austen wants it
   tighter: shrink/relocate the canvas in aside mode, or top-align
   (`align-items: flex-start`) instead of `center` in `.flow-aside-group`.
3. **Aside prose attribution (minor).** A lone card pulls its section's preceding
   heading+prose AND immediately-following prose. On a couple of pages
   (sixteen-count, lt1-dj-ek-fl) a card may grab a section-intro line that reads
   slightly better above all cards. Eyeball per page; move a line out of the
   section if it mis-attributes.
4. **Commit the 3 uncommitted files** (scoped pathspec, §2) once Austen approves.
5. **ADR candidate:** once stable, this earns an architecture doc like the other
   "named primitive + routing rule" seams (`chip-primitives`, `crossfade-primitive`,
   `sequence-viewer-shell`). See `.claude/rules/` for the pattern.

---

## 7. Guardrails the next agent MUST follow

- `.claude/rules/never-hand-roll.md` — reuse ChoreoCard / InlineAnimationPlayer /
  the existing FlowFrame primitives; don't fork.
- `.claude/rules/verification-protocol.md` + `no-assumption-without-evidence.md` —
  prove card/layout claims with runtime queries or a screenshot, not prose.
- `.claude/rules/simplified-word-display.md` — any user-visible word goes through
  `simplifyRepeatedWord` (FlowFrame already does).
- `.claude/rules/commit-only-your-own-changes.md` — scoped commits only.
- `.claude/rules/no-layout-shift.md` — the reserved canvas square + fixed 5:7
  card-box keep the stage from shifting; keep it that way.
- Memory topic: `project_guide_card_stage.md` (durable policies + full rationale).
- Dark-card mechanics live in the memory topic policies #3 and #4.
