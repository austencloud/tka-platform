# /notation Playable Archive prototype — Handoff (2026-07-28)

## Mission

Build a one-screen, playable prototype of the /notation catalog at
`/test/notation-playable`, so Austen can judge the experience before any of it
is integrated into production `/notation`. Nine notation systems (2009–2022)
from the real `NOTATION_CATALOG`, each with a source-grounded interactive
artifact, chronology as spatial layout, detail on demand.

Design spec (authoritative, read it first):
`docs/superpowers/specs/2026-07-27-notation-playable-archive-design.md`

**Production `/notation` is untouched.** Everything lives under
`src/routes/test/notation-playable/`.

**Nothing is pushed.** See "Gotchas → Do not push".

---

## Done — verified

All commits are local on `main`. Prototype paths are clean (`git status --short
-- src/routes/test/notation-playable tests/unit/notation-playable-*` returns
empty).

### The prototype itself
- `4cf353c7af` — the rail prototype, 9 entries, per-entry artifacts.
- `2ae434933a`, `0b1e912031`, `cc6691bc94` — four rounds of layout correction
  ending in the current **6×2 bento**: active entry is a 2×2 hero with
  `order: -1` (visual anchor top-left, DOM stays chronological), eight singles
  fill the remaining cells exactly — no orphan row. Above the **1680** seam the
  bento renders; below it, Embla carousel.
- `fe428a7e54`, `5af213c9fc` — 2026 editorial restyle: Fraunces italic
  masthead, ghost year numerals as tile graphics, flat ink tiles with hairline
  borders (no backdrop blur anywhere), one filled accent control, tick-mark
  timeline, SVG grain overlay. The detail plate carries the same language.

### Animation — three separate bugs, each instrumented
1. `4a76b466a5` — **stage names must persist.** Naming the stage only on the
   active tile left both names unpaired across a select re-tile, so the
   incoming hero's visual entered already at its destination while the tile was
   still morphing. Evidence: per-frame transform sampling of
   `::view-transition-group(tile-caps)`.
2. `fab78f387a` — **motion's `animateView` was replaying the journey.** Its
   WAAPI takeover attached ~300ms after commit (behind the artifact mounts),
   *after* the browser's default animation had already finished — the tile
   snapped backwards and re-ran. Now `document.startViewTransition` directly,
   with timing declared in CSS on a scoped `view-transition-class`.
   Evidence before: x went 766→154 by t=303, jumped back to 326 at t=319,
   finished again at t=565. After: single eased pass, **0 direction reversals**
   across 28 sampled frames.
3. `fa4cdeafc8` — **the whole panel was morphing out of the tile.** The detail
   panel carried the stage's transition name, so the entire wide panel (chrome,
   title, prose) stretched out of the tile's small square. The name now lives on
   `ArtifactDetail`'s `.detail-stage`; the artifact flies, the panel arrives.
   Evidence: 556×835 → 702×548, 0 reversals.
4. `d0dad48a66` — **the detail morph was animating the entire board.**
   Instrumented by wrapping `document.startViewTransition` and dumping every
   pseudo-element animation at `vt.ready`. One Inspect click created **55
   animations**: all 18 named groups + 36 old/new cross-fades + root. A name
   present in *both* states is still captured and cross-faded even when nothing
   moves. Fix: `soloMorph` strips the other names **before** the snapshot
   (`soloMorph = true; await tick();` then start), cleared in `finally`.
   Also: root snapshot (panel, backdrop, prose) ran its **250ms default against
   a 450ms morph** — the modal was fully on screen a fifth of a second before
   the artifact landed, which is what read as "the animation doesn't correspond
   with the modal". Root now 450ms on the same curve.
   Evidence after: **55 → 3** animations (`group(root):450`,
   `group(stage-caps):450`, `new/old(stage-caps):450`), 0 reversals, names
   restored on close (9 tiles + 9 stages), and a select still animates the full
   board (19 groups) — solo morph is scoped to detail open/close only.

### Crawlability
- `3747d15054` — every entry's sourced prose, subworks, citation links and
  video credits render **unconditionally per tile**, clipped visually
  (`clip-path`), never `display:none`, never `aria-hidden`.
  Evidence, measured in the closed state with nothing opened: **9 record
  blocks, all 9 system names, 11 citation links, 694 indexable words** (was
  ~40 words and 1 outbound link). The overlay is `aria-modal`, so screen
  readers don't get the content twice.

