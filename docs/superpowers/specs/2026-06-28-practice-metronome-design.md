# Practice Metronome — Design

**Date:** 2026-06-28
**Feedback:** `LrfbaCwqxOc3Lk4HY7Ku` — "when in ramp (practice) mode, have a bpm sound that can play as a metronome, toggleable off and on"
**Status:** Approved, ready for implementation plan

## Problem

Ramp (practice) mode — the tempo-trainer in the sequence viewer — loops a
sequence and climbs the BPM as the user lands clean loops. Today it is silent:
tempo is shown only as a number plus a visual pulse in the cockpit
(`PracticeBar.svelte`). The user hears nothing, so the tempo has to be read, not
felt. The request is an audible metronome click on each beat that speeds up with
the ramp, with a single toggle to turn the sound on and off.

## Goal

A beat click during a running ramp, accented on the loop downbeat, toggleable
on/off from the cockpit, persisted across sessions. Synced to the actual visual
playback through every ramp speed-up. No new audio infrastructure, no extra
sound knobs.

## Non-goals

- No metronome in normal (non-practice) playback. The request is scoped to ramp
  mode and the toggle lives in the practice cockpit.
- No volume, sound-pack, or subdivision controls. One on/off toggle only.
- No change to the record-tab metronome behavior.

## Architecture

### Reuse, not rebuild

A `Metronome` class already exists at
`src/lib/features/create/record/services/metronome.ts` (Web Audio API, click
scheduler, accent support). Its only importer is `RecordPanel.svelte`. It is
promoted to a shared location and extended; it is not duplicated.

The record tab drives the metronome with its **own scheduler**
(`start(bpm, onStep)`) because it owns timing. In the viewer, the animation
engine owns timing and the BPM ramps continuously, so a competing scheduler
would drift from the visuals and need a restart on every speed-up. Instead the
viewer fires **one click per beat** off the playback's existing beat-boundary
event — the click lands when the pictograph lands, and stays locked to the
visuals for free as the ramp climbs.

### Touch points

**1. Promote + extend `Metronome` → `src/lib/shared/audio/metronome.ts`**

- Move the file; update the single import in
  `src/lib/features/create/record/components/RecordPanel.svelte`.
- Add two public methods; keep `start` / `stop` / `setEnabled` / `dispose`
  unchanged so the record tab is untouched behaviorally:
  - `resume(): void` — initialize (if needed) and resume the `AudioContext`.
    Audio can only unlock inside a user gesture, so the caller invokes this from
    a click handler.
  - `tick(isAccent = false): void` — schedule a single click at the current
    audio time. Reuses the existing `createClick` accent path (accent = 1200 Hz
    / 0.3 gain; plain = 800 Hz / 0.2 gain). No-ops if the context is unavailable.

**2. `playback-controller.svelte.ts` — owns the metronome instance + firing**

The controller already owns all playback state and the beat-boundary event. It
gains:

- A lazily-constructed `Metronome` instance (`_metronome: Metronome | null`),
  built and `resume()`d on the first user gesture that needs sound (practice
  Start, or enabling the toggle mid-session).
- Click firing inside the existing `currentStep` subscription branch
  (`playback-controller.svelte.ts:57-67`), beside the haptic trigger, under the
  same play/visibility guard:

  ```
  if (practiceRunning && metronomeEnabled && newBeat !== lastStepNumber
      && newBeat >= 1 && _isAnimationVisible?.() !== false) {
    _metronome?.tick(newBeat === 1);
  }
  ```

  `newBeat === 1` is the loop downbeat → accented click; every other beat is a
  plain click. (`practiceRunning` = `practicePhase === "running"`.)
- `handleToggleMetronome()` — flips the persisted pref; when turning **on**,
  lazily constructs the instance and calls `resume()` on that gesture.
- A `metronomeEnabled` getter for the cockpit toggle's pressed state.
- `_metronome?.dispose()` in the controller's `dispose()`.

