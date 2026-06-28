# Practice Setup Flow — Design Spec

**Date:** 2026-06-27
**Project:** [[project_practice_rehaul]] (T2)
**Status:** Approved design, ready for implementation plan

## Goal

Give practice mode an explicit **setup screen** on entry: default-ready (one click to Start), with quick ramp presets and a Custom path. Once started, the running cockpit bar is minimalist — no ramp config duplicated in it. Stopping returns to the setup screen so you can re-tune and Start again. Leaving practice mode is a separate action. The setup pane is architected to host a future Camera-background toggle ([[project_practice_camera_overlay]]) without rework.

## Why

Today `handlePracticeStart` jumps straight into a running ramp; ramp config was crammed into the running bar (awkward, and the in-bar config popover fought the transformed `.practice-bar-rise` ancestor). Splitting entry into **Setup → Running** gives a clean configure-then-go flow, restores a minimalist running bar, and moves all config to a context (the companion pane) where it lays out cleanly.

## State Machine (core change)

Introduce `practicePhase: "off" | "setup" | "running"` in `playback-controller.svelte.ts` (a `$state`).

| Concept | Definition |
|---|---|
| `practiceActive` (getter, redefined) | `phase !== "off"` — "in practice mode". Keeps every existing rail/footer/overflow/header active-highlight + toggle working unchanged. |
| `practiceRunning` (new getter) | `phase === "running"` — orchestrator active (was the old meaning of `practiceActive`). |

Transitions:
- `enterPracticeMode()` → `phase = "setup"`. Does **not** start the orchestrator. Canvas stays in its normal (non-ramp) playback state.
- `handlePracticeStart()` (the setup-pane Start button) → existing body (orchestrator.start + loop + play) **plus** `phase = "running"`.
- `handlePracticeStop()` (running cockpit Stop) → stop orchestrator, show completion, `phase = "setup"` (not off).
- `exitPracticeMode()` → if running, stop orchestrator; `phase = "off"`.

Every Practice toggle (header / rail / overflow / bottom-bar) changes from `practiceActive ? handlePracticeStop : handlePracticeStart` to `practiceActive ? exitPracticeMode : enterPracticeMode`. (`practiceActive` now meaning in-mode, so the toggle enters/exits the whole mode; the active highlight already keys off `practiceActive`.)

Expose on the orchestrator ctx (`SequenceViewerOrchestrator.svelte`): `practiceRunning`, `enterPracticeMode`, `exitPracticeMode` (keep `handlePracticeStart`, `handlePracticeStop`).

## Companion Pane Switches by Phase

`ViewerSplitPane.svelte` line ~629 (`{#if practiceActive}`) becomes a three-way switch on the new props:
- in-mode + `practiceRunning` → `PracticeLanePane` (unchanged).
- in-mode + setup → **new `PracticeSetupPane`**.
- off → normal canvas (unchanged).

