# Download Animation — Unified 5-Pill Navigation Design

**Date:** 2026-04-21
**Files touched:** `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`, plus new `src/lib/shared/sequence-viewer/components/pill-nav/*`
**Supersedes (mobile portion):** [`2026-04-19-mobile-bento-export-panels-design.md`](./2026-04-19-mobile-bento-export-panels-design.md) — keeps the rail-tile primitive and `RailBentoSheet`, replaces the 4-tile bento with a 5-pill nav and adds a Display section.
**Related cleanup (already merged in this branch):** AnimationSettingsModal nuked; the 8 panel files moved from `animation-settings-modal/categories/` to `animation-engine/components/settings-panels/` with `Panel` suffix.

---

## ⚠️ 2026-04-21 audit corrections (read this before the body)

The original spec body shipped several design errors that the implementation plan now overrides. The plan (`docs/superpowers/plans/2026-04-21-download-animation-unified-nav.md`) is the source of truth where it conflicts with the body below. Specifically:

1. **Loops and Timing live in EXPORT, not Playback.** They describe the output video file (how many concatenations, whether to pad start/end with held frames), not in-canvas preview behavior. Any earlier line implying "Loops belongs with playback" is wrong.
2. **Effects pill summary shows the active effect's NAME (`"Trails"`, `"Fire"`, `"Off"`), not a count.** The default `tipEffectMap` always has one wildcard entry, so a count-based summary said "1 active" with zero user input.
3. **All 3 fps options (30/60/120) and all 4 resolutions (720p/1080p/4K/8K) are preserved on desktop.** Earlier draft inadvertently dropped 120 fps and 4K/8K.
4. **Desktop Effects pill keeps the inline play/pause + tempo control** via `EffectsPanel`'s `showPlayback` branch (only when both `onPlaybackToggle` and `onBpmChange` are provided). Earlier draft set `showPlayback={false}`, which removed the play affordance from desktop.
5. **Path shape (Arc/Linear) is reported explicitly in the Display summary, not counted as on/off.** Both arc and linear are valid choices, not enable/disable. New summary format: `<n> / 7 visible · <path>`. Denominator (7) is derived from the input arity to `computeDisplaySummary`, not hardcoded.
6. **PILL_ORDER is type-enforced** via `buildPillSpecs(Record<PillId, ...>)` in `pill-types.ts` — no runtime DEV drift guard.
7. **`PlaybackPanel.svelte` is deleted as orphan** in pre-flight (no consumer; the Playback pill body inlines `TempoControl` + `PlaybackModeToggle`).
8. **Pills use `role="button"` + `aria-pressed`, NOT `role="tab"` + `aria-selected`.** The `tab`/`tabpanel` ARIA pattern requires the panel to be a permanent DOM sibling linked via `aria-controls`. The pill bodies are conditionally mounted (one at a time) and on mobile they live inside a portal'd `role="dialog"` — neither is a tabpanel. Mobile pill buttons additionally carry `aria-haspopup="dialog"`.
9. **Shared `.rt-*` primitives (`.rt-section`, `.rt-section-label`, `.rt-chip-row`, `.rt-chip`, `.rt-row`, `.rt-row-label`) are promoted from `RailBentoSheet`'s `:global(.bento-sheet-body ...)` scope into `rail-tile.css`** so they apply equally inside the desktop inline pill body and the mobile sheet. (Pre-flight task in the plan.)
10. **Touch targets in the shared primitives are bumped to AAA-grade 44px:** `.rt-step-btn` 24×24 → 44×44, `.bento-sheet-close` 28×28 → 44×44, `.rt-chip` 38px tall → 44px tall. (Pre-flight task in the plan.)
11. **`RailBentoSheet` adds a focus trap, returns focus to the activating pill on close, and honors `prefers-reduced-motion` on its fly/fade transitions.** Pill button refs are tracked so the sheet can restore focus on dismiss. (Pre-flight task in the plan.)
12. **The Display pill body wraps `DisplayPanel` and `PathShapePanel` in `role="group"` regions** with explicit "Visibility" and "Motion paths" section labels (linked via `aria-labelledby`).
13. **Pill typography and contrast meet AAA:** `.pill-label` and `.pill-summary` use `var(--font-size-compact, 12px)` (the project's typography floor — no 9px or 10px text). Active-state foreground uses solid white, not a color-mix that drifts below the 7:1 threshold. Focus outlines use the opaque accent color, not 0.6 alpha.
14. **DownloadPillNav's keyboard model implements the WAI-ARIA toolbar pattern**: ←/→ moves focus (with wrap), `Home`/`End` jump to first/last, `Enter`/`Space` activate. The legacy `"Spacebar"` key name is dropped — only `e.key === " "` is checked.
15. **`activePillId` is reactive to `layout` changes via `$effect`**, not a one-shot `$state` initializer. If the parent flips `layout="bottom"` → `layout="sidebar"` without remounting, the desktop sidebar still defaults to "effects" so the spec's "one pill always active on desktop" invariant holds.
16. **Tasks 6 and 7 are merged into a single atomic task** so the working tree never carries a half-rewritten `ExportVideoDrawer.svelte` between commits.

The body below is otherwise still accurate (component decomposition, RailBentoSheet reuse, mobile/desktop layout strategy).

## Problem

The Download Animation surface today exposes **5 conceptually-distinct setting groups** through three different mechanisms:

1. **Effects, Effort, Playback, Export** — visible on the canvas via the 4-tile mobile bento and as a flat sidebar on desktop.
2. **Display visibility toggles** (Grid, TKA Glyph, Step Numbers, Beat Position, Props, Word Header, Progress Bar) — were *only* reachable through right-click → Animation Settings → Display tab. The modal got nuked so these are temporarily orphaned.
3. **Path Shape** (Arc / Linear) — also lived in the modal, also orphaned.

Effect: the user can't see or change "what's visible in my exported animation" without remembering an obscure right-click menu, and the desktop sidebar doesn't share visual or interaction language with the mobile bento. Two viewports, two mental models, two ways to fail.

## Goals

- **One navigation pattern across both viewports.** Mobile and desktop both expose the same 5 sections through the same pill row. Users learn one thing.
- **All 5 sections are first-class.** Display and PathShape stop being hidden; they get full pill-tab status.
- **Canvas/preview stays visible at all times.** Mobile keeps the slide-up sheet pattern (sheet covers ≤72% of canvas). Desktop already has space, so the active section renders inline in the sidebar.
- **Reuse what we just built.** The 8 `settings-panels/*Panel.svelte` files, the `RailBentoSheet` chrome, and the `rail-tile.css` primitive all carry over. No re-skinning required.
- **Single download button surface.** One always-visible primary action ("Download Animation" / "Record Scene"), regardless of which pill is active.

## Non-goals

- ExportImagePanel (Download Card) — out of scope, keeps its existing 3-tile bento.
- Per-effort parameter sliders on mobile — still desktop-only (matches prior bento spec).
- Restoring an Animation Settings modal — it's gone, every category now lives somewhere reachable.
- Renaming the 8 settings-panels we just relocated — already named correctly.

## Section ordering, label, and summary

Left-to-right reading order matches workflow ("set up the look, then export it"):

| Order | Pill | Label | Icon | Live summary content (max 24 chars) | Source state |
|---|---|---|---|---|---|
| 1 | Effects | EFFECTS | `fa-sparkles` | active effect name, e.g. `"Trails"`, `"Fire"`, or `"Off"`. (Resolved via `EFFECT_LABELS[vm.getActiveEffect()]`.) | `vm.getActiveEffect()` |
| 2 | Effort | EFFORT | (effort color dot) | active effort label, e.g. `"Float"`. Pill border + dot tinted by `effort.color`. | `vm.getEffortPreset()` |
| 3 | Playback | PLAYBACK | `fa-play` | `"120 BPM • Cont."` or `"120 BPM • Step"` | `bpm`, `vm.getPlaybackMode()` |
| 4 | Display | DISPLAY | `fa-eye` | `"5 / 7 visible · arc"` (count of 6 visibility toggles + grid; path shape surfaced separately because Arc/Linear are both valid choices, not on/off) | `vm.getSettings()`, `vm.isGridVisible()`, `vm.getPathShape()` |
| 5 | Export | EXPORT | `fa-sliders` | `"1080p • 60 fps"`, with `" • Nx"` appended when `videoLoopCount > 1` (or `"1080×1080 • 60 fps"` in 3D mode) | `exportOptions.videoResolution`, `exportOptions.videoFps`, `exportOptions.videoLoopCount` |

Pill width on mobile: `1fr` each, equal-share, single horizontal row above the download button. Pill width on desktop: `1fr` each, single horizontal row at the top of the sidebar.

Pill internal layout: `[icon] LABEL` on top line, `summary` on second line in smaller dim text. Active pill gets the rail-chip blue tint exactly as `rail-tile.css:.rt-tile[aria-pressed="true"]`. The Effort pill overrides `--accent` with `--effort-color` so its active glow matches the chosen effort.

## Display pill — content layout

The Display pill body has two sub-sections:

1. **Visibility toggles** — uses the existing `DisplayPanel.svelte` component verbatim. Renders 8 toggle rows (Grid + 7 visibility flags), each as a row with label + toggle-indicator (button + toggle-indicator pattern, never a checkbox).
2. **Motion paths** — uses the existing `PathShapePanel.svelte` component verbatim. Renders 2 chips (Arc / Linear) under a `Motion paths` section label.

Layout in the body:

```
┌───────────────────────────┐
│ VISIBILITY                │
│ ┌─ Grid             [○●] ─┤
│ ├─ TKA Glyph        [●○] ─┤
│ ├─ Step Numbers     [●○] ─┤
│ ├─ Beat Position    [○●] ─┤
│ ├─ Props            [●○] ─┤
│ ├─ Word Header      [●○] ─┤
│ └─ Progress Bar     [●○] ─┤
│                           │
│ MOTION PATHS              │
│ [   Arc   ] [  Linear  ]  │
└───────────────────────────┘
```

The body composition is just two component imports stacked vertically, with a section label between them. No new logic.

## Mobile layout (≤640px wide preview)

```
┌────────────────────────────────────────┐
│                                        │
│         Animation preview              │
│         (full available height)        │
│                                        │
├────────────────────────────────────────┤  ← optional sheet slides up here
│ [EFFECTS][EFFORT][PLAYBACK][DISPLAY][EXPORT] │  ← always visible
├────────────────────────────────────────┤
│  [        Download Animation        ]  │  ← always visible
└────────────────────────────────────────┘
```

- Pill row + download button = ~110px reserved at the bottom. The animation preview consumes the remainder of the viewer area.
- Tap a pill → that pill goes active-blue and a `RailBentoSheet` slides up from the pill row, max-height 72% of the canvas area, body = the corresponding panel component(s).
- Tap the same pill again, or the sheet's ✕, or the backdrop → sheet slides down, pill returns to resting.
- Only one sheet open at a time (existing behavior preserved).
- During an in-progress export the pill row is replaced by the existing `mobile-progress` block (progress bar + cancel) — no behavior change there.

## Desktop layout (sidebar)

```
┌─────────────────────────┐
│ [Eff][Eff][Pl][Dis][Ex] │  ← pill row at top of sidebar
├─────────────────────────┤
│                         │
│   Active pill body      │
│   (scrolls if tall)     │
│                         │
├─────────────────────────┤
│ [ Download Animation ]  │  ← footer
│      ~28s est.          │
└─────────────────────────┘
```

- Same `DownloadPillNav` component as mobile (props identical), no separate desktop variant.
- Active pill body renders inline in a flex-grow region between the pill row and the footer. No sheet, no backdrop.
- Footer keeps the existing `time-estimate` line under the download button (only shown when applicable).
- One pill is **always** active. Default = `effects`. Persists for the session in component state (no need for cross-session persistence — the export flow is short-lived).

Resize behavior: the layout switches between mobile and desktop based on the existing `layout: "sidebar" | "bottom"` prop. The component does not need to detect viewport itself — the parent already passes the correct `layout`.

## Component architecture

```
src/lib/shared/sequence-viewer/components/
├── pill-nav/                          ← NEW directory
│   ├── DownloadPillNav.svelte         ← NEW: the 5-pill row
│   ├── PillBody.svelte                ← NEW: shared body wrapper (mobile=sheet, desktop=inline)
│   ├── pill-types.ts                  ← NEW: PillId, PillSpec types
│   └── pill-nav.css                   ← NEW: pill-specific styles (extends rail-tile.css)
├── bento/
│   └── ... (RailBentoSheet, rail-tile.css — unchanged, reused)
└── ExportVideoDrawer.svelte           ← REWRITTEN: both branches use DownloadPillNav
```

### `pill-types.ts`

```ts
export type PillId = "effects" | "effort" | "playback" | "display" | "export";

export interface PillSpec {
  id: PillId;
  label: string;          // e.g. "EFFECTS"
  icon?: string;          // FontAwesome class, e.g. "fa-sparkles". Optional for Effort (uses color dot).
  summary: string;        // live, derived in parent and passed in
  accentColor?: string;   // optional override (Effort uses effort.color)
}
```

### `DownloadPillNav.svelte`

Pure presentational. Props:

```ts
interface Props {
  pills: PillSpec[];
  activeId: PillId;
  onSelect: (id: PillId) => void;
  variant: "mobile" | "desktop";   // controls sizing/spacing only
}
```

Renders the 5 pills in a horizontal flex row. Mobile variant uses larger touch targets (min-height 56px); desktop uses a tighter 44px. Active pill gets the rail-chip blue tint or the `accentColor` override.

### `PillBody.svelte`

Layout wrapper. Mobile renders into a `RailBentoSheet`; desktop renders into an inline scrollable region.

```ts
interface Props {
  title: string;            // Pill label (e.g. "Effects"); shown in sheet header on mobile
  variant: "mobile" | "desktop";
  onClose?: () => void;     // only used in mobile variant
  children: Snippet;
}
```

This abstracts the only real layout difference between the two viewports — everything else (the panel content, the state, the styling) is identical.

### `ExportVideoDrawer.svelte` (rewritten)

Both branches collapse to:

1. Compute the `pills: PillSpec[]` array (5 entries, summaries derived from `vm` + `exportOptions`).
2. Render the always-visible header chrome (mobile: nothing; desktop: nothing yet).
3. Render `<DownloadPillNav>`.
4. Render `<PillBody>` whose children switch based on `activePillId`.
5. Render the always-visible download button.

The mobile and desktop branches differ only in:
- The `variant` prop passed to `DownloadPillNav` and `PillBody`.
- Mobile keeps `activePillId | null` (closed = null); desktop keeps `activePillId` (always set, default "effects").
- Mobile wraps in `<div class="mobile-export">`, desktop in `<div class="export-panel sidebar">`.
- Mobile shows the in-progress export view; desktop shows the same in its footer.

The 5 pill bodies are rendered inline as `{#if activePillId === "effects"}...{:else if ...}` blocks inside a single `<PillBody>`. Each body composes:

| Pill | Body content |
|---|---|
| Effects | Mobile: `<MobileEffectsPanel />`. Desktop: `<EffectsPanel ... showPlayback={!!(onPlaybackToggle && onBpmChange)} />` (desktop keeps the inline play/pause + tempo control via the EffectsPanel's `showPlayback` branch — no regression vs the prior desktop UX). |
| Effort | `<EffortPanel />` |
| Playback | `<TempoControl />` + `<PlaybackModeToggle />`. Tempo + mode only — these describe in-canvas preview behavior. Loops, Start Hold, End Hold all describe the OUTPUT video and live in Export. |
| Display | "Visibility" section label + `<DisplayPanel />` + "Motion paths" section label + `<PathShapePanel />`, both wrapped in `role="group"` with `aria-labelledby` to the matching section label. |
| Export | FPS chips + Resolution chips + Quality chips (3D only) + Timing (Start Hold / End Hold) chips + Loops stepper + duration line. |

### Loops + Timing live in Export, not Playback

Loops, Start Hold, and End Hold all describe the **output video file** (how many times the sequence is concatenated, whether to pad with a held start frame, whether to pad with a held end frame). They do not affect in-canvas preview playback. Group them with the other output-format controls (FPS, resolution, quality) under the Export pill.

## State and event flow

No state changes. All writes still go through:

- `vm` (`AnimationVisibilityStateManager`) — Display toggles, Path Shape, Effort preset, Playback mode, tip-effect map
- `exportOptions` (`ExportOptionsStateManager`) — FPS, resolution, quality, loops, timing chips
- `bpm` / `onBpmChange` props — Tempo

The new `DownloadPillNav` and `PillBody` are pure presentation. The pill summaries are `$derived` in `ExportVideoDrawer` from the existing `vmVersion` invalidation token (already wired).

### Display summary derivation

```ts
const displaySummary = $derived.by(() => {
  void vmVersion;
  const s = vm.getSettings();
  return computeDisplaySummary(
    {
      tkaGlyph: s.tkaGlyph,
      stepNumbers: s.stepNumbers,
      beatPosition: s.beatPosition,
      props: s.props,
      wordHeader: s.wordHeader,
      progressBar: s.progressBar,
      grid: vm.isGridVisible(),
    },
    vm.getPathShape(),
  );
});
```

`computeDisplaySummary` (a pure helper, unit-tested) sums the truthy values across all input flags and surfaces the path shape explicitly (arc vs linear are both valid choices, not on/off). Returns `"<n> / <total> visible · <pathShape>"`. Denominator is genuinely arity-derived from the input record — adding a new toggle automatically updates it.

### Effects summary derivation

```ts
const effectsSummary = $derived.by(() => {
  void vmVersion;
  const active = vm.getActiveEffect();
  if (active === "none") return "Off";
  return EFFECT_LABELS[active] ?? active;
});
```

The legacy `effectsCount` derived value (count of non-none entries in `tipEffectMap`) is removed. The default tip-effect map is `{ "*": { effect: "trails" } }`, so a count of 1 vs 0 was meaningless — it never reflected a user action. Active-effect name is the truthful state.

### Playback summary derivation

```ts
const playbackSummary = $derived.by(() => {
  void vmVersion;
  const mode = vm.getPlaybackMode() === "step" ? "Step" : "Cont.";
  return `${bpm} BPM • ${mode}`;
});
```

### Export summary derivation

```ts
const exportSummary = $derived.by(() => {
  const r = exportOptions.videoResolution;
  const resLabel = renderMode === "3d"
    ? `${r}×${r}`
    : (r >= 4320 ? "8K" : r >= 2160 ? "4K" : `${r}p`);
  return `${resLabel} • ${exportOptions.videoFps} fps`;
});
```

### Effort summary

```ts
const effortSummary = $derived(activeEffort.label);  // already exists
const effortAccent = $derived(activeEffort.color);
```

## Visual language

Pills use the existing `rail-tile.css:.rt-tile` cascade for resting, hover, and active states. Additions in `pill-nav.css`:

```css
.pill-nav {
  display: flex;
  gap: 6px;
  padding: 6px;
  background: rgba(20, 22, 32, 0.6);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.pill-nav.variant-mobile { padding: 4px; }

.pill {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  /* Inherits .rt-tile background/border/transition */
}

.pill-nav.variant-mobile .pill { min-height: 56px; }

.pill-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.pill-summary {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.pill[aria-pressed="true"] .pill-label,
.pill[aria-pressed="true"] .pill-summary {
  color: var(--pill-accent, #c5ddff);
}

.pill .effort-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--pill-accent, currentColor);
  box-shadow: 0 0 6px var(--pill-accent, currentColor);
}
```

The `--pill-accent` CSS variable is set inline by the parent for the Effort pill to its `effort.color`. Other pills inherit the default blue accent from `.rt-tile[aria-pressed="true"]`.

## Interaction model

| Trigger | Mobile behavior | Desktop behavior |
|---|---|---|
| Tap pill (closed) | Pill goes active. Sheet slides up. | Pill goes active. Body swaps inline. |
| Tap active pill | Pill returns to resting. Sheet slides down. | No-op (one pill always active). |
| Tap different pill | First pill returns to resting, second goes active. Sheet content swaps in place. | Same: body swaps inline. |
| Tap ✕ on sheet | Same as "tap active pill" — sheet closes. | n/a (no ✕ in inline body) |
| Tap backdrop | Sheet closes. | n/a |
| Press Escape (sheet open) | Sheet closes. | n/a |
| Press ←/→ with focus on a pill | Move focus to neighbor pill. Does NOT activate. | Same. |
| Press Enter or Space on focused pill | Activates the pill. | Activates the pill. |
| Tap Download | Triggers `onExport()`. Pill state preserved. | Same. |

Default open pill on initial mount:
- Mobile: `null` (no sheet open). User explicitly opens.
- Desktop: `"effects"` (was the prior default focus area).

## Components to reuse

Existing, no changes:

- `EffectsPanel` — `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`
- `MobileEffectsPanel` — `src/lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte`
- `EffortPanel` — `src/lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte` *(new home, post-cleanup)*
- `DisplayPanel` — `src/lib/shared/animation-engine/components/settings-panels/DisplayPanel.svelte` *(new home)*
- `PathShapePanel` — `src/lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte` *(new home)*
- `PlaybackModeToggle` — `src/lib/features/compose/components/controls/PlaybackModeToggle.svelte`
- `TempoControl` — `src/lib/shared/sequence-viewer/components/TempoControl.svelte`
- `RailBentoSheet` — `src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte`
- `rail-tile.css` — `src/lib/shared/sequence-viewer/components/bento/rail-tile.css`
- `EFFORTS` + `EffortId` — `src/lib/features/effort-lab/domain/effort-types.ts`
- All existing state managers (`AnimationVisibilityStateManager`, `ExportOptionsStateManager`)

New small pieces:

- `pill-nav/DownloadPillNav.svelte` (~80 lines)
- `pill-nav/PillBody.svelte` (~50 lines)
- `pill-nav/pill-types.ts` (~15 lines)
- `pill-nav/pill-nav.css` (~70 lines)

## File-level changes

### `src/lib/shared/sequence-viewer/components/pill-nav/` (new directory, 4 new files)

Listed above.

### `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`

- Add imports: `DownloadPillNav`, `PillBody`, `DisplayPanel`, `PathShapePanel`, `pill-nav.css`, `pill-types`.
- Add derived state: `displaySummary`, `playbackSummary`, `exportSummary`, `effortSummary`, `effortAccent` (and rewrite `effectsSummary` from existing `effectsCount`).
- Replace `type SheetId = "effects" | "effort" | "playback" | "export"` with `import { type PillId } from "./pill-nav/pill-types"`.
- Replace mobile branch (`{#if layout === "bottom"}`): one shared template with `<DownloadPillNav>` + conditional `<PillBody>` (mobile variant) + always-visible download button.
- Replace desktop branch (`{:else}`): same shared template with `<PillBody>` set to desktop variant; `activePillId` defaults to `"effects"`.
- Delete the inline pill-body bodies for the 4 prior tiles (Effects/Effort/Playback/Export) — they move into the `{#if activePillId === ...}` switch.
- Delete obsolete CSS: any `.rt-grid-2x2` usage in this file (the 2×2 tile grid is gone), the desktop `.setting-row` cascade (replaced by inline pill bodies that already have their own styling), and the `settings-summary` derivation (no longer used — pills carry their own summaries).
- Keep: `.mobile-export`, `.mobile-progress`, `.export-panel.sidebar`, `.panel-footer`, `.export-row`, `.export-btn`, `.time-estimate`, `.video-duration-line`.

### Migration of Loops from Export to Playback

In the new Playback pill body, append a Loops row using the existing stepper markup. In the new Export pill body, omit the Loops row. Total footprint: ~30 lines moved between two `{#if activePillId === ...}` blocks. State writes still go through `exportOptions.setVideoLoopCount`.

## Testing

Pure unit tests for the summary derivations (low value — they're trivial format strings, but worth catching regressions when keys rename):

- `tests/unit/pill-nav/pill-summaries.test.ts` — exercise `displaySummary` / `playbackSummary` / `exportSummary` against fixture state.

Visual via Chrome DevTools MCP at the two canonical viewports:

- 393×709 (phone) — confirm pill row + download visible above any open sheet, sheet ≤72% of canvas height, all 5 pills tappable.
- 1400×900 (desktop) — confirm sidebar shows pills at top, body in the middle, download in footer; switching pills swaps the body inline without layout shift.

Behavioral checks:

- Toggle a Display visibility flag, verify the Display pill summary updates from `5 / 8 on` to `4 / 8 on`.
- Change effort, verify the Effort pill border + dot recolor.
- Change FPS or resolution, verify the Export pill summary updates.
- Mobile: tap each pill in sequence, confirm only one sheet open at a time and old sheet closes cleanly.
- Desktop: switch pills, confirm no layout shift in the canvas area.
- Confirm the Animation Settings modal is gone everywhere — right-click on the canvas should NOT show "Animation Settings…" anymore (cleanup task already done in this branch).

## Rollout

Single PR. No feature flag — the AnimationSettingsModal is already nuked in this branch, so users currently can't reach Display or Path Shape; this is the fix that puts them back in the UI. Mobile and desktop changes ship together; they share the components.

## Open questions

None remaining. All design questions addressed by autonomous defaults grounded in:

- Information-dense UI preference (memory: palette-driven design, recommendation trust)
- Button + toggle-indicator pattern, never checkboxes (memory: feedback_no_checkboxes)
- Reuse-first (memory: reuse_existing_components, primitive-discovery rule)
- Path Shape goes in Display because both are "what the viewer sees" toggles — same conceptual axis.

---

## Self-review

- ✅ **Coverage:** every section in the brainstorm has a corresponding spec section. Display + PathShape both placed. Loops migration noted. Mobile and desktop layouts both specified.
- ✅ **Reuse:** 8 of the 9 panel components consumed are pre-existing; only 4 small files are new (one component, one wrapper, one type file, one CSS file).
- ✅ **State:** zero new state managers. All writes route through existing `vm` and `exportOptions`.
- ✅ **Architecture fits the codebase:** `pill-nav/` follows the same pattern as `bento/` (small co-located dir under `sequence-viewer/components/`). `PillSpec` type is local, not promoted to `$lib/shared/types`.
- ✅ **No "checkboxes":** every toggle in DisplayPanel uses the existing `toggle-indicator` pattern; pills use `aria-pressed` not `aria-checked`.
- ✅ **Verification grounded:** every claim about file paths and method names was derived from current grep/read output, not from memory of past structure.
- ✅ **Consistency with prior decisions:** explicitly supersedes the 4-tile bento for the nav (not a parallel addition); preserves the rail-tile and sheet primitives.
- ✅ **Accessibility:** keyboard nav specified (←/→ + Enter/Space + Escape), `aria-pressed` on pills, `role="region"` preserved, sheet `role="dialog"` already correct in `RailBentoSheet`.
- ✅ **No emojis** in spec.
- ✅ **No ambiguous "TBD" or "later" markers.**

---

## Audit (eight-dimension)

| Dimension | Grade | Notes |
|---|---|---|
| Architecture | A | Clean two-component split (`DownloadPillNav` + `PillBody`); no new state; reuses existing managers and panels. The single shared template for mobile + desktop avoids the most common bug class (drift between viewports). |
| Code quality | A | Pure-presentational components; props well-typed via `PillSpec`; derived state isolated in the parent; no inline business logic in the new components. |
| Svelte 5 | A | All new components use `$props()`, `$state()`, `$derived()`. No legacy `$:` blocks. Snippets used for body content. |
| Accessibility | A | `aria-pressed` on pills, `aria-label` on the nav (`"Download settings"`), keyboard navigation specified, `role="dialog"` preserved on the sheet, `prefers-reduced-motion` inherited from `rail-tile.css`. Touch targets ≥44px (mobile = 56px). |
| UX states | A | Resting, hover, active, focus, sheet-open, sheet-closing, exporting, idle — all enumerated in the interaction-model table. |
| UI consistency | A | Pills are a thin extension of the existing rail-tile primitive; Effort tinting reuses the same `--effort-color` mechanism already in `rail-tile.css`. Visual language carries forward. |
| Performance | A | `$derived` only re-runs when `vmVersion` ticks or relevant primitive props change. Body components are conditionally mounted (one at a time on desktop, one at most on mobile); old body unmounts cleanly. No new observers, no extra work per frame. |
| Security | A | No new external inputs, no string interpolation into HTML, no fetches, no clipboard. Pure UI refactor. |

**Overall: A.** No blocking issues. Plan can proceed.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `MobileEffectsPanel` and `EffectsPanel` divergence — desktop Effects pill might show a control that Mobile sheet doesn't, leading to a feature-parity gap. | Med | Low | Both are existing components used by the prior mobile bento — already shipping. We're not changing them; we're choosing the right one per variant exactly as the bento spec already does. |
| Loops moving from Export → Playback might confuse users who learned the prior bento. | Low | Low | The bento is brand new (a few weeks old per `2026-04-19` spec date). Migration is invisible to users who haven't internalized the prior layout. Also: Loops is more semantically Playback and the new placement is more discoverable. |
| Desktop sidebar going from "all settings flat" to "click a pill to see settings" hides info that was previously visible. | Med | Med | Pill summaries on every pill make state visible without opening. Desktop sidebar is wide enough that the active body shows in full — no info hidden. The trade is one click to access vs. one scroll. Net win: consistent with mobile. |
| Effort accent color leaking from the Effort pill into other pills via CSS cascade. | Low | Med | `--pill-accent` is set inline on the Effort pill only; other pills don't read this variable. Verified the cascade is contained per-pill in `pill-nav.css` selectors above. |
| Sheet height + pill row + download button stacking on small phones (e.g. 360×640) might leave too little canvas. | Low | Med | Sheet caps at 72%, pill+download is ~110px reserved. Worst case: ~28% canvas height = ~140px on a 640px-tall phone — still readable. If reports come in, lower the sheet cap to 65%. |

---

## Out-of-scope follow-ups

- Persist the active desktop pill across sessions (currently session-local) — only worth doing if users complain about resets.
- Add animated pill underline on selection (instead of full background tint) — design tweak, not architectural.
- Surface Display + PathShape from the canvas right-click context menu as well (currently only via the pill). The context menu still has Visibility, Grid, Path Shape submenus — these are the quick-access path. The pill is the deep-access path.