The enabled flag is **read from** practice-view-prefs (below); the controller
holds a reference to the prefs object (threaded through its deps) so gating and
the toggle share one source of truth.

**3. `practice-view-prefs.svelte.ts` — persisted on/off**

Add `metronomeEnabled: boolean` (default **false**) to the persisted prefs
(`PersistedPrefs` + the existing `tka-practice-view` localStorage key), with a
`setMetronomeEnabled(v)` setter and a getter, matching the existing
`splitPreset` / `readAheadDepth` pattern. This is the correct home: it already
holds view-only practice knobs, persisted, and is already wired into the viewer
context (`ctx.practiceViewPrefs`).

**4. `PracticeBar.svelte` — the cockpit toggle**

Add a toggle button in the control cluster next to Hold:

- A real `<button>` with `aria-pressed`, never a checkbox — matches the existing
  Hold button pattern in the same bar.
- `fa-volume-high` when on, `fa-volume-xmark` when off; label "Sound".
- Shares the bar's `--ctrl-h` height and the column icon+label layout used by
  Hold / Stop, so it reads as a peer control and the 44px touch floor holds.
- New props: `metronomeOn: boolean`, `onToggleMetronome: () => void`.

Wired at both render sites (`+page.svelte:730`,
`SequenceViewerDrawerHost.svelte:739`) from `ctx`:
`metronomeOn={ctx.metronomeEnabled}` and
`onToggleMetronome={ctx.handleToggleMetronome}`.

## Data flow

```
user clicks Sound toggle (gesture)
  → PracticeBar onToggleMetronome
  → controller.handleToggleMetronome()
      → practiceViewPrefs.setMetronomeEnabled(!current)   (persist)
      → if now ON: construct Metronome (if needed) + resume()   (unlock audio)

ramp running, playback crosses a beat boundary
  → currentStep subscription, newBeat increments
  → guard: practiceRunning && metronomeEnabled && visible && newBeat >= 1
  → Metronome.tick(newBeat === 1)   (accent the loop downbeat)
```

## Edge cases

- **Paused / hand-stepping:** the beat-boundary fire is gated on `isPlayingLocal`
  (existing), so no clicks when paused or when stepping via the header arrows.
  Sound only during an actually-playing ramp. Correct and free.
- **Audio not unlocked:** `tick` no-ops when the context is null/suspended;
  `resume()` runs on the Start and toggle gestures, both real clicks.
- **Pane hidden:** the existing `_isAnimationVisible` gate suppresses clicks when
  the animation pane isn't showing, same as haptics.
- **Toggle off mid-ramp:** next beat's guard fails, clicks stop immediately; the
  instance stays alive for a cheap re-enable.

## Testing

Light, by design. The gating and the downbeat accent are audible — a wrong gate
or a missing accent is obvious the instant the ramp runs. Web Audio output is
not meaningfully unit-testable. Verification is a runtime check: start a ramp,
toggle on, confirm a click per beat with an accented downbeat, confirm the click
rate rises as the ramp speeds up, confirm silence when paused and when toggled
off, confirm the setting survives a reload.

## Files

| File | Change |
|---|---|
| `src/lib/shared/audio/metronome.ts` | **Move** from `create/record/services/`; add `resume()` + `tick()` |
| `src/lib/features/create/record/components/RecordPanel.svelte` | Update import path only |
| `src/lib/shared/sequence-viewer/components/playback-controller.svelte.ts` | Own metronome instance, fire `tick` on beat boundary, toggle handler, dispose |
| `src/lib/shared/sequence-viewer/state/practice-view-prefs.svelte.ts` | Add persisted `metronomeEnabled` (default off) |
| `src/lib/shared/sequence-viewer/components/PracticeBar.svelte` | Sound toggle button (aria-pressed) |
| `src/routes/sequence/[id]/+page.svelte` | Pass `metronomeOn` / `onToggleMetronome` to `PracticeBar` |
| `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` | Same prop wiring at the drawer render site |
