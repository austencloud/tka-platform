# Mandala Phase 4 — Guided Meditation

**Date:** 2026-05-25
**Phase:** 4 of the Mandala Roadmap
**Depends on:** Phase 1 (Viewer Pane) — complete

---

## Overview

Phase 4 transforms the mandala breathing viewer into a guided meditation tool. The mandala — already a breathing visual — becomes the pacer: the user follows its expansion (inhale) and contraction (exhale) to regulate their own breath.

This is not a superficial overlay. The breathing schedule drives the animation, not the other way around. When a user picks a 6 BPM coherence pattern, the mandala's period is derived from that rate, the easing curve is chosen for that pattern, and the "Inhale / Hold / Exhale / Hold" prompts are synchronized to the exact undulation position. The mandala visual and the breath prompt are one clock.

**Entry point:** A "Meditate" button in the existing `MandalaViewerControls` rail, beneath the current controls. Pressing it opens a meditation mode overlay that transforms the pane without navigating away.

---

## Breathing Patterns

### Supported Patterns

| Pattern | Ratio | Description |
|---|---|---|
| Coherence | Equal in/out, no hold | Heart-rate variability training. Equal inhale and exhale at 5–6 BPM. |
| Box Breathing | 4–4–4–4 | Inhale 4s / Hold 4s / Exhale 4s / Hold 4s. Military standard, stress relief. |
| 4-7-8 | 4–7–8 | Inhale 4s / Hold 7s / Exhale 8s. Sleep-promoting, activates parasympathetic. |
| Custom | User-defined | Separate second-counts for each phase: inhale, hold-in, exhale, hold-out. |

### BPM Selector

Coherence mode exposes a BPM picker (3–8 BPM, default 6). The selected BPM maps to `animatePeriod` as:

```
period = 60 / bpm
```

At 6 BPM: period = 10s. At 4 BPM: period = 15s. At 8 BPM: period = 7.5s.

For patterns with holds (Box, 4-7-8, Custom), BPM is not the right control — phase durations in seconds are used directly. Total cycle time = sum of all phase durations.

### Breath Phases and the Animation Clock

The existing `SequenceMandala` animation runs a triangle wave from `animateMin` to `animateMax` over `animatePeriod`. For meditation mode, a new clock layer sits above this and subdivides the period into named phases.

```
BreathPhase = "inhale" | "hold-in" | "exhale" | "hold-out"
```

Each phase occupies a portion of the total cycle proportional to its duration:

```
inhaleFraction  = inhale / totalCycleTime
holdInFraction  = holdIn / totalCycleTime
exhaleFraction  = exhale / totalCycleTime
holdOutFraction = holdOut / totalCycleTime
```

The animation position within the cycle maps to phases:

- `inhale` phase: dx ramps from `animateMin` to `animateMax`
- `hold-in` phase: dx stays at `animateMax` (full expansion, gentle micro-pulse)
- `exhale` phase: dx ramps from `animateMax` to `animateMin`
- `hold-out` phase: dx stays at `animateMin` (full contraction, still or faint dimming)

For Coherence mode (no holds), the triangle wave maps directly: 0–0.5 is inhale, 0.5–1.0 is exhale.

---

## Easing Curve Mapping

Each breathing pattern has a recommended default easing that physiology justifies:

| Pattern | Recommended Easing | Rationale |
|---|---|---|
| Coherence | `sine` | Symmetric, smooth, no hesitation. Matches the consistent cadence of resonance breathing. |
| Box Breathing | `ease` (cubicInOut) | Smooth ramp at start/end of each phase. The "box" implies deliberate, controlled transitions. |
| 4-7-8 | `bloom` | Fast exhale onset (bloom = quick early expansion inverted). The extended exhale benefits from front-loading. |
| Custom | `breathe` | Default organic breathe easing. User can override in advanced settings. |

In meditation mode, the easing is auto-set based on pattern selection. Advanced users can override it via a collapsed "Advanced" section.

During **hold phases**, the mandala does not freeze abruptly. A micro-pulse: gentle ±3% dx oscillation at 0.2Hz gives the held breath a living quality without disturbing the hold signal. This is implemented as a `holdPulseAmplitude` parameter passed to the meditation clock.

---

## UI Design

### Entry Point

