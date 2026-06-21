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
| Physiological Sigh | 2–1–6–0 | Double nasal inhale (2s + 1s) + long exhale (6s). Stanford RCT (Balban et al., 2023, *Cell Reports Medicine*) found cyclic sighing outperforms box breathing and mindfulness for acute stress relief. High 2026 cultural recognition (Huberman Lab, Oura, Whoop). |
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

**Physiological Sigh — inhale sub-phase:**
The Physiological Sigh pattern splits the inhale into two consecutive nasal inhale segments: `inhale1` (2s, primary) and `inhale2` (1s, secondary top-up). Both map to the same `inhale` ramp on the mandala (dx continues ramping to `animateMax`), but the overlay renders a mid-inhale sub-cue:

```
Phase label sequence:
  "Inhale"        ← inhale1 segment (0–2s into inhale)
  "Inhale again"  ← inhale2 segment (2–3s into inhale)
  "Exhale"        ← exhale phase (3–9s)
```

The `inhale2` sub-cue fires at `elapsed >= inhale1Duration` within the inhale phase. No change to `BreathPhase` — this is a display-layer detail handled in `MeditationOverlay` for the `physiological-sigh` pattern only. The aria-live announcement at the `inhale2` boundary is `"Inhale again"`.

---

## Easing Curve Mapping

Each breathing pattern has a recommended default easing that physiology justifies:

| Pattern | Recommended Easing | Rationale |
|---|---|---|
| Coherence | `sine` | Symmetric, smooth, no hesitation. Matches the consistent cadence of resonance breathing. |
| Box Breathing | `ease` (cubicInOut) | Smooth ramp at start/end of each phase. The "box" implies deliberate, controlled transitions. |
| 4-7-8 | `bloom` | Fast exhale onset (bloom = quick early expansion inverted). The extended exhale benefits from front-loading. |
| Physiological Sigh | `sine` | The double inhale is sharp by nature; a sine curve keeps the ramp smooth without fighting the pattern's inherent speed differential. The long exhale resolves naturally. |
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

Five buttons: Coherence / Box / 4-7-8 / Sigh / Custom. Default: Coherence.

For Coherence: shows a BPM row (3–8 BPM, button group or pill slider).
For Box/4-7-8/Sigh: shows the fixed ratio as a read-only annotation — e.g. Box shows "4s · 4s · 4s · 4s", Sigh shows "2s + 1s · 6s" — with no editable fields. The durations are fixed per pattern.
For Custom: shows four numeric inputs (seconds) for Inhale / Hold In / Exhale / Hold Out. Min 1s per phase, Hold phases can be set to 0.

The Sigh pattern label reads "Physiological Sigh" on wider screens; truncates to "Sigh" on narrow. A tooltip on hover/focus: "Double nasal inhale + long exhale. Stanford 2023 study: most effective pattern for acute stress."

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

The session clock runs inside a `requestAnimationFrame` loop separate from the mandala animation. The two clocks are not merged — the mandala animation is driven by its own raf loop inside `SequenceMandala`. The session clock reads elapsed time and calls a callback that updates `currentPhase`, `phaseElapsed`, and the prompt overlay.

**Timing approach:** `performance.now()` delta-based — not raf tick counting. The session stores `sessionStartMs = performance.now()` on start, and each raf tick computes `elapsedSeconds = (performance.now() - sessionStartMs - totalPausedMs) / 1000`. This ensures the timer does not drift when raf is throttled (background tab) and gives accurate elapsed time on visibility restore. See "Session Lifecycle & Platform Concerns" for pause/resume mechanics.

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
    meditation-session.svelte.ts      — MeditationSessionState, tick clock, session history, visibility handling, wake lock
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
  │     ├── animatePeriod ← getPatternCycleTime(meditationSession.pattern)
  │     ├── animateEasing ← derived from pattern default easing
  │     ├── tipDx ← holdPulseTipDx (set during hold phases; undefined during inhale/exhale)
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
  id: "coherence" | "box" | "4-7-8" | "physiological-sigh" | "custom";
  label: string;
  /** Duration of each phase in seconds. 0 = phase is skipped. */
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
  /** Recommended easing curve for this pattern */
  defaultEasing: UndulationEasing;
  /**
   * For patterns where the inhale phase has a distinct sub-cue midpoint.
   * When set, MeditationOverlay switches the phase label from "Inhale" to
   * "Inhale again" at this many seconds into the inhale phase.
   * Currently only used by "physiological-sigh" (inhale1: 2s, inhale2: 1s).
   */
  inhaleSubCueAt?: number;
}