### Real artifacts replacing placeholders
- `788af2c610` — **Kinetic Alphabet**: resting poster is the sequence's
  mandala via the shared `SequenceMandala`, not a letter G. Word demoted to a
  caption. Selecting still hands over to the live sequence player.
- `7947dcd817` — **Lorq's catalogs**: the real **144-cell shape matrix**,
  twelve driving styles against twelve, every cell an actual rendered mandala
  pair from `loadShapeMatrix()`. Evidence: DOM query returned 144 cells, 12
  columns, PNG data URLs.

### Overflow containment
- `db2533f156` — two real bugs. (a) Short viewports pushed content past tiles:
  the PoiNotation cartridge painted **over its own label**. (b) At 3840 the Lorq
  sheet overflowed its stage by **325px** from a circular sizing bug — the
  wrapper's grid column track was `auto`, so `min(100%, Ncqh)` had no
  percentage basis, the `cqh` arm won, and the track grew to it. Wrappers now
  pin `grid-template-columns: minmax(0, 1fr)`.
  Evidence — swept **3840×2160, 2560×1440, 1920×650 (short), 1680×944,
  1440×900, 820×1180, 960×412, 375×667, 337×600**: zero document overflow and
  zero tile spills at every one, except a 4px shadow tail on the VTG glyph grid
  at 960×412 that the stage guard clips.

### Fold-landscape and phone defects found by looking
- Also in `db2533f156` / `3747d15054`: `.room-header { display: none }` at
  fold-landscape was removing the page's **only h1** from the render tree, and
  the active tile's label was hidden. Masthead now moves into the right column
  (also filling the dead space there); label stays, compact. Phone masthead
  stacks instead of wrapping a 3-line title against a 3-line pill.

### Tests
`npx vitest run tests/unit/notation-playable-archive-contract.test.ts
tests/unit/notation-playable-archive-state.test.ts`
→ **14 passed (2 files)**, run 2026-07-28.

The contract test's six original regex assertions were each run against the
pre-fix source (`git show 5af213c9fc:...PlayableArchive.svelte`) and **all six
fail there** — they bite, they don't pass vacuously.

`npm run check:fast` → **0 diagnostics in any notation-playable file**. (The
repo's ~33 other errors are pre-existing in other sessions' files and unchanged
by this work.)

---

## Believed done — unverified

- **Reduced motion** is verified *functionally* (matchMedia shimmed before
  boot; 0 view transitions started, state still changes) but never
  **screenshotted** under a real `prefers-reduced-motion` OS setting.
- **The 2560 and 3840 frames predate the last two commits.** Layout was
  re-measured after (`zero spills`), but no human has looked at a 4K frame
  since the Lorq matrix and solo-morph landed.
- **Austen's emotional review of the whole prototype** has not happened. That
  was always loose end #2 of the original handoff and is still open.
- **No screen recording of the transitions.** DevTools MCP has no recorder;
  every animation claim above rests on numeric instrumentation, not video.

---

## In flight

Nothing of this work is uncommitted. **The prototype paths are clean.**

The repo working tree is heavily dirty (~40 files: QR/shortcode scripts,
Firestore parity diagnostics, arena, create/construct, animation-engine,
`docs/superpowers/specs/2026-07-27-profile-lobby-design.md`, …). **None of it
is mine.** It belongs to other concurrent sessions. Do not stage, commit,
revert, or "clean up" any of it.

Other sessions have also committed *on top of* this work since (`ce014046eb`,
`e063fcfcd6`, `dfe2e26438`, `ae61d928b5`, `895b526ea8`, and several qft /
profile-stage / construct commits). `main` is **7 commits ahead of
origin/main** — a mix of this work and theirs.

---

## Update — pickup session, 2026-07-28

Audited every claim above before continuing: all 14 cited commits exist, the
prototype paths are clean, and both test files pass (14/14, re-run). Other
sessions have landed ~20 more commits on `main` since; none touch
`src/routes/test/notation-playable/`.