In `MandalaViewerControls.svelte`, below the Download Animation button:

```
[ Meditate ]   ← new button, full-width, accent-colored
```

Pressing it does not navigate. It replaces the controls rail with the meditation mode panel and overlays the breathing prompt on the mandala canvas.

### Meditation Mode Panel (right rail)

Replaces the standard controls rail. Has a back arrow ("Exit" / `fa-arrow-left`) at the top to return to standard view.

**Section 1: Pattern**

Four buttons: Coherence / Box / 4-7-8 / Custom. Default: Coherence.

For Coherence: shows a BPM row (3–8 BPM, button group or pill slider).
For Box/4-7-8: shows the fixed ratio as a read-only annotation ("4s · 4s · 4s · 4s") with no editable fields. The durations are fixed per pattern.
For Custom: shows four numeric inputs (seconds) for Inhale / Hold In / Exhale / Hold Out. Min 1s per phase, Hold phases can be set to 0.

**Section 2: Session**

Duration selector: 5 / 10 / 15 / 20 / 30 min (button group). Default: 10 min.

Session timer: shows `MM:SS` remaining during active session. Displayed near the bottom of the panel or as a subtle overlay on the mandala stage.

**Section 3: Sound** (collapsed by default, disclosure triangle)

Toggle: Sound On/Off (button + toggle-indicator pattern per no-checkboxes rule).

When on, ambient track selector: Ocean / Forest / Chimes / Singing Bowl / None.

Completion sound: a single singing bowl strike plays when the session timer reaches zero. Non-negotiable — the user gets the ending signal even if ambient audio is off.

**Start / Stop button:** Full-width at the bottom of the panel. "Start" when idle. "End Session" when running.

### Breathing Prompt Overlay

Overlaid on the mandala stage (not on the controls rail). Positioned at the **bottom center** of the mandala container, inside the visual but not obscuring the center.

```
  [ INHALE ]        ← current phase label
  ○○○○○○○○          ← phase progress dots or thin arc progress indicator
```

**Phase label typography:**
- Font: same as the existing viewer label typography — uppercase, letter-spaced, weight 500
- Size: ~18px on desktop, ~16px on mobile
- Color: white at 0.8 opacity (dark mandala background makes this legible)
- Animation: the label cross-fades (150ms opacity transition) on phase change. No sliding or bouncing — this is a calm context.

**Phase progress indicator:**
A thin arc segment below the label traces the current phase's progress from 0% to 100%. Stroke color matches the current phase:
- Inhale: cool blue (`#4dd0e1`)
- Hold-in: warm white (`rgba(255,255,255,0.7)`)
- Exhale: soft gold (`#ffab00`)
- Hold-out: warm white (`rgba(255,255,255,0.5)`)

The arc is 32px diameter, 2px stroke weight. Rendered as an SVG. Does not compete with the mandala.

**Reduced-motion variant:** When `prefers-reduced-motion: reduce` is set, the arc progress indicator is replaced by a text fraction ("2 / 4s") and the cross-fade is removed.

### Session Complete Screen

When the session timer hits zero:
1. Completion sound fires.
2. The mandala continues animating (do not abruptly stop).
3. An overlay fades in over the mandala (dark semi-transparent backdrop):
   - "Session Complete"
   - Duration summary: "10 minutes · 60 breaths"
   - Two buttons: "Meditate Again" (restarts with same settings) and "Back to Mandala" (exits meditation mode)

---

## Audio

### Implementation: Web Audio API with preloaded files

Ambient tracks are loaded as `AudioBuffer` instances via `fetch` + `AudioContext.decodeAudioData`. Each track loops seamlessly (`AudioBufferSourceNode` with `loop = true`). Tracks are loaded lazily on first use and cached for the session.

No external library. The Web Audio API surface needed here is small:
- `AudioContext`
- `AudioBufferSourceNode` with loop
- `GainNode` for fade-in/fade-out on start/stop

**File format:** `.ogg` with `.mp3` fallback. Files live in `static/audio/meditation/`:
- `ocean.ogg` / `ocean.mp3`
- `forest.ogg` / `forest.mp3`
- `chimes.ogg` / `chimes.mp3`
- `singing-bowl.ogg` / `singing-bowl.mp3`
- `bell-complete.ogg` / `bell-complete.mp3` (session completion, ~3s)