/** Total cycle duration in seconds. Single source of truth — never store this as a field. */
export function getPatternCycleTime(p: BreathingPattern): number {
  return p.inhale + p.holdIn + p.exhale + p.holdOut;
}

export const BREATHING_PATTERNS: Record<string, BreathingPattern> = {
  coherence:           { id: "coherence",           label: "Coherence",          inhale: 5, holdIn: 0, exhale: 5, holdOut: 0, defaultEasing: "sine" },
  box:                 { id: "box",                 label: "Box",                inhale: 4, holdIn: 4, exhale: 4, holdOut: 4, defaultEasing: "ease" },
  "4-7-8":             { id: "4-7-8",               label: "4-7-8",              inhale: 4, holdIn: 7, exhale: 8, holdOut: 0, defaultEasing: "bloom" },
  // Balban et al. 2023, Cell Reports Medicine — double nasal inhale (2s + 1s) + long exhale (6s).
  // inhaleSubCueAt: 2 triggers the "Inhale again" sub-label at 2s into the inhale phase.
  "physiological-sigh": { id: "physiological-sigh", label: "Physiological Sigh", inhale: 3, holdIn: 0, exhale: 6, holdOut: 0, defaultEasing: "sine", inhaleSubCueAt: 2 },
};
```

The `coherence` pattern's `inhale` and `exhale` values are computed from the selected BPM (not hardcoded to 5s).

`getPatternCycleTime` is the only way to get total cycle time — do not add a `totalCycleSecs` field to the interface (that would duplicate data and can drift on custom patterns).

### SequenceMandala Integration

No changes to `SequenceMandala.svelte`. It is driven purely through its existing props. `MandalaPane` computes:

```typescript
const animatePeriod = $derived(
  meditationMode
    ? getPatternCycleTime(meditationSession.pattern)
    : BASE_PERIOD / speed
);

const animateEasing = $derived(
  meditationMode
    ? meditationSession.pattern.defaultEasing
    : "breathe"
);
```

The hold phases are handled by the `MeditationOverlay` and `MeditationSessionState` — not by `SequenceMandala`. `SequenceMandala` is not changed.

**Hold phase micro-pulse — implementation via `tipDx` bypass:**

`SequenceMandala`'s `effectiveDx` is `tipDx ?? (animate ? animatedDx : MANDALA_STANDARD_TIP_DX)`. When `tipDx` is set, it takes precedence regardless of `animate`. This means:
- During hold phases, `MandalaPane` sets `tipDx` to the pulsed value computed by its own RAF loop
- `animate` remains `true` throughout — the internal `$effect` is never re-triggered by hold-phase changes
- During inhale/exhale ramp phases, `MandalaPane` clears `tipDx` (passes `undefined`) and the mandala animation drives `animatedDx` normally

This avoids the `$effect` dependency problem entirely: `animateMax`, `animateMin`, `animatePeriod`, and `animateEasing` are set once per session start and never mutated during the session. No animation restarts, no clock desync.

**Micro-pulse computation in `MandalaPane`:**

```typescript
// MandalaPane maintains its own hold-pulse state
let holdPulseTipDx: number | undefined = $state(undefined);