Pass `practiceRunning` into `ViewerSplitPane` alongside `practiceActive`. The cockpit bar wrapper (`.practice-bar-rise`, both hosts) gates `class:up` / `inert` on `practiceRunning` (only the running bar slides up; in setup there's no transport — Start lives in the setup pane).

## New Component: `PracticeSetupPane.svelte`

Lives in `src/lib/shared/sequence-viewer/components/`. Renders inside the companion pane. Contents, top to bottom:

1. **Preset selector** — a `SegmentedControl` (single-select, per `chip-primitives.md`): **Creep** / **Staircase** / **Custom**. Not hand-rolled chips.
   - Creep → config `{ increment: 1, roundsPerLevel: 1 }`.
   - Staircase → `{ increment: 5, roundsPerLevel: 5 }`.
   - Custom → reveals the ramp form below.
2. **Ramp form (Custom only)** — `RampConfigForm` (see Reuse). Start tempo / Loops per speed-up (X) / BPM per speed-up (Y) / Goal toggle + Goal tempo / plain-language hint.
3. **Camera-background slot** — an extension point in the layout for the future toggle. **Not shipped as a dead control** (no fake stub per `cruft` honesty); the pane reserves the row and the prop interface so [[project_practice_camera_overlay]] drops in. Nothing rendered until that feature lands.
4. **Start ▶** — a large primary button (reuse the existing button primitive) → `onStart` → `handlePracticeStart`.

Preset preselection: on mount, match persisted `practiceState.userConfig` to a preset (`increment`/`roundsPerLevel` equal Creep or Staircase) → highlight it; otherwise **Custom**. Picking a preset writes through `onSetConfig` (`handlePracticeSetConfig` → patches orchestrator + persists `userConfig`), so the choice survives sessions and feeds `start(userConfig)`.

Props: `config: Partial<TempoPracticeConfig>`, `onSetConfig: (patch) => void`, `onStart: () => void`. Both hosts pass `ctx.practiceState.userConfig` / `ctx.handlePracticeSetConfig` / `ctx.handlePracticeStart`.

## Reuse (never-hand-roll justifications)

- **Preset selector** → `SegmentedControl` (`src/lib/shared/3d/components/controls/SegmentedControl.svelte`) — single-select group with the sliding indicator, exactly the routing rule for "exactly one active".
- **`RampConfigForm.svelte` (new, extracted)** → lift the stepper rows + goal switch + hint out of `PracticeConfigPopover.svelte` into a standalone form consumed inline by `PracticeSetupPane`. Justified: no standalone ramp-config form exists; the rows are currently trapped inside the popover. Internal `stepper` snippet, `goal-toggle` switch (button + knob, not a checkbox — `no-checkboxes.md`), and `hint` move verbatim.
- **Start button** → existing button primitive (no new button).
- **Steppers / switch / fill** → existing patterns.

## Cockpit Bar Becomes Minimalist

`PracticeBar.svelte`:
- **Remove** the in-bar `PracticeConfigPopover` gear + its `config`/`onSetConfig` props and the divider added for it (config now lives in setup).
- **Add** a Stop control: `■ Stop` → `onStop` (`handlePracticeStop` → returns to setup). Keep play · `−Y Slower` · `BPM ▾` · `+Y Faster` · `❄ Hold`.
- **Keep** the BPM popover (live retune while running) — already converted to the plain `Popover.Content` + `Popover.Portal` + `:global` panel form (matches the working `ContextMenu`), so it survives the transformed `.practice-bar-rise`.

Final bar: `play │ [−Y Slower] [BPM ▾] [+Y Faster] │ ❄ Hold │ ■ Stop`.

## Retire `PracticeConfigPopover`

With config living in the setup pane, the gear popover has no remaining consumer:
- Remove its usage from `RouteViewerHeader.svelte`, `SequenceViewerDrawerHost.svelte`, and `PracticeBar.svelte` (3 sites).
- After extracting `RampConfigForm`, **delete `PracticeConfigPopover.svelte`** (verify no other importer first — `verify_before_deleting`). This also removes the portal/`:global` workarounds that file needed.
- Drop the now-unused `practiceConfig` / `onPracticeConfigUpdate` props from `RouteViewerHeader` and the header gear plumbing.

## Flow Summary

```
[normal viewer] --Practice toggle--> [SETUP: PracticeSetupPane in companion pane, canvas visible]
   SETUP --Start--> [RUNNING: PracticeLanePane + minimalist cockpit bar]
   RUNNING --■ Stop--> [SETUP]
   SETUP/RUNNING --Practice toggle (exit)--> [normal viewer]
```

## Files Touched

- `playback-controller.svelte.ts` — `practicePhase` state, `practiceActive`/`practiceRunning` getters, `enterPracticeMode`/`exitPracticeMode`, `handlePracticeStart`/`handlePracticeStop` phase writes; expose in returned API.
- `SequenceViewerOrchestrator.svelte` — expose `practiceRunning`, `enterPracticeMode`, `exitPracticeMode` on ctx.
- `ViewerSplitPane.svelte` — accept `practiceRunning`; three-way pane switch.
- `PracticeBar.svelte` — remove gear/config props/divider; add Stop; keep portaled BPM popover.
- `RouteViewerHeader.svelte`, `SequenceViewerDrawerHost.svelte`, `src/routes/sequence/[id]/+page.svelte` — toggle → enter/exit; remove header gear; bar `class:up`/`inert` + pane switch on `practiceRunning`; pass setup-pane props.
- **New** `PracticeSetupPane.svelte`, **new** `RampConfigForm.svelte`.
- **Delete** `PracticeConfigPopover.svelte` (after extraction, once orphaned).

## In-Flight Note

This supersedes the uncommitted in-bar config gear added earlier this turn (BpmQuickPopover stays; the gear-in-bar + its host wiring get reworked here). The earlier BeatStrip / PracticeLanePane / ViewerSplitPane / practice-view-prefs batch is unaffected. Commit scoping per `commit_only_own_changes` (explicit pathspec; the ~60-file drawer-handle refactor is still in flight in the shared tree).

## Verification

- `npm run check` green for touched files (filter the known pre-existing loop-labeler / stale `test/practice-bar` noise).
- Runtime (DevTools, with permission): enter practice → setup pane renders with preselected preset; Start → running bar + lane; Stop → back to setup; exit toggle → normal viewer; preset persists across reload; BPM popover + Slower/Faster work in running.

## Out of Scope (follow-on specs)

- The live-camera AR overlay ([[project_practice_camera_overlay]]) — its own spec; this pane only reserves the toggle slot.
- Read-ahead depth / split-preset controls in setup (deferred A.2 item) — can fold into `PracticeSetupPane` later.