- **Loose end 1 is DONE** — `75c7fef551`, local, unpushed.
  `VtgGlyphField.svelte` is deleted; `VtgFlowerField.svelte` replaces it. The
  six real glyphs are now the axis control; the stage paints the four
  spin-style pairings that the current timing/direction traces, from that
  mode's canonical base word, via the shared poi-trail painter. Two findings
  worth keeping:
  - **Do not parity-correct here.** `verifyAndCorrect` re-anchors both hands
    onto one canonical locus, which erased the axis — Split·Same and
    Together·Same came out pixel-identical. Measured, then removed. (It stays
    correct for the shape-matrix drill, where the cell IS the flower pair.)
  - **Static geometry cannot separate split from together.** A same-direction
    loop traces the same path set either way; only the hands' phase differs,
    and phase is what the timing word means. `shape-matrix-poi-render.ts`
    gained an opt-in `startMarkers` flag that dots where each hand begins
    (default off — existing callers unchanged). With it, 6 of 6 modes draw
    distinct pictures.
  - Swept 1920 / 2560 / 3840 / 1440 / 820×1180 / 960×412 / 338×600: zero
    document overflow, stage inside its tile at every one. Fold-landscape
    spilled 7px until the stage reserved the text rows and became a
    border-box square; per-cell captions stand down under a 360px stage
    (they rendered at 7px).

- **Loose end 3 is BLOCKED on sourcing, not on effort.** Fong's wiki — the one
  place the previous session flagged as unread — was read. Both the wiki home
  and its Instructions page carry the DSL course assignment only: no semantics
  for `rotations` / `armSpin` / `handleSpin` / `extended`, and **no citation of
  any prior system**. That independently confirms the "no relationship claims"
  decision below. It also means drawing the pattern a PoiNotation line
  describes would require inventing a parameter→geometry mapping, which the
  catalog's sourcing rules forbid. Needs either a better primary source or
  Austen's explicit call on how far to interpret.

- **4K dead space is a board-level issue, not a tile-level one.** At 3840 the
  hero tile is 1702px tall holding a 787px stage; every tile centres its
  content and leaves the rest empty. This reproduces on the shipped tiles
  (Lorq uses the same `min(100%, Ncqh)` + `aspect-ratio: 1` structure), so it
  was left alone — the bento was reached after Austen rejected two other
  layouts, and changing how the board uses the vertical is his call.

---

## Loose ends (ranked)

1. ~~**Vulcan Tech Gospel is the worst artifact on the page and the most
   important system.**~~ **DONE** — see the update section above.
   Original note follows for context. Six static letter tiles (SS SO TS TO QS QO) for what
   Austen calls quite possibly the biggest influence on his work. Yee's own
   framing is "the flower patterns available within a given timing and
   direction, and how to transition between them" — so the artifact should be
   *the flowers, animating*, with timing and direction as axes. Machinery
   already exists: `ShapeMatrixGrid` is props-only and pluggable, and
   `src/lib/shared/shape-matrix/services/shape-matrix-poi-render.ts` paints
   poi-style light trails from the same geometry. **Start here.**
2. **Trochoid model + Unit Circle Theory need explainers, not decoration.**
   Austen: *"I don't even understand [the trochoid model] and I might need an
   explainer like we created for the QFT notation. The same with the unit
   circle theory — I need to understand them before I can create a visualizer."*
   The trochoid notation is `Theta1 Theta2 ; Rho1 Rho2` (two turn counts, two
   radii, plus a division term) — continuous parameters, so a parametric
   renderer with draggable θ and ρ *is* the explainer. Unit Circle Theory then
   falls out of the same figure: Alien Jon's point is the circle is diameter 1
   in poi lengths so proportions hold at any prop length — a scaling
   demonstration on the identical curve.
3. **PoiNotation should render as a pattern, not only as code.** Austen likes
   the green-on-black cartridge but wants the pattern it describes. Its
   parameters are `{extended: bool, rotations: int, armSpin, handleSpin}` —
   coarser and categorical, so it can be *drawn* by the same routine, but see
   Decisions below: **do not claim it derives from the trochoid model.**
4. **9-Square** — "decent with the videos, but maybe fan out a little more
   prettily." Presentation only, no new capability needed.
5. **Small-tile legibility of the Lorq matrix.** At ~18px cells it reads as
   texture, not as distinct patterns. Fine as hero/detail; consider a reduced
   axis at small sizes.
6. **Production integration** (the eventual assignment, gated on Austen's
   approval): the crawlable record structure built here must survive into
   production `/notation`, which — unlike this test route — actually SSRs.

---

## Decisions already made (do not re-litigate)

