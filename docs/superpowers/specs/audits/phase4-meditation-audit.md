# Audit: Mandala Phase 4 — Guided Meditation Design

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase4-guided-meditation-design.md`
**Audited:** 2026-05-25
**Cross-referenced:** `SequenceMandala.svelte`, `MandalaPane.svelte`, `MandalaViewerControls.svelte`

---

## VERDICT

**Conditional pass.** The spec is well-structured and covers UX, accessibility, and audio with genuine depth. One critical technical flaw in the hold micro-pulse approach will cause animation restarts and clock desync. Two important gaps (missing interface field, no tab-switching behavior). Fix the critical issue before implementation.

---

## STRENGTHS

1. **Breathing patterns are medically sound.** Box breathing (4-4-4-4) and 4-7-8 are well-established clinical patterns. Coherence breathing at 5-6 BPM targets heart-rate variability resonance, which is the standard range in biofeedback literature. The BPM picker range of 3-8 covers both slow deep breathing (3 BPM = 20s cycle) and faster-paced entry breathing (8 BPM = 7.5s cycle).

2. **BPM-to-period mapping is correct.** `period = 60 / bpm` yields 10s at 6 BPM, 15s at 4 BPM, 7.5s at 8 BPM. The distinction between BPM control for Coherence and direct-seconds control for patterned breathing (Box, 4-7-8) is the right design.

3. **Easing selections match physiology.** `sine` for Coherence (smooth, symmetric), `ease` (cubicInOut) for Box (controlled transitions), `breathe` for Custom (organic default). All verified as existing in the `EASING_FNS` map in `SequenceMandala.svelte`.

4. **Audio architecture is correct for 2026.** Web Audio API with `AudioBufferSourceNode` + `GainNode` is the right call over `<audio>` elements. Lazy loading with session caching avoids upfront bandwidth. The `AudioContext` user-gesture requirement is correctly handled by the Start button. Fade in/out durations (2s/3s) are appropriate for meditation context.

5. **Accessibility is thorough.** `aria-live="polite"` (not `assertive`) is correct for a relaxation context. Separate visual label (`aria-hidden="true"`) and live region to avoid double-announcing. Focus management on mode enter/exit. Reduced-motion adaptation that preserves breathing function while removing rotation and transitions.

6. **No scope creep.** Explicit out-of-scope list prevents gold-plating. No Firebase sync, no streaks, no haptics, no voice narration. The in-memory session history with reset-on-reload is the right Phase 4 boundary.

7. **Correct use of existing patterns.** Factory getter for `MeditationAudioService` (not DI container). Button + toggle-indicator for Sound toggle (no checkboxes). Existing chip/button patterns in controls rail.

---

## ISSUES

### Critical

**C1: Hold micro-pulse will restart animation and desync clocks.**

The spec says: "The hold visual effect (micro-pulse at +/-3% dx) is implemented by momentarily modulating `animateMax` by a small sinusoid in `MandalaPane` during hold phases."

In `SequenceMandala.svelte` (lines 184-185), `maxDx` is captured in the `$effect` closure:

```typescript
const maxDx = animateMax;  // captured once when effect runs
```

The `$effect` reads `animateMax` as a dependency. Every time `MandalaPane` modulates `animateMax` for the micro-pulse, the effect will re-run, resetting `startTime = null` and restarting the entire animation loop from zero. This causes:
- Visible animation jumps on every micro-pulse tick (~5 times per second at the proposed 0.2Hz, depending on sinusoid sampling rate)
- The meditation session clock and the mandala clock will desync because SequenceMandala resets its internal `startTime` on each `$effect` re-run

**Fix options:**
- (A) Add a dedicated `holdPulse` prop to `SequenceMandala` that applies micro-oscillation inside its own raf loop, without triggering the `$effect` dependency chain. This requires a small SequenceMandala change (contradicts "No changes to SequenceMandala.svelte").
- (B) Implement the hold phases entirely outside SequenceMandala: during hold phases, pause SequenceMandala (`animate=false`) and use a separate raf loop in MandalaPane to directly set `tipDx` with the micro-pulse value. The `tipDx` prop bypasses animation entirely (line 218-220 in SequenceMandala: `tipDx ?? (animate ? animatedDx : MANDALA_STANDARD_TIP_DX)`).
- (C) Accept a SequenceMandala change: add `animateHoldValue` and `animateHoldActive` props. When `animateHoldActive` is true, the internal raf loop oscillates around `animateHoldValue` instead of running the triangle wave.

Option (B) is the cleanest path that truly requires no SequenceMandala changes. During hold-in: set `animate=false`, set `tipDx` to `animateMax` with micro-pulse. During hold-out: set `animate=false`, set `tipDx` to `animateMin` with micro-pulse. During inhale/exhale: set `animate=true`, clear `tipDx`. The transition back to `animate=true` will still reset `startTime`, so the meditation clock must drive the mandala phase offset externally -- which circles back to needing some SequenceMandala modification for phase-offset support.

Recommendation: Option (A) or (C). Accept a small SequenceMandala change. The "no changes" constraint is aspirational but the current API cannot support hold phases without it.

### Important

**I1: `BreathingPattern` interface is missing `totalCycleSecs`.**

The spec's `$derived` computation references `meditationSession.pattern.totalCycleSecs` (line 362), but the `BreathingPattern` interface (lines 334-349) has no such field. Either:
- Add `totalCycleSecs` as a computed getter (e.g., `get totalCycleSecs(): number { return this.inhale + this.holdIn + this.exhale + this.holdOut; }`) -- but the interface is a plain object, not a class.
- Add a helper function `getPatternCycleTime(p: BreathingPattern): number` in `meditation-types.ts`.
- Add `totalCycleSecs` as a redundant stored field (fragile, violates single source of truth).

Recommend the helper function approach.

**I2: No tab-switching / visibility handling.**

The spec does not address what happens when the user switches browser tabs or minimizes the window during a meditation session. Specific gaps:
- `requestAnimationFrame` stops firing in background tabs (browser throttling). The session timer will drift.
- Ambient audio continues playing in background tabs (Web Audio API is not paused by the browser's raf throttling), so the audio and visual will desync.
- No mention of the Page Visibility API (`document.visibilitychange`) to handle pause/resume.

Fix: Use `setInterval` or `performance.now()` delta-based timing for the session clock (not raf). Use `visibilitychange` to pause the mandala animation and optionally fade audio when the tab is hidden, resuming with correct elapsed time when visible again.

**I3: Screen Wake Lock API is missing.**

A 30-minute meditation session on a mobile device will trigger screen sleep. The Screen Wake Lock API (`navigator.wakeLock.request('screen')`) is well-supported in 2026 (Chrome, Edge, Safari 16.4+). The spec should acquire a wake lock on session start and release it on session end/exit. This is a 10-line addition but critical for the use case.

### Minor

**M1: Bloom easing characterization is slightly misleading.**

The spec says bloom provides "fast exhale onset (bloom = quick early expansion inverted)." The actual `bloomEase` function is `1 - (1-t)^3.5`, which is an ease-out curve: fast at the start, slow taper at the end. This curve applies to both inhale and exhale phases (the triangle wave maps 0-1 for each). For the exhale (contraction), this means the mandala contracts quickly then slowly tapers -- which is fine for an 8-second exhale. But calling it "quick early expansion inverted" is confusing. Better description: "ease-out curve -- rapid onset, gradual completion. Matches the 4-7-8 pattern's long exhale by front-loading the contraction."

**M2: Coherence BPM default values are inconsistent.**

The `BREATHING_PATTERNS` constant hardcodes `coherence: { inhale: 5, holdIn: 0, exhale: 5, holdOut: 0 }`, but the spec also says "The coherence pattern's inhale and exhale values are computed from the selected BPM (not hardcoded to 5s)." The constant and the note contradict each other. The constant should either be omitted for coherence (computed at runtime from BPM), or the constant should serve as a default that gets overridden. Clarify which.

**M3: Phase progress arc diameter feels small.**

32px diameter, 2px stroke weight for the phase arc on a mandala that could be 400-800px+ wide. At desktop sizes this will be barely visible. Consider scaling the arc relative to the container, or using a minimum of 48-64px on desktop.

**M4: No master volume persistence.**

The Sound section has a master volume slider (0-100%, default 60%), but since Phase 4 has no Firebase sync and session state resets on page reload, users will need to re-set their preferred volume every visit. Consider persisting volume preference in `localStorage` as a low-cost quality-of-life improvement within Phase 4 scope.

**M5: WCAG contrast check incomplete.**

The spec claims `rgba(255,255,255,0.8)` on `#000000` passes WCAG AA. Effective luminance of white at 0.8 opacity on black is `rgb(204,204,204)` = #CCCCCC. Contrast ratio of #CCCCCC on #000000 is approximately 13.3:1, which passes both AA and AAA for all text sizes. The claim is correct but should note the computed effective color for documentation completeness.

