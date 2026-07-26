---
status: active
value: 4
effort: L
remaining: "DRIFT 2026-07-25 — body contradicts its own frontmatter. The body status line says 'Spec — pending user approval' while this frontmatter has said since April that Phase 2 Task 11 (DestinationBadge) is the resume point of 14 tasks. 68 topical commits, 65 on its named files, landed since. The frontmatter is the accurate half; the body status line is 102 days stale. Re-establish the true resume point before continuing."
depends_on: ""
plan_path: plans/active/2026-04-15-sequence-viewer-redesign.md
tags: []
last_triaged: 2026-04-26
---
# Sequence Viewer Redesign + Per-Performer Foundation

**Date:** 2026-04-15
**Status:** Spec — pending user approval
**Predecessors:** Earlier 3D viewer chrome work that introduced floating chip controls, orphaned `EffectsSettingsPanel`, and the chip-jump 2D/3D toggle problem.

> **DRIFT WARNING (2026-07-25) — the status line below contradicts this file's
> own frontmatter.** The body says 'pending user approval'; the frontmatter has
> recorded Phase 2 Task 11 (DestinationBadge) as the resume point since April,
> and 68 topical commits (65 on this spec's named files) landed since.
>
> **The frontmatter is the accurate half.** Re-establish the true resume point
> against the code before continuing — do not restart from Phase 1.


---

## 1. Goals

Resolve three intertwined problems with the current 3D sequence viewer:

1. **Identity drift.** The viewer was originally a playback surface and is being asked to become a multi-performer choreography editor. The result: chrome that fights itself, orphaned components, and unclear user mental model.
2. **Capability lies.** Effects exist in code but are visible-and-disabled in UI. Per-performer attributes (effort, prop) are theoretically possible but globally overridden in practice. Users see affordances they can't actually use.
3. **Chrome polish.** The current top-right chip cluster lacks visual hierarchy, popovers don't stomp each other, the 2D/3D toggle teleports across modes, and stray fly/walk/orbit chips appear in playback contexts where they have no purpose.

This spec resolves all three by:

- Establishing a clean **Sequence Viewer ↔ Stage** destination split (Stage being a future destination for multi-sequence choreography work).
- Building the per-performer effort + prop + effects foundation in the viewer (the same foundation Stage will inherit).
- Polishing viewer chrome to a vertical-right-rail layout with mutually exclusive popovers and proper visual identity.
- Documenting the destination distinction technique so users can never get confused about which tool they're in.

## 2. Out of scope (explicitly)

To keep this spec implementable in one focused arc:

- **Stage destination itself.** This spec defines the *bridge* to Stage and the *per-performer foundation* that Stage will use, but does not build Stage's UI, multi-sequence assignment, timeline, stagger, or audio. Stage is its own follow-on spec.
- **3D Sequence Cell in the arrange tab.** Discussed during brainstorming. Decided to defer to its own spec because it has cell-config UX that needs separate design work.
- **Composer (the existing 2D arrange-tab tool)** stays exactly as it is.
- **Mobile-specific layout polish.** The chrome will work on mobile but mobile-first refinement (gesture interactions, etc.) is a separate effort.
- **Animated destination-transition (chips slide off, dock rises).** This is part of how we'll signal Viewer↔Stage moves later. For this spec we deliver the static distinction (badge, URL, chrome shape, info chip) and add the transition when Stage ships.
- **Renaming any existing references to "Composer."** The compose module keeps its name. Stage is named explicitly to avoid collision.

## 3. Naming (canonical)

| Name | Refers to |
|---|---|
| **Compose module** | Existing 2D multi-cell arrange tool. Unchanged. |
| **Sequence Viewer** | The destination this spec redesigns. Plays one sequence; supports 1–N performers in unison. |
| **Stage** | Future destination. Multi-sequence choreography editor. |

"Composer" is reserved for the existing module. Never use it for the new 3D destination.

## 4. The Viewer ↔ Stage split (canonical table)

This is the contract. All UX decisions derive from it.

| | **Sequence Viewer** | **Stage** *(future)* |
|---|---|---|
| Sequences | Exactly 1 (the one opened) | N (different per performer) |
| Performers | 1 to N, all locked to the one sequence in unison | N independent |
| Choreo card | Always shown, always accurate | Hidden or replaced with multi-track legend |
| Per performer | Effort, prop, effects, position | Sequence, effort, prop, effects, position, stagger |
| Camera | Orbit only | Orbit + fly + walk |
| Audio | None | Beat-synced music track |
| Timeline / scrubber | Shared scrubber for the one sequence | Multi-track timeline with stagger |
| Stagger | None — beat 1 = beat 1 across all | Per-performer offset |
| Export | Yes (record what's on screen) | Yes (record full scene) |
| Mental model | "Spotify in 3D" | "Ableton for movement" |

**The principle:** the Viewer never shows affordances for things it can't do. There is no greyed-out "different sequence per performer," no "Pro feature," no tooltip explaining why something's missing. Composer-only capabilities don't exist in the Viewer's vocabulary.

## 5. Capability levels (used for embedding decisions)

For future reference — any 3D surface in the app falls into one of three levels:

| Level | Name | Capabilities |
|---|---|---|
| **L1** | Playback | Press play. Camera maybe. No mutation. |
| **L2** | Viewer | Add/remove performers, change per-performer effort/prop/effects, camera orbit. **Cannot change the sequence itself.** |
| **L3** | Stage | Multi-sequence, timeline, stagger, audio, full editing. |

Sequence Viewer = L2. Stage = L3. A future 3D Sequence Cell in arrange tab = L1 in playback, L2 when configured.

## 6. Sequence Viewer chrome design

### 6.1 Header (top edge, full width)

Three balanced regions, no orphans:

- **Left:** `← Back · 2D | 3D toggle`
- **Center:** `[VIEWER badge] Sequence Title` *(badge is a small low-contrast pill; title is the sequence name from data, not "Record Scene")*
- **Right:** `info chip (i)` — opens the destination explainer popover

The `2D | 3D` toggle lives **only** in the header. It is removed from `ViewerFooter` and `RecordSceneChrome`. Single home. Stops teleporting between modes.

The `VIEWER` badge is always visible and uses the same visual treatment Stage will use for its `STAGE` badge — same shape, same position, different label and accent color.

### 6.2 Vertical right rail (top to bottom)

Four chips, **icon-only with tooltip** (text labels overflow at 56px). One popover at a time. Each popover reuses existing components — never invents new control vocabulary.

1. **Performers** (icon: `fa-users`) — chip strip + sub-tabs (see 6.3) — **new container, existing sub-components**
2. **Tempo** (icon: `fa-music` or `fa-drum`) — wraps existing `BpmChips` (full variant) **only**. BPM + ±adjust + tap-tempo button + 6 preset chips. **No FPS here** — FPS is an export concern, not a playback concern (see §6.6). **Play/pause and the scrubber do NOT live here.** Those are in the always-visible bottom transport bar (see §6.7). Step-through is dropped entirely from the viewer — tap-to-seek on the scrubber handles precision when needed.
3. **Export** (icon: `fa-film`) — uses real `export-options-state` fields, narrowed to what applies to 3D recording: **Resolution** (720/1080/4K/8K), **Quality** (Standard/Cinema — cinema = 2× supersampling + 4× temporal motion blur), **FPS** (30/60/120). `loopCount` is collapsed into an "Advanced" expander. Estimate row shows time + file size. **`includeStartPosition` and `includeEndHold` are NOT in the 3D export popover** — those are 2D-viewer features tied to its auto-start/auto-stop recording flow; 3D recording is free-form (user presses Record, performs/scrubs, presses Stop) so they don't apply. If a 2D export popover is ever added, those toggles live there.
4. **Gear** (icon: `fa-gear`) — wraps `Viewer3DGearPopover` with a **three-tab** bar: **Camera** (view presets, unchanged), **Planes** (hand-plane assignments, unchanged), **Scene** (redesigned — see below). The existing Performers tab is **removed from gear** (replaced by the rail's Performers chip). The **Visibility tab is also removed entirely** — its toggles (`props`, `stepNumbers`, `tkaGlyph`, `wordHeader`, `progressBar`) are 2D-viewer overlays that don't render in the 3D scene; `Viewer3DVisibilityToggles.svelte` is left in the codebase (other consumers rely on it) but is NOT mounted in this popover. If/when a 2D-viewer gear popover is built, those toggles live there. The "Stage this scene →" bridge button is appended as a footer below the tab content.
   - **Scene tab redesign:** tile grid (not chip row). Each tile shows a thumbnail / mini-render of the 3D object it toggles, a label, and a status dot that lights up in the feature's accent color when active. Off state: desaturated + dim thumbnail. On state: full-color thumbnail, glowing border, lit status dot. Async features (Audience, Environment) get a shimmer while their 3D asset loads. Thumbnail implementation: start with hand-authored preview images per feature (`/images/scene-thumbs/stage.png` etc.); upgrade to runtime render-to-texture snapshots later if needed. `SceneFeatureToggles.svelte` is rewritten for the tile layout — the 6-chip version is retired.
   - **Scene feature list is 5, not 6.** Active tiles: Stage, Audience, Environment, Campfire, Tent. The **Grid toggle is removed entirely** — it was a hand-me-down from the 2D viewer (where it controlled the 2D reference grid), carried into 3D by mistake. In 3D, the **Planes** system natively replaces it: planes carry the reference-grid role per-hand, with proper 3D geometry. `SCENE_FEATURES` in `scene-feature-registry.ts` drops the `grid` entry as part of this work.

Rail is glass-chip styled (translucent dark, soft border, subtle shadow). Chips show icon + short label. Active chip gets a stronger accent. Hover/click animations exist and feel premium (the "dopamine on click" the user flagged as currently missing).

### 6.3 Performer popover (the unified per-performer surface)

Opens to the left of the Performers chip. Contents:

- **Performer chip strip across the top:** `[All] [1] [2] [3] ... [+]`
  - Each numbered chip shows the performer's color and a small dot indicating their current effort
  - `All` is a pseudo-performer that represents bulk-set (preserves current global-override behavior)
  - `+` adds a new performer
  - Right-click or long-press a numbered chip = remove (with confirm if performers > 1)
- **Sub-tabs below the chip strip:** `Prop | Effects | Effort`
  - Each sub-tab shows the controls for the **selected** performer (or all, if `All` is selected)
  - **Prop** sub-tab: prop type picker (staff, club, fan, poi, etc.)
  - **Effects** sub-tab: **8 real effect toggles — Trails, Fire, Charcoal, LED, Zap, Sparkles, Motion, Glow.** Revised from an earlier 4-effect scope once we verified what ships in the 3D renderer: the legacy 3D-only system (`src/lib/shared/3d/effects/`) has `ElectricityArc.svelte` (Zap), `sparkles`, `motion`, and `bloom` (Glow) wired into `EffectsLayer.svelte` and toggleable in the orphan `EffectsSettingsPanel` — they're not stubs, they're shipped. The unified intent layer (`src/lib/shared/effects/`) has Trails, Fire, Charcoal, LED with both 2D + 3D translators. **The viewer Effects sub-tab exposes all 8.** The 2D-parity story: Zap/Sparkles/Motion/Glow need `*Intent` types added to the unified layer plus 2D canvas renderers built so they render in cards, print, and everywhere pictographs appear — tracked as follow-through §14. No "coming soon" pills; all 8 are on from day one in 3D and iteratively get their 2D parity as each intent ships.
    - Effect registry (color / icon / key): Trails `#a855f7 fa-route trails` · Fire `#f97316 fa-fire fire` · Charcoal `#78716c fa-pen-nib charcoal` · LED `#4ade80 fa-lightbulb led` · Zap `#38bdf8 fa-bolt electricity` · Sparkles `#fbbf24 fa-star sparkles` · Motion `#22d3ee fa-wind motion` · Glow `#f472b6 fa-sun bloom`.
    - Param drawer: double-click an active effect opens its param drawer (matches today's `EffectsSettingsPanel` double-click-to-expand behavior) — e.g. trails gets intensity/color-mode, fire gets intensity, zap gets intensity/segments, etc. Params are per-effect, not per-performer.
  - **Effort** sub-tab: existing 8-effort palette (`EffortPalette`) — user picks a named effort and that's it. **Per-effort parameters (weight, time, amplitude, etc.) are NOT user-facing in the viewer.** The engine uses the default param values defined in `EFFORTS` (`effort-types.ts`). Parameter tuning, if ever exposed, lives in `effort-lab` — not here.

This single popover replaces three potential separate popovers. Tighter mental model, fewer chips on the rail.

### 6.4 Mutually exclusive popovers

Opening any rail popover closes any other open popover. Implementation: shared popover-stack state in `viewer-3d-state`. Currently: opening Export with Playback open results in both being visible. Spec: only one rail popover open at any time. Header info chip is also in the same stack.

### 6.7 Bottom transport bar (always visible)

Thin glass bar pinned bottom-center of the viewport. Contains:

- **Play/pause button** (primary, larger — ~48px)
- **Progress scrubber** (flex-fill, tap-to-seek, drag-to-scrub)
- **Loop toggle** (small chip, on/off)
- Elapsed/total time label (optional, `0:03.2 / 0:08.0`)

Step-through (prev/next beat) is NOT included — tap anywhere on the scrubber to seek. The scrubber's beat markers (subtle dots along the track) communicate sequence structure without dedicated buttons.

Bar auto-hides during idle playback after ~2s of cursor inactivity (like video players). Any mouse movement or keyboard input brings it back.

### 6.5 Removed elements

- **Fly/walk/orbit chip cluster (`NavModeToggle`).** Removed from Viewer entirely. Orbit is the only camera mode here. The component itself stays in the codebase because Stage will use it.
- **`Viewer3DEffectPills`** (the disabled "Coming soon" pills). Deleted entirely. Replaced by the Effects sub-tab in the Performer popover.
- **`RecordSceneChrome`'s embedded `RenderModeToggle`.** Removed (toggle now lives in header).
- **`ViewerFooter`'s embedded `RenderModeToggle`.** Removed (same).
- **The "Record Scene" title.** Replaced by the actual sequence title in the header center.

### 6.6 Top-left

Empty. Period. The chrome that used to live there (mode chips, extra toggle) is gone. Clean canvas on the left.

## 7. Per-performer foundation

Currently efforts and effects are global overrides applied to all animations. To deliver the Viewer's promise ("8 versions of me, 8 efforts, side by side") we need per-performer plumbing.

### 7.1 Data shape

Extend `viewer-3d-state.svelte.ts` to track per-performer attributes:

```ts
interface PerformerSettings {
  effortId: EffortId;           // one of the 8 Laban efforts
  effortParams: EffortParams;   // tuning for the chosen effort
  prop: PropType;               // staff, club, fan, poi, ...
  effects: Set<EffectId>;       // which effects are active
}

interface ViewerState {
  performers: Map<PerformerId, PerformerSettings>;
  // ... existing fields (position, plane assignments, etc.)
}
```

When `All` is the active selection in the Performer popover, mutations are broadcast to every performer (preserving existing global-override behavior as a special case).

### 7.2 AnimationEngine API change

`AnimationEngine` currently accepts a single global effort. Change signature to accept a `(performerId) => EffortId | EffortParams` resolver. Default implementation: the existing global behavior (read from the current global setting). New implementation: read from `viewer-3d-state.performers[id].effortId`.

Maintain backward compatibility: anywhere the engine is called without a per-performer resolver, it continues to use the global effort.

### 7.3 Prop foundation

Same pattern. Prop type becomes a per-performer attribute. Renderer (`Staff3D` and friends) reads from per-performer state; defaults to the existing global if no per-performer override is set.

Note: the existing `bluePropState = red visual prop in 3D` color-swap memory still applies. The swap happens at the render layer regardless of per-performer prop type.

### 7.4 Effects foundation

`EffectsSettingsPanel` (currently orphaned) is wired to the Performer popover's Effects sub-tab. Toggles read/write from the **selected performer's** `effects` set (or all performers when `All` is the active selection). The `tipEffectMap` synchronization rule (existing memory) is preserved: when an effect toggles for a performer, that performer's `tipEffectMap` updates accordingly so the renderer doesn't filter out all tips.

### 7.5 Default state

A fresh viewer load:
- 1 performer (performer 1)
- Effort = whatever the sequence defines (or `linear` if unset)
- Prop = whatever the sequence defines (or app default)
- Effects = none active

Adding a 2nd performer: copies performer 1's settings as the starting point, then can be edited independently.

## 8. Bridge to Stage

### 8.1 Where the bridge lives

In the **Gear popover**. Not on the main rail. Reasoning: the bridge is a deliberate context-shift action, not a frequent operation. Burying it one level deep keeps the rail focused on viewer-scoped tasks.

Button text: **"Stage this scene →"**

### 8.2 What the bridge does (when Stage exists)

- Opens the Stage destination at `/stage/[sceneId]` (new URL prefix).
- Pre-loads the current sequence as performer 1's assignment.
- Carries over per-performer effort/prop/effects/position from the viewer state.
- Does **not** carry back any Stage-side changes to the viewer if the user returns. The two destinations don't share live state.

### 8.3 No reverse bridge

Stage does **not** offer a "back to Viewer" button. The viewer is for one sequence; Stage is for many. Going back from Stage means returning to the library or the page they came from. This asymmetry is intentional — viewer → Stage is a forward step, not a sideways toggle.

### 8.4 Stub for now

For this spec, the bridge button is added to the Gear popover but its action is `console.log("Stage destination not yet built")` or shows a "Coming soon" toast. The button placement and label are correct so we don't have to rearrange anything when Stage ships.

## 9. Destination distinction (the layered redundancy)

To make Viewer vs Stage unambiguous without explanatory text:

1. **Persistent destination badge** in header (`VIEWER` or `STAGE`).
2. **Structurally different chrome.** Viewer = vertical right rail. Stage (future) = bottom dock + left panel. Silhouettes are distinct.
3. **Different URL prefix.** `/sequence/[id]` vs `/stage/[sceneId]`.
4. **Subliminal background tint.** Viewer = current dark canvas. Stage = same canvas with a subtle warm stage-light vignette.
5. **Bridge button names its destination.** "Stage this scene →" prepares the brain.
6. **Animated transition when bridging** (deferred to Stage spec — see Out of scope §2).
7. **Info chip in header** opens a one-screen explainer. *(See §10.)*
8. **Affordance absence.** Viewer never shows greyed-out Stage controls. The capability simply doesn't exist in its vocabulary.

For this spec we ship #1, #3, #5, #7, #8. Items #2 and #4 require Stage to exist. Item #6 is its own animation work.

## 10. Info chip explainer

A small `i` chip in the header opens a popover with one-screen explainer copy:

> **Sequence Viewer**
>
> Watch one sequence, performed by 1 to N versions of you, each with their own effort, prop, and effects. Same choreography, different interpretations.
>
> *Want different sequences per performer, with timing and music? → **Open in Stage***

The explainer popover is in the same mutually-exclusive popover stack as the rail popovers (opening it closes Performers, etc.).

The "Open in Stage" link in the explainer is the same action as the Gear popover's bridge button (until Stage ships, it's a stub).

## 11. Specific bug fixes / cleanups bundled with this spec

Each one is small but worth listing so nothing slips:

1. ✅ **Popover stomping.** Single popover-stack state. Opening any popover closes any other. Estimated: small (~5 lines + state field).
2. ✅ **2D/3D toggle has one home (header).** Remove from `ViewerFooter` and `RecordSceneChrome`. Add to header next to Back.
3. ✅ **Effects panel wired in.** `EffectsSettingsPanel` lives inside Performer popover's Effects sub-tab.
4. ✅ **Delete `Viewer3DEffectPills`.** Disabled stubs serve no purpose.
5. ✅ **Remove `NavModeToggle` from Viewer chrome.** Component stays in codebase for Stage.
6. ✅ **"Record Scene" title replaced** with sequence title.
7. ✅ **Top-left empty.** No orphan controls.

## 11.5 Component reuse contract (HARD REQUIREMENTS)

**Forbidden in this work:**
- Invented effect names, icons, or colors. Effects are defined in `EffectsSettingsPanel.svelte:15-22`. Use them verbatim.
- Invented prop types, SVG glyphs, or images. Props are defined in `PROP_TYPE_DISPLAY_REGISTRY` (`PropTypeDisplayRegistry.ts`). Real SVGs live at `/images/props/buttons/{name}.svg`. Use the registry, never invent.
- iOS-style toggle switches anywhere. The chip pattern from `feedback_no_checkboxes.md` is canonical: pill buttons with `aria-pressed`, `color-mix(in srgb, var(--theme-accent) 20%, transparent)` active background.
- Touch targets below `var(--min-touch-target)` (= 44px) in popover controls. Viewport-overlay chrome (rail chips) may use `var(--min-touch-target-compact)` (= 32px).
- Emoji as functional icons. Use FontAwesome (`<i class="fas fa-X">`) — it's already in the project.

**Required reuse:**
| Concern | Existing component to reuse | Source |
|---|---|---|
| Effects sub-tab | `EffectsSettingsPanel.svelte` (after stub-removal + LED add) | `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte` |
| Playback popover content | `BpmChips.svelte` (full variant) + `PlaybackControlBar.svelte` | `src/lib/features/compose/components/controls/BpmChips.svelte`, `src/lib/shared/3d/components/controls/PlaybackControlBar.svelte` |
| Gear popover content | `Viewer3DGearPopover.svelte` tab structure (sans Performers tab) | `src/lib/shared/3d/components/Viewer3DGearPopover.svelte` |
| Effort sub-tab | `EffortPalette.svelte` | `src/lib/features/phrase-effort-lab/components/EffortPalette.svelte` |
| Prop sub-tab | `BentoPropGrid.svelte` with `variant="inline"` | `src/lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte` |
| Performer chip strip | `PerformerChipStrip.svelte` | `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte` |
| Effect colors / labels | `effectChips` constant | `EffectsSettingsPanel.svelte:15-22` |
| Effort definitions | `EFFORTS` constant | `src/lib/features/effort-lab/domain/effort-types.ts` |
| Prop list | `PROP_TYPE_DISPLAY_REGISTRY` + `BentoPropGrid` family groupings | `PropTypeDisplayRegistry.ts` |
| Touch target | `var(--min-touch-target)` (44px) for popovers, `var(--min-touch-target-compact)` (32px) for overlay | `src/app.css:237-239` |

**Effects sub-tab nuance:** `EffectsSettingsPanel` already supports per-effect sub-controls (Trails has Color and Track mode chips, intensity slider on double-click). Wire it as-is, only changing the data source from global config to per-performer effects state.

**Prop sub-tab nuance:** `BentoPropGrid` already handles family grouping, variant drawer, and active-prop selection. The only change is the data source (per-performer prop, not global).

**Effort sub-tab nuance:** `EffortPalette` already implements the chip grid with `min-height: var(--min-touch-target)` and `color-mix` active states. No subtitles, no swatches, no parameter sliders. The component is correct as-is.

## 12. Files that change

(Concrete file list — to be refined during plan-writing, but anchoring scope now.)

**Modified:**
- `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` — destination badge, info chip, gear-popover bridge stub
- `src/lib/shared/sequence-viewer/components/ViewerHeader.svelte` — add 2D/3D toggle here
- `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte` — remove 2D/3D toggle
- `src/lib/shared/sequence-viewer/components/record-scene/RecordSceneChrome.svelte` — remove embedded 2D/3D toggle, remove "Record Scene" label, remove Playback/Export popover dependencies (those move to the rail)
- `src/lib/shared/3d/components/Viewer3DCanvas.svelte` — remove `NavModeToggle` mount, mount the new vertical right rail
- `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` — extend with per-performer settings map, popover-stack field
- `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` — accept per-performer resolver
- `src/lib/shared/3d/state/avatar-instance-state.svelte.ts` — read per-performer prop/effort from viewer state

**New:**
- `src/lib/shared/sequence-viewer/components/RightRail.svelte` — the vertical chip rail
- `src/lib/shared/sequence-viewer/components/PerformerPopover.svelte` — the unified per-performer surface (chip strip + sub-tabs)
- `src/lib/shared/sequence-viewer/components/InfoChipPopover.svelte` — the destination explainer
- `src/lib/shared/sequence-viewer/components/DestinationBadge.svelte` — VIEWER pill (designed to match future STAGE pill)

**Deleted:**
- `src/lib/shared/3d/components/Viewer3DEffectPills.svelte` — disabled stubs

**Reused as-is:**
- `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte` — wired into PerformerPopover's Effects sub-tab
- `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte` — used in PerformerPopover header
- `src/lib/features/effort-lab/components/...` — `EffortPalette` and friends used in PerformerPopover's Effort sub-tab
- `src/lib/shared/3d/state/performer-manager.svelte.ts` — extended with per-performer settings access

## 13. Decisions made during brainstorming (audit trail)

For future-us, here's what we explicitly decided and why, so we don't relitigate in implementation:

1. **Dock-on-bottom timeline lanes (DAW-style) — REJECTED for v1.** Originally the user picked Option C (timeline lanes) for a multi-performer dock. Then realized the v1 model is "everyone in sync, beat 1 = beat 1." Timeline becomes unnecessary. Lanes are deferred to Stage spec.
2. **Multi-performer in viewer — KEPT.** Initially considered restricting viewer to 1 performer to keep things simple. Reversed when realizing "1 sequence performed by 8 versions with different efforts" is exactly the demo moment that sells the system, *and* the choreo card stays accurate as long as everyone does the same choreography.
3. **Effort = single slider — REJECTED.** The user has an existing 8-Laban-quality `EffortPalette` system with per-effort params. Use that, not a slider.
4. **Renaming "effort" to "styles" — REJECTED.** Considered briefly. The "efforts" terminology has codebase and domain investment. Don't trade vocabulary equity.
5. **Per-performer foundation — IN SCOPE.** More work than wiring up the existing UI to global state, but unblocks both the viewer's wow moment AND Stage's foundation.
6. **Per-performer prop — IN SCOPE.** Same justification: cheap once you've broken the global-override pattern, and unlocks the "this sequence works on staff AND clubs" teaching tool.
7. **Stage in arrange-tab cells — REJECTED.** Embedding L3 (full Stage editing) in a cell breaks the artistic intent of the parent composition. Cells get L1/L2 (Sequence Cell) at most. To embed a Stage, render it as a video and use a video cell.
8. **Naming the new destination — "Stage" chosen.** "Composer" is taken. "Studio" / "Director" / "Choreographer" considered. "Stage" wins on brevity, distinctness, and metaphor fit.
9. **Vertical right rail vs full-width header chips vs bottom action bar — vertical rail chosen.** Best fit for chip count, keeps header semantically clean (nav only), popovers don't cover controls, easiest to make beautiful.
10. **Bridge from Stage back to Viewer — does NOT exist.** One-way bridge. Stage is a forward step.
11. **Effort parameters are NOT user-facing in the Viewer.** User picks a named effort; engine uses default params. Reduces UI surface, keeps the choice meaningful (you're picking a *quality*, not tuning a curve). Param tuning stays in `effort-lab`.
12. **Effects ground truth is the shipped 3D renderer code, verified by reading `EffectsLayer.svelte` and peers.** Initial read-through trusted `project_3d_effects` memory (Trails/Fire/Charcoal/LED only) and dismissed the orphan `EffectsSettingsPanel`'s other four as stubs. Re-verification found `ElectricityArc.svelte` (Zap) is fully wired with intensity/segments params, and Sparkles/Motion/Bloom are actual `EffectsLayer`-rendered effects. All 8 exist in 3D. The real split is: 4 effects (Trails, Fire, Charcoal, LED) live in the unified `shared/effects/` layer with 2D + 3D translators; 4 effects (Zap, Sparkles, Motion, Glow) live in the legacy `shared/3d/effects/` layer, 3D-only, awaiting migration. **Cross-check memories against actual code when they contradict visible UI — memories decay, code is authoritative.**
13. **Rail chips are icon-only with tooltips.** "PERFORMERS" overflows a 56px chip. Icon + `aria-label` + hover/long-press tooltip is the right pattern.

## 14. Follow-through (queue of related specs and work)

Things we discussed but punted. Each gets its own future spec when its turn comes:

| Priority | Item | Notes |
|---|---|---|
| Next | **Stage destination** | Multi-sequence editing, timeline, stagger, audio, multi-track scrubber, per-performer sequence assignment. The whole L3. |
| Next | **3D Sequence Cell type for arrange tab** | L1/L2 cell that embeds a Sequence Viewer state into a composition. Cell-config UX needs design. |
| After Stage | **Animated destination transition** | Chips slide off, dock rises, badge swaps. ~250ms transition between Viewer and Stage. |
| After Stage | **Stage background tint vignette** | Subliminal warm stage-light vignette to differentiate Stage canvas from Viewer canvas. |
| Anytime | **Mobile-specific chrome polish** | Gesture interactions, thumb reach, portrait/landscape transitions. |
| Anytime | **`Viewer3DGearPopover` cleanup** | Right now it's a multi-tab popover with Scene/Planes/etc. Move some content into the main Performer popover, leave Gear as world/scene-only. |
| High | **2D parity for Zap / Sparkles / Motion / Glow** | These four 3D effects exist in `shared/3d/effects/` but are missing from the unified intent layer. Scope: add `ElectricityIntent`, `SparklesIntent`, `MotionIntent`, `GlowIntent` types to `shared/effects/`; port their 3D renderers to the unified translator pattern (matching Trails/Fire/Charcoal/LED); build 2D canvas renderers so they apply globally — cards, print, deck browser, mandalas, gallery thumbnails, everywhere effects are visible. Retires the legacy `shared/3d/effects/` system. User mandate: "if we have a 3D effect we need to create it in 2D and make it apply globally." |
| Incidental | **2D Electricity effect** | Sub-item of the parity work above. User pitched emanating-lightning-from-tips as 2D+3D pair. Already exists in 3D (`ElectricityArc.svelte`, arc + crackle modes, tip↔tip + per-tip crackles); 2D version is the new work — midpoint-displacement SVG/canvas stroke between the two prop tips plus per-tip radiating crackle arms. |

## 15. Validation criteria

How we know this spec succeeded:

- 2D/3D toggle never moves between modes.
- No fly/walk/orbit chips visible in Sequence Viewer (in any mode).
- No greyed-out / "coming soon" controls anywhere in viewer chrome.
- Effects are togglable per performer; toggling actually changes what renders.
- Effort palette is per performer; selecting a different effort for performer 2 changes only their movement quality.
- Prop type is per performer; setting performer 2 to a fan and performer 3 to a club shows them with the right props simultaneously.
- Opening any rail popover closes any other open popover.
- Header always shows: Back · 2D/3D toggle · `VIEWER` badge · sequence title · info chip.
- Top-left of viewer canvas is empty.
- "Stage this scene →" appears in the Gear popover (stub action OK).
- Info chip explainer opens and reads correctly.
- A user can spawn 8 performers, give each a different effort, hit play, and watch them dance the same choreography in unison with visibly distinct movement qualities.

## 16. Open questions

These don't block the spec but should be answered during implementation:

1. **Maximum performer count.** Visual / performance limit. Eight is the demo target; rail UI starts to crowd above ~12. Pick a hard cap (suggest 16) and a soft warning.
2. **Performer color assignment.** Currently performer 1 = blue, performer 2 = red. With N performers, what's the color palette? Suggest: a 16-color cycle that maintains contrast against the scene background.
3. **What happens when a sequence is deleted from the user's library while the viewer has it open?** Viewer should fail gracefully — show a "this sequence is no longer available" message rather than crashing.
4. **Effort param overrides — saved with sequence or local to viewer session?** If saved with sequence, they affect playback elsewhere; if local, they reset on reload. Suggest: local for now, with a "save to sequence" gesture later.
