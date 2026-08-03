# Endless Spinner Rebuild — Design

**Date:** 2026-07-29
**Status:** Approved direction; spec pending Austen's review
**Route:** `/endless-spinner`
**Supersedes:** the incremental 4K pass landed in `6277d794a2` (that work ships as-is; this rebuild replaces the page's composition and information design on top of it)

## Mission

Rebuild `/endless-spinner` around what it actually is: a hypnotic, zero-effort
showcase of infinitely chained LOOPs. Strip every element that talks to
developers instead of humans, adopt the newer canvas+strip playback pattern the
rest of the app already ships, use canonical LOOP chip styling, and compose the
page per viewport class — SE and 4K each get a layout that is *native* to them,
not a shared layout stretched to fit.

## Decisions (locked with Austen, 2026-07-29)

1. **Live mode: retired.** Its Cloud Functions writer was deleted from the
   deployed codebase ~2026-05-04; `broadcastGetServerTime` no longer exists
   (the localhost "CORS" failure is a bare 404 on an unknown callable); nothing
   can write `liveBroadcast/*`; no UI anywhere starts a broadcast; no other
   surface consumes it. Delete, don't park.
2. **Ships to production.** The footer ("Endless LOOPs") and FAQ CTA already
   link the public here while the route is stripped from default prod builds.
   Promote it out of dev tier.
3. **StepStrip is the primary view; the choreo-card grid is the second view.**
   The 4-squares button becomes an honest view switcher between them.
4. **Infinite is the canonical mode and the default on load; Library stays as
   the second mode.** The toggle shrinks to two options.

## Page anatomy (top to bottom, logical order)

1. **Header band** — `← Home` pill · title "Infinite LOOPs" + subtitle ·
   two-option mode toggle (Infinite | Library; existing `SpinnerModeToggle` /
   `SegmentedControl`, minus the live option).
2. **Now-playing row** — ONE new small component, `SpinnerNowPlaying.svelte`
   (route-owned), replacing the `InfiniteModeInfo` / `LibraryModeInfo` /
   `LiveModeInfo` trio. Content: `LoopChips`
   (`src/lib/features/store/components/LoopChips.svelte`) driven by the
   sequence's LOOP components via `LOOP_COMPONENT_MAP` — one colored icon+label
   chip per component, quartered expressed by the canonical icon swap
   (`fa-rotate` → `fa-arrows-spin` for Rotated; checkerboard for quartered
   Inverted), never adjacent text. Same row in both modes. Rendered inside the
   existing fixed-height `Crossfade fill` stage so mode/sequence changes never
   shift layout. Nothing else lives here: no "Generated at", no step count, no
   text loop-type pill.
3. **Stage** — `AnimatorCanvas` + a playback pane that holds either
   `PracticeLanePane` (strip view, default) or `StepGrid` (grid view).
   Composition per viewport tier below.
4. **Transport** — centered: view switcher · **Play/Pause (primary, center)** ·
   Skip · History. Copy leaves the transport entirely.
5. **History drawer** — existing `SpinnerHistoryPanel`, with per-entry action
   changed from Copy to **Play again** (wired to the existing, currently-unused
   `hotSwapSequence` API). Copy-for-AI moves into the Debug panel.
6. **Debug panel** — unchanged (dev-gated), gains the Copy-for-AI button.

### Where the word lives

Exactly one place: the canvas, via `AnimatorCanvas`'s existing `word` prop, in
the TKA glyph font, simplified through `simplifyRepeatedWord`. The header text
word (`CΘ-ZE · 16 steps`) is deleted. The grid view naturally repeats letters
per card; that is notation, not a second word display.

## Per-viewport composition — THE core requirement

One layout stretched across SE and 4K will look poor on one of them. Each tier
below is a deliberate composition built from patterns already proven elsewhere
in the app. Mechanisms: the continuous 1680→3840 root ramp (already on this
page), `--shell-w` fluid band, rem sizing, and the Practice-mode split math
from `ViewerSplitPane` (canvas-fraction columns wide, strip-foot rows narrow).

| Tier | Viewport class | Composition |
|---|---|---|
| **4K / wide desktop** | ≥1680 | Side-by-side split filling the `--shell-w` band: canvas left at a generous fraction (~0.55 of the split in strip view), **vertical** `StepStrip` beside it (`orientation="vertical"`, `fillHeight`), read-from-afar cell sizes riding the root ramp. Grid view: canvas fraction drops (~0.42) and the pane swaps to the full `StepGrid`. Transport centered below the split. No dead rail; the stage grows with the band and the vertical is used — the stage owns the fold. |
| **Laptop** | 1050–1679 | Same side-by-side composition, base scale (ramp hasn't started), tighter canvas fraction. |
| **Tablet portrait** | ~700–1049 | Practice-mode narrow pattern: canvas full-width on top, **horizontal** strip pinned directly beneath it as a foot, transport under the strip. Grid view: grid replaces the strip foot, scrolling vertically. |
| **Short-horizontal** (Z Fold landscape, ~960×412) | width ≥700 and height ≤600 | Side-by-side (vertical strip) — stacking dies at this height. Header collapses to a single compact row. |
| **Phone / SE** | ≤~600 | Modern mobile, not shrunk desktop: full-bleed canvas (edge-to-edge width), horizontal strip directly beneath, and the **transport docked to the bottom of the viewport** (fixed, safe-area-inset padded, 44px+ targets) in the thumb zone — the app's established mobile bar pattern. Header is one compact row (Home pill + compact mode toggle); title may drop to keep the stage above the fold. History opens as the existing bottom drawer over the docked bar. |

Rules that bind every tier: `4k-native-layout.md` (1680 seam, fluid band, no
orphan rows, use the vertical), `no-layout-shift.md` (view/mode switches swap
inside reserved space via `Crossfade fill`), and the ghost-sizer/tabular-nums
disciplines already applied in the prior pass.

## View switcher semantics

Two views, one control (the 4-squares button, relabeled/re-iconed to read as a
view toggle, `aria-pressed` semantics):

- **Strip view (default):** `PracticeLanePane` — the thin adapter that builds
  notation cells, applies loop-step semantics, and picks
  horizontal-foot vs vertical-fill from the same breakpoint the CSS uses.
- **Grid view:** existing `StepGrid` choreo-card grid for the whole-sequence
  read.

The switch crossfades the pane content (`Crossfade fill` inside the
fixed-geometry pane); the canvas never moves. View choice persists per session
only (plain `$state`, no storage).

## Deletions

**Files deleted outright (~660 LOC):**
- `src/lib/features/landing/services/broadcast-repository.ts`
- `src/lib/features/landing/services/broadcast-sequence-converter.ts`
- `src/lib/features/landing/domain/models/broadcast-schemas.ts`
- `src/lib/shared/landing/domain/broadcast-models.ts`
- `src/lib/features/landing/components/LiveModeInfo.svelte`
- `src/lib/features/landing/components/InfiniteModeInfo.svelte`
- `src/lib/features/landing/components/LibraryModeInfo.svelte`
- `src/lib/features/landing/components/SpinnerStatsBar.svelte`

**Live branches trimmed from shared code:**
`sequence-chaining-orchestrator.ts` (broadcast wiring, live start/stop, server
-time sync), `endless-playback-state.svelte.ts` (`broadcastProvider`,
`broadcastState`, `convertBroadcastSequence`, `"live"` handling),
`chaining-types.ts` (`IBroadcastProvider`, `BroadcastSequenceConverter`,
`"live"` out of `SourceMode` — note `PlayWithItInner` and the effects lab also
import these types; their configs never used live, so this is
signature-narrowing only), `create-spinner-session.ts`,
`SpinnerModeToggle.svelte`, `+page.svelte`, and the two unit-test files' live
cases.

**UI elements deleted:** header text word + step count, Notation header bar,
"16 steps" badge, stats bar (transitions / unique / in session / ever
generated), "Generated at" timestamp, transport Copy button, the local
`getLoopColor` map.

**Kept invisible:** `SpinnerMetricsRepository` writes (generation counters
still record for analytics; only the display dies). Ambient background,
ephemeral `AnimationScope`, ready/error states, reduced-motion handling — all
retained from the prior pass.

## Data / state changes

- `SourceMode` becomes `"library" | "infinite" | "pick"` (pick is used by
  other consumers; live is gone).
- `createSpinnerSession`: `modes: ["infinite", "library"]`,
  `defaultMode: "infinite"`, no broadcast wiring.
- `SpinnerNowPlaying` input: for Infinite, LOOP components + rotation/inversion
  period come from the generator's per-sequence info (the `$state.raw` identity
  fix from `6277d794a2` makes this lookup reliable); for Library, from the
  sequence's own LOOP metadata via the same `parseLoopComponents` /
  `buildLoopCardDisplay` path the cards use. If a library sequence carries no
  LOOP metadata, the row shows nothing (empty reserved space — no fake chip).

## Shipping

- Remove `"src/routes/endless-spinner/"` from `DEV_ONLY_ROUTE_PATTERNS` and
  promote the `landing` feature module out of `tier: "dev"` in
  `src/config/feature-flags.ts` (after the deletions above, the module's
  remaining content is exactly the spinner's production surface).
- Verify the CF Pages `_worker.js` stays under the 25 MiB cap with the route
  included (`reference_cf_worker_size_limit`).
- Footer and FAQ links stay as-is; they become truthful.

## Verification plan

- All seven viewports (1920 / 2560 / 3840 / 1440×900 / 820×1180 / 960×412 /
  375×667), each in **both views and both modes** — screenshot + measurement
  pass, judged against the per-tier compositions above, iterated until right.
  Visual judgment stays with the main agent; implementation subagents cannot
  see the page.
- Mode-switch and view-switch geometry checks (canvas position identical
  across switches).
- Unit tests updated for the two-mode world; orchestrator/live tests removed
  with the code.
- `svelte-fast-check` on touched files during the loop; one full check before
  commit if the machine-wide check budget allows.
- Grep gates: no `type="checkbox"`, no raw `.word` display without
  `simplifyRepeatedWord`, no new `class="chip"` buttons, no hand-rolled colors
  where `LOOP_COMPONENT_MAP` applies.

## Component inventory (never-hand-roll accounting)

| Need | Resolution |
|---|---|
| Playing strip | **Reuse** `PracticeLanePane` → `StepStrip` (shared, proven in Practice + Play With It) |
| Whole-sequence grid | **Reuse** `StepGrid` (route-owned, already assigned to this route by shipped design) |
| LOOP identity chips | **Reuse** `LoopChips` + `LOOP_COMPONENT_MAP` (canonical) |
| Word display | **Reuse** `AnimatorCanvas` `word` prop + `simplifyRepeatedWord` |
| Mode toggle | **Reuse** `SpinnerModeToggle` (SegmentedControl), minus live |
| Pane/mode crossfades | **Reuse** `Crossfade` primitive (`fill`) |
| Play/pause indicator | **Reuse** `AnimatorCanvas` corner toggle (already shared with the app) |
| Now-playing row | **Create** `SpinnerNowPlaying.svelte` — composition-only wrapper over `LoopChips`; nothing existing renders "LOOP chips for the currently playing sequence" (grep: InfiniteModeInfo/LibraryModeInfo were the non-canonical attempts and are deleted) |
| Bottom-docked mobile transport | **Extend** the route's existing transport bar with a docked ≤600px tier (pattern precedent: viewer/practice mobile bars); no new primitive |

## Out of scope

- Unifying with the front-page hero (`createHeroAct` is a separate lightweight
  attract loop; rewriting it buys nothing visible).
- Changes to `PlayWithItInner` on `/composer` / `/embed/spinner` beyond the
  type-narrowing fallout of removing `"live"`.
- Rebuilding a live-broadcast backend (if that idea returns, it starts from a
  fresh spec with a real writer).