**M6: Completion bell plays even when ambient audio is off -- verify UX.**

The spec says "Non-negotiable -- the user gets the ending signal even if ambient audio is off." This is a reasonable default, but some users meditate in complete silence intentionally. Consider at minimum respecting the master volume slider for the bell (it does -- 0.8 gain * master volume), and if master volume is 0%, skip the bell entirely.

---

## RECOMMENDATIONS

1. **Resolve C1 before implementation.** The hold micro-pulse approach as specced will not work. Accept a small `SequenceMandala` change (option A or C) or redesign the hold mechanism using the `tipDx` bypass prop (option B with phase-offset support).

2. **Add visibility change handling.** Use `document.addEventListener('visibilitychange', ...)` to pause/resume gracefully. Switch the session timer from raf to `performance.now()` delta-based timing so it does not drift in background tabs.

3. **Add Screen Wake Lock.** Acquire on session start, release on session end. ~10 lines. Essential for mobile meditation sessions.

4. **Add `totalCycleSecs` helper.** A simple `getPatternCycleTime(pattern)` function resolves I1 cleanly.

5. **Consider localStorage for volume/pattern preferences.** Low cost, high UX value, stays within "no Firebase" Phase 4 scope.

6. **Scale the phase arc with container size.** The fixed 32px will feel lost on larger displays.