**Volume:** Ambient tracks play at 0.4 gain (40%). Completion bell at 0.8 gain. Both respect a master volume slider in the Sound section (0–100%, default 60%).

**Fade behavior:** Ambient audio fades in over 2 seconds when session starts. Fades out over 3 seconds on session end. Abrupt cuts are not acceptable in a meditation context.

**AudioContext activation:** Web Audio requires a user gesture to initialize. The "Start" button press serves as the gesture. The `AudioContext` is created on first press and reused for the session.

**State:** `MeditationAudioService` — a singleton service (factory getter pattern, not DI container) that owns the `AudioContext`, manages the active source nodes, and exposes:
- `startAmbient(track: AmbientTrack): void`
- `stopAmbient(): void`
- `playCompletionBell(): void`
- `setVolume(gain: number): void`
- `dispose(): void`

---

## Session Management

### Session State

`MeditationSessionState.svelte.ts` — Svelte 5 runes-based reactive state. Local only (not persisted to Firebase in Phase 4 — see below).

```typescript
type MeditationSessionStatus = "idle" | "running" | "complete";

interface MeditationSessionState {
  status: MeditationSessionStatus;
  pattern: BreathingPattern;
  durationMinutes: number;
  elapsedSeconds: number;
  breathCount: number;
  currentPhase: BreathPhase;
  phaseElapsed: number;    // seconds into current phase
  phaseDuration: number;   // total seconds for current phase
}
```

`elapsedSeconds` drives the session timer display. `breathCount` increments each time a full cycle (inhale → back to inhale) completes. Used for the completion summary.

### Tick Clock

The session clock runs inside a `requestAnimationFrame` loop separate from the mandala animation. The two clocks are not merged — the mandala animation is driven by its own raf loop inside `SequenceMandala`. The session clock reads elapsed time and calls a callback that updates `currentPhase`, `phaseElapsed`, and the prompt overlay. The two loops run in parallel; they share the same absolute `startTime` reference to stay synchronized.

### Session History

Phase 4 scope: no persistent session history. Completed sessions are tracked in a `$state` array in `MeditationSessionState` for the current page session only:

```typescript
interface CompletedSession {
  completedAt: Date;
  durationMinutes: number;
  pattern: BreathingPattern;
  breathCount: number;
}
```

This array is used only for potential in-session display ("you've done 3 sessions today"). It resets on page reload. Persistent history (streaks, stats, Firebase sync) is explicitly deferred to a future phase — do not design for it now or leave stubs for it.

---

## Accessibility

### Screen Reader Announcements

Phase transitions are announced via a visually-hidden `aria-live="polite"` region. The announcement fires on each phase change:

```
"Inhale"         ← when inhale phase begins
"Hold"           ← when hold-in phase begins
"Exhale"         ← when exhale phase begins
"Rest"           ← when hold-out phase begins
"Session complete. You completed 60 breaths in 10 minutes."  ← on finish
```

The live region uses `aria-live="polite"` (not `assertive`) because interrupting other screen reader content is inappropriate in a relaxation context.

The visual phase label and the aria-live region are separate elements — the visual uses `aria-hidden="true"` to avoid double-announcing.

### Reduced Motion

`@media (prefers-reduced-motion: reduce)`:
- The mandala animation continues (the breathing motion is the core function — stopping it defeats the purpose), but `animateRotation` is forced to 0.
- The phase progress arc is replaced by a text counter ("3 / 4s").
- All CSS transitions and cross-fades are removed.
- The completion overlay appears instantly (no fade).

### Focus Management

When meditation mode opens, focus moves to the "Start" button. When it closes, focus returns to the "Meditate" button that opened it. Standard dialog focus trap applies while the session-complete overlay is shown.

### Color Contrast

Phase prompt text (`rgba(255,255,255,0.8)`) against the black mandala background (`#000000`) passes WCAG AA for normal text.

---

## Technical Architecture

### New Files