// Inside MeditationSessionState tick callback, for hold-in:
//   amplitude = (animateMax - animateMin) * 0.03  (±3%)
//   holdPulseTipDx = animateMax + Math.sin(2 * Math.PI * 0.2 * elapsedInHold) * amplitude
// For hold-out:
//   holdPulseTipDx = animateMin + Math.sin(2 * Math.PI * 0.2 * elapsedInHold) * amplitude
// For inhale/exhale:
//   holdPulseTipDx = undefined  (animation drives dx)
```

`MandalaPane` passes `holdPulseTipDx` as the `tipDx` prop to `SequenceMandala`. The micro-pulse runs at 0.2 Hz (5-second oscillation), giving the held breath a living quality without touching any animated prop.

---

## Session Lifecycle & Platform Concerns

### Page Visibility — Pause/Resume on Tab Switch

`requestAnimationFrame` is throttled (or stopped entirely) in background tabs by all major browsers. Without handling this, the session timer drifts and audio desynchronizes from the visual.

**Timer implementation:** The session clock uses `performance.now()` delta-based timing — not raf tick counting. Each raf tick computes `elapsed = performance.now() - sessionStartTime - totalPausedMs`, where `totalPausedMs` accumulates paused intervals. This keeps the session clock accurate regardless of raf throttling.

**Visibility change handler:**

```typescript
// In MeditationSessionState
let tabHiddenAt: number | null = null;

function onVisibilityChange() {
  if (document.hidden) {
    tabHiddenAt = performance.now();
    // Pause mandala animation to avoid stale frames on return
    pauseAnimation();
    // Fade ambient audio immediately (no graceful fade — tab is hidden)
    meditationAudioService.setVolume(0);
  } else {
    if (tabHiddenAt !== null) {
      totalPausedMs += performance.now() - tabHiddenAt;
      tabHiddenAt = null;
    }
    resumeAnimation();
    meditationAudioService.setVolume(masterVolume);
  }
}

// Registered in session start, removed on session end
document.addEventListener('visibilitychange', onVisibilityChange);
```

The session does not auto-end when the tab is hidden. Time while hidden is excluded from `elapsedSeconds`. The user returns to the same phase they left. This is the correct behavior for a meditation context — users may glance away or put the device face-down.

### Screen Wake Lock — Prevent Display Sleep

A 30-minute meditation session will trigger screen sleep on mobile devices. The Screen Wake Lock API (`navigator.wakeLock.request('screen')`) prevents this.

**Lifecycle:**

```typescript
// In MeditationSessionState
let wakeLock: WakeLockSentinel | null = null;

async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return; // graceful degradation
  try {
    wakeLock = await navigator.wakeLock.request('screen');

    // NOTE: On iOS 16.4–18.3 in installed PWAs (Home Screen Web Apps),
    // wakeLock.request() resolves successfully and returns a WakeLockSentinel
    // without throwing — but the screen still sleeps. This is WebKit bug #254545,
    // fixed in iOS 18.4 (released early 2025). Users on older iOS in a PWA
    // context will see the API "succeed" while the screen dims anyway.
    // The release-event re-acquisition pattern below is the best available
    // mitigation — do NOT remove it thinking it's redundant.
    wakeLock.addEventListener('release', () => {
      if (sessionState.status === 'running') acquireWakeLock();
    });
  } catch {
    // Permission denied or API unsupported — silently degrade, session continues
  }
}

function releaseWakeLock() {
  wakeLock?.release();
  wakeLock = null;
}
```

- `acquireWakeLock()` is called on session start (after the user-gesture "Start" press — required for the API).
- `releaseWakeLock()` is called on session complete, on "End Session" press, and on meditation mode exit.
- The `release` event listener inside `acquireWakeLock` handles two cases: browser-initiated release (e.g., battery critical) and the iOS 16.4–18.3 PWA silent-failure window described above.

**Support:** Chrome 84+, Edge 84+, Safari 16.4+ (browser tabs); Safari 18.4+ for reliable PWA support (WebKit bug #254545). Graceful degradation for older Safari — screen may dim but session continues.

---

## Scope Boundaries

**In Phase 4:**
- Five breathing patterns (Coherence, Box, 4-7-8, Physiological Sigh, Custom)
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