- **Do not modify production `/notation`.** This is a prototype route only.
- **Do not push.** Standing instruction from session start (a predecessor
  commit, `1cc2369cc4`, was another session's unpublished work). Everything is
  committed locally on `main`.
- **No branches, no worktrees.** Explicit instruction; also
  `.claude/rules/worktree-workflow.md`.
- **Scoped commits only.** `git commit -m "..." -- <paths>`. The index is
  shared with other live sessions.
- **No relationship claims between systems** (2026-07-28). Austen asked whether
  we should say PoiNotation was built on the trochoid model. **Checked the
  primary:** Fong's repository has *no citations at all* — it states it is "a
  domain-specific language (DSL) written in Scala for describing
  glowsticking/poi moves and choreography" and "an independent project for the
  DSLs course in Fall 2016." There is no evidence of lineage, and the catalog's
  sourcing rules forbid inventing one. They describe the same physics, so one
  drawing routine can render both — that is a shared *rendering capability on
  our side*, not shared history on theirs. (The README points to a wiki for
  "a more detailed writeup and design process" — **unread**; it is the one
  place a citation could plausibly live.)
- **Lorq's tile is not a reproduction of Lorq's sheet.** It shows the *form* of
  the work (styles crossed until the grid is full) using TKA's own flowers; the
  entry's sources still point to his site.
- **Bento, not carousel, above 1680.** Reached after Austen rejected a carousel
  ("content is just blasting me in the face") and then an accordion ("just
  silly and you know better").

---

## Gotchas

- **Austen's Chrome has page zoom at 90% on localhost:5181**
  (`devicePixelRatio` 0.9). His CSS viewport is 1.11× the device size, so the
  DevTools emulator and his window disagree. To hit CSS width W, emulate
  `W × 0.9`. This wasted real time; check `innerWidth` after every `emulate`.
- **A parallel session hot-edits `src/routes/+layout.svelte` constantly.** The
  page fully reloads between tool calls and loses state. Do act+assert inside a
  *single* `evaluate_script` call, and wait for `.artifact` to exist before
  measuring.
- **The DevTools MCP tab selection drifts.** It silently jumped to another
  session's `localhost:5173` tab mid-run. Verify `location.href` before
  trusting a measurement.
- **`resize_page` stopped applying** partway through; `emulate` with
  `viewport: "WxHx1"` is reliable. Screenshots must be `format: "webp",
  quality: 70`.
- **Test routes are `ssr = false`** (`src/routes/test/+layout.ts:7`), so
  `curl` of this route returns an empty app shell — that is expected and is not
  the crawlability story. The crawlability work is about the *content model*
  (unconditional DOM), which is what carries into production.
- **`cqh` needs a size container.** `.artifact-stage` has
  `container-type: size`, so `cqh` is valid *there*. But a `cqh` width inside a
  grid whose column track is `auto` creates a circular dependency and the track
  grows to the `cqh` value — this is what caused the 325px overflow. Always pin
  `grid-template-columns: minmax(0, 1fr)` on such wrappers.
- **`loadShapeMatrix()` is expensive but memoized.** It runs on mount of the
  Lorq tile only. Do not call it for all nine tiles at boot.
- **`ShapeMatrixGrid` cannot be used inside a tile** — it enforces a 44px AAA
  touch floor per cell, so 13 columns need 572px and it overflows. The tile
  paints cells directly because they are non-interactive artwork.
- **Do not add "verify your work" to Opus 5 subagent prompts** — it
  self-verifies and over-verifies (`.claude/rules/fable-routing.md`).
- The QFT artifact imports `QftStage` from
  `$lib/shared/notation/qft/components/QftStage.svelte` — another session
  promoted it mid-work and swept `QftLiveArtifact.svelte` into their commit
  `170cda44a0`. Expect that file's history to look odd.

---

## Where it lives

Route: [localhost:5181/test/notation-playable](https://localhost:5181/test/notation-playable)
(port 5181 is an agent dev server; **5173 is Austen's — never touch it**.)

Files:
- `src/routes/test/notation-playable/+page.svelte`
- `src/routes/test/notation-playable/_components/` — `PlayableArchive.svelte`
  (the room), `ArtifactVisual.svelte` (id → visual router),
  `ArtifactDetail.svelte`, plus one component per system.
- `src/routes/test/notation-playable/_lib/archive-state.ts` — pure state.
- `tests/unit/notation-playable-archive-state.test.ts` (5),
  `tests/unit/notation-playable-archive-contract.test.ts` (9).