```
src/lib/shared/sequence-viewer/
  components/
    MeditationOverlay.svelte          — breathing prompt + phase arc, overlaid on mandala stage
    MeditationPanel.svelte            — right rail panel (pattern/session/sound controls)
  services/
    meditation-audio.ts               — MeditationAudioService factory + types
  state/
    meditation-session.svelte.ts      — MeditationSessionState, tick clock, session history
  domain/
    meditation-types.ts               — BreathingPattern, BreathPhase, PatternConfig, CompletedSession
```

### Modified Files

```
src/lib/shared/sequence-viewer/components/
  MandalaPane.svelte                  — add meditationMode boolean state; conditionally render MeditationOverlay + swap controls rail
  MandalaViewerControls.svelte        — add "Meditate" button at bottom; emit onMeditateClick callback
```

### Data Flow

```
MandalaPane
  ├── meditationMode: boolean (local state)
  ├── when false → MandalaViewerControls (existing)
  ├── when true  → MeditationPanel + MeditationOverlay
  │
  ├── MeditationPanel
  │     ├── reads/writes: pattern, durationMinutes, ambientTrack, volume
  │     ├── onStart → MeditationSessionState.start()
  │     └── onStop  → MeditationSessionState.stop()
  │
  ├── MeditationOverlay
  │     ├── reads: MeditationSessionState.currentPhase, phaseElapsed, phaseDuration
  │     └── renders: phase label + arc indicator + aria-live region
  │
  ├── SequenceMandala (unchanged API)
  │     ├── animatePeriod ← derived from MeditationSessionState.pattern.totalCycleSecs
  │     ├── animateEasing ← derived from pattern default easing
  │     └── animateRotation ← 90° normally, 0° under prefers-reduced-motion
  │
  └── MeditationAudioService
        ├── startAmbient() on session start
        ├── playCompletionBell() on session complete
        └── stopAmbient() on session stop / mode exit
```

### BreathingPattern Type

```typescript
export interface BreathingPattern {
  id: "coherence" | "box" | "4-7-8" | "custom";
  label: string;
  /** Duration of each phase in seconds. 0 = phase is skipped. */
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
  /** Recommended easing curve for this pattern */
  defaultEasing: UndulationEasing;
}

export const BREATHING_PATTERNS: Record<string, BreathingPattern> = {
  coherence: { id: "coherence", label: "Coherence", inhale: 5, holdIn: 0, exhale: 5, holdOut: 0, defaultEasing: "sine" },
  box:       { id: "box",       label: "Box",        inhale: 4, holdIn: 4, exhale: 4, holdOut: 4, defaultEasing: "ease" },
  "4-7-8":   { id: "4-7-8",    label: "4-7-8",      inhale: 4, holdIn: 7, exhale: 8, holdOut: 0, defaultEasing: "bloom" },
};
```

The `coherence` pattern's `inhale` and `exhale` values are computed from the selected BPM (not hardcoded to 5s).

### SequenceMandala Integration

No changes to `SequenceMandala.svelte`. It is driven purely through its existing props. `MandalaPane` computes:

```typescript
const animatePeriod = $derived(
  meditationMode
    ? meditationSession.pattern.totalCycleSecs
    : BASE_PERIOD / speed
);

const animateEasing = $derived(
  meditationMode
    ? meditationSession.pattern.defaultEasing
    : "breathe"
);
```

The hold phases are handled by the `MeditationOverlay` and `MeditationSessionState` — not by `SequenceMandala`. The mandala continues its triangle wave unmodified; the hold visual effect (micro-pulse at ±3% dx) is implemented by momentarily modulating `animateMax` by a small sinusoid in `MandalaPane` during hold phases.

---

## Scope Boundaries

**In Phase 4:**
- Four breathing patterns (Coherence, Box, 4-7-8, Custom)
- BPM selector for Coherence
- Session timer (5–30 min)
- Breathing prompt overlay (phase label + arc indicator)
- Hold phase micro-pulse
- Ambient audio (4 tracks + completion bell)
- Screen reader announcements
- Reduced-motion adaptation
- Session completion screen (in-page, no navigation)
- Per-session breath count summary

**Explicitly out of scope:**
- Persistent session history, streaks, stats
- Firebase sync of session data
- Haptic feedback
- Custom audio uploads
- Guided voice narration
- Per-pattern visual theme changes (the existing color presets are sufficient)
- "Scheduled" sessions or reminders
- Sharing meditation settings as a short code (that is Phase 3 infrastructure)
