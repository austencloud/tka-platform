# Spec: Blend crossfades between pattern clips

**Date:** 2026-04-10
**Status:** Ready for implementation
**Owner:** Next available sub-agent
**Estimated size:** Medium (~3-4 hours)
**Priority:** After drop-image-on-timeline. Visual polish for the timeline playback experience.

---

## Context

The pattern timeline (shipped 2026-04-10, Phase 2a) already has clips, a playhead, and hard transitions. When the playhead crosses from one clip into the next, the `LedStaffPreview` snaps instantly to the new pattern. This is technically correct but feels abrupt.

The `PatternTimeline` domain type already has the hooks for blending:

```typescript
export interface PatternTimeline {
  readonly clips: readonly PatternClip[];
  readonly transition: "hard" | "blend";
  readonly blendBeats?: number;
}
```

`transition` is currently always `"hard"` and `blendBeats` is unused. This spec wires up actual blend rendering.

---

## Motivation

The user explicitly asked for crossfades as a core feature: *"a pattern can certainly change mid sequence and you should be able to transition during that change with a cross fade"*. The data model has been carrying the crossfade fields since Phase 2a; this ships the rendering.

---

## Goals

- Let the user toggle between `"hard"` and `"blend"` transitions via a UI control.
- When in blend mode, smoothly crossfade the LED staff from the outgoing clip into the incoming clip over `blendBeats` starting at the boundary.
- Crossfade is per-LED RGB interpolation, not a blackout/fade-out. At `t=0.5` you see 50% of each clip's current frame.
- The crossfade duration is user-adjustable via a `ScrubValue` (range 0.25-4.0 beats, default 1.0).
- Both blended patterns advance through their own cycles in sync (they share the staff's normalized cycle clock), so rainbows don't suddenly freeze during the transition.

## Non-goals

- **No per-clip fade-in/out curves.** Just linear per-LED lerp.
- **No fade-from-black** at the start of the first clip or after gaps. Gap behavior is unchanged (falls back to `activePattern`).
- **No crossfading into image-mode patterns with different LED counts.** Assume all clips have the same `ledCount` (which they will, since the timeline only paints with the current active pattern's LED count).
- **No retroactive changes to the POV disc preview.** The disc keeps showing the authoring pattern only. Crossfades are a staff-playback concept, not a disc concept.

---

## Design

### Blend semantics

A clip is in its "blend-in zone" when:

1. The playhead is within the first `blendBeats` of the clip (measured from `clip.startBeat`).
2. AND there is a **previous clip that immediately abuts** this one (`prev.endBeat + 1 === clip.startBeat`).

During the blend-in zone:

- `t = (playhead_oneBased - clip.startBeat) / blendBeats`, clamped to `[0, 1]`
- `t = 0` means we just crossed the boundary → 100% previous clip, 0% current clip
- `t = 1` means we're fully in → 0% previous clip, 100% current clip
- Output per LED: `lerp(prev.frame[i], curr.frame[i], t)`

Outside the blend-in zone (or when `transition === "hard"`, or when there's no abutting previous clip, or during gaps), rendering is the same as today — single pattern, no blending.

### Shared cycle clock

Both blended patterns need to be sampled at a consistent point in their cycles. The `LedStaffPreview` already has its own internal clock advancing `currentFrame` based on `cycleDuration`. We generalize this to a **normalized cycle position** `cyclePos ∈ [0, 1)` that advances regardless of which pattern is active, so:

```typescript
const framesPerSec = 1 / safeCycleDuration; // note: 1 cycle per cycleDuration seconds
cyclePos += dt * framesPerSec;
cyclePos = cyclePos - Math.floor(cyclePos);
```

To get a specific frame from any pattern:

```typescript
function frameAt(pattern: StripPattern, cyclePos: number): StripFrame {
  const idx = Math.floor(cyclePos * pattern.frameCount) % pattern.frameCount;
  return pattern.frames[idx];
}
```

Both the primary and secondary pattern get sampled at the **same** `cyclePos`, which keeps any time-varying behavior (rainbows, pulses) aligned during the crossfade.

**Migration note:** the existing `LedStaffPreview` currently tracks `currentFrame` in the primary pattern's frame index space. Change to `cyclePos` in `[0, 1)` space. Minor refactor.

### Derived `blendInfo` in poi-state

Replace the current `playbackPattern` derived with a richer `blendInfo`:

```typescript
interface BlendInfo {
  /** The clip currently under the playhead (or the fallback active pattern) */
  readonly primary: StripPattern | null;
  /** The outgoing clip, if we're currently crossfading in from one */
  readonly secondary: StripPattern | null;
  /**
   * Blend progress: 0 = fully secondary (just entered primary),
   *                 1 = fully primary (blend complete).
   * Always 0 when secondary is null.
   */
  readonly blendT: number;
}

const blendInfo = $derived.by<BlendInfo>(() => {
  // Free-run fallback: no clips
  if (patternTimeline.clips.length === 0) {
    return { primary: activePattern, secondary: null, blendT: 0 };
  }

  const oneBased = playheadBeat + 1;

  // Find the clip at the current beat. Track its index for previous-clip lookup.
  let currentClip: PatternClip | null = null;
  let currentIdx = -1;
  for (let i = 0; i < patternTimeline.clips.length; i++) {
    const c = patternTimeline.clips[i]!;
    if (oneBased >= c.startBeat && oneBased < c.endBeat + 1) {
      currentClip = c;
      currentIdx = i;
      break;
    }
  }

  // Gap: no clip at this beat
  if (!currentClip) {
    return { primary: activePattern, secondary: null, blendT: 0 };
  }

  // Hard mode or no blend configured
  if (patternTimeline.transition !== "blend" || !patternTimeline.blendBeats || patternTimeline.blendBeats <= 0) {
    return { primary: currentClip.pattern, secondary: null, blendT: 0 };
  }

  // Check if we're in the blend-in zone of currentClip
  const progressIntoClip = oneBased - currentClip.startBeat; // 0-based into clip
  if (progressIntoClip >= patternTimeline.blendBeats) {
    return { primary: currentClip.pattern, secondary: null, blendT: 0 };
  }

  // Only blend if the previous clip immediately abuts
  const prevClip = currentIdx > 0 ? patternTimeline.clips[currentIdx - 1] : null;
  if (!prevClip || prevClip.endBeat + 1 !== currentClip.startBeat) {
    return { primary: currentClip.pattern, secondary: null, blendT: 0 };
  }

  const t = Math.max(0, Math.min(1, progressIntoClip / patternTimeline.blendBeats));
  return {
    primary: currentClip.pattern,
    secondary: prevClip.pattern,
    blendT: t,
  };
});
```

Expose via the state's return object as `get blendInfo()`.

**Keep `playbackPattern` as a thin compatibility shim** that returns `blendInfo.primary` — this preserves the existing one-line API for any component that only cares about "what's the current pattern roughly" and doesn't need blend details. (Currently only `LedStaffPreview` reads it, but this future-proofs.)

### LedStaffPreview changes

The draw loop needs to:

1. Advance a normalized `cyclePos` by `dt / cycleDuration` per frame (wrap to `[0, 1)`).
2. Read `poi.blendInfo`.
3. If `secondary` is null, sample `primary` at `cyclePos` as today.
4. If `secondary` is not null, sample BOTH at `cyclePos` and lerp per LED:

```typescript
const frameA = frameAt(blendInfo.secondary, cyclePos); // outgoing
const frameB = frameAt(blendInfo.primary, cyclePos);   // incoming
const t = blendInfo.blendT;
const oneMinusT = 1 - t;

// For each LED, build a blended color:
const blendedColors = new Uint8Array(ledCount * 3);
for (let led = 0; led < ledCount; led++) {
  const off = led * 3;
  blendedColors[off]     = Math.round(frameA.colors[off]     * oneMinusT + frameB.colors[off]     * t);
  blendedColors[off + 1] = Math.round(frameA.colors[off + 1] * oneMinusT + frameB.colors[off + 1] * t);
  blendedColors[off + 2] = Math.round(frameA.colors[off + 2] * oneMinusT + frameB.colors[off + 2] * t);
}

// Use blendedColors as the frame for both staves
```

Both staves render the same blended frame (as today — they share one pattern).

**Performance note:** the blend is at most a few hundred bytes per frame, at 60fps. Negligible. No need to cache.

### UI: transition toggle + blendBeats scrub

Add to the `.controls-bar` in `PatternTimeline.svelte`:

```svelte
<button
  class="icon-btn"
  class:active={timeline.transition === "blend"}
  onclick={() => poi.setTransitionMode(timeline.transition === "blend" ? "hard" : "blend")}
  aria-label={timeline.transition === "blend" ? "Blend mode on (click for hard)" : "Hard mode on (click for blend)"}
  title="Transition: {timeline.transition}"
>
  <i class="fas {timeline.transition === 'blend' ? 'fa-wave-square' : 'fa-square'}" aria-hidden="true"></i>
</button>

{#if timeline.transition === "blend"}
  <ScrubValue
    label="Fade"
    value={timeline.blendBeats ?? 1.0}
    min={0.25}
    max={4.0}
    step={0.25}
    unit=" beats"
    format={(v) => v.toFixed(2)}
    onchange={(v) => poi.setBlendBeats(v)}
  />
{/if}
```

Add two new actions to poi-state:

```typescript
function setTransitionMode(mode: "hard" | "blend"): void {
  patternTimeline = { ...patternTimeline, transition: mode };
}

function setBlendBeats(b: number): void {
  const clamped = Math.max(0.25, Math.min(4.0, b));
  patternTimeline = { ...patternTimeline, blendBeats: clamped };
}
```

Initialize `blendBeats` to `1.0` in `createEmptyPatternTimeline()` (in `pattern-timeline-types.ts`) so the default is sane when the user flips the toggle:

```typescript
export function createEmptyPatternTimeline(): PatternTimeline {
  return { clips: [], transition: "hard", blendBeats: 1.0 };
}
```

### Visual hint on the timeline lane

When `transition === "blend"` AND clips are abutting, overlay a small dim band on the lane spanning `[clip.startBeat .. clip.startBeat + blendBeats)` for each non-first abutting clip. This shows the user *where* the crossfades will happen.

Styling: a semi-transparent diagonal-stripe pattern, rendered behind the clips themselves (`z-index: 1`). Non-interactive.

---

## Files to touch

1. `src/lib/features/poi/domain/pattern-timeline-types.ts` — set default `blendBeats` in `createEmptyPatternTimeline`.
2. `src/lib/features/poi/state/poi-state.svelte.ts` — add `blendInfo` derived, keep `playbackPattern` as shim, add `setTransitionMode` and `setBlendBeats` actions.
3. `src/lib/features/poi/components/LedStaffPreview.svelte` — refactor from `currentFrame` to `cyclePos`, consume `blendInfo` and perform per-LED lerp when `secondary` is non-null.
4. `src/lib/features/poi/components/PatternTimeline.svelte` — add transition toggle button, conditional `Fade` scrub, blend-zone visual overlay on the lane.

**No new files.**

---

## Implementation plan

1. Update `createEmptyPatternTimeline` default.
2. Add `blendInfo` derived and actions to poi-state.
3. Refactor `LedStaffPreview` to use `cyclePos` normalized clock.
4. Add blend rendering path in `LedStaffPreview` when `secondary` is non-null.
5. Add the transition toggle + Fade scrub to `PatternTimeline` controls.
6. Add the blend-zone overlay on the lane.
7. `npm run check` clean on touched files.
8. Verify in browser:
   - Paint two abutting clips with very different patterns (e.g., Solid red and Solid blue).
   - Hard mode: boundary snaps.
   - Switch to blend, set Fade = 2 beats.
   - Play back, observe a smooth purple midpoint during the transition.
   - Scrub Fade higher and lower, confirm the blend zone visibly widens/narrows on the lane AND the visual transition scales.

---

## Verification / acceptance criteria

- [ ] Toggling transition to Blend surfaces the Fade scrub; toggling back hides it.
- [ ] With two abutting Solid clips (red → blue) and Fade = 2 beats, objectively sampling the staff canvas at the midpoint of the blend zone shows roughly equal R and B channels (not a clean snap).
- [ ] With three patterns (Rainbow → Pulse → Solid) and Fade = 1 beat, the staves show visible smooth transitions at each boundary during playback.
- [ ] Non-abutting clips (with a gap between them) do NOT blend — the gap still falls back to `activePattern`.
- [ ] The blend-zone overlay on the lane is visible only for blend mode and only on the first `blendBeats` of clips whose predecessor abuts.
- [ ] Disc preview is unaffected.
- [ ] Hard mode still works identically to today.

---

## Open questions / future work

- **Non-linear blend curves** (ease-in, ease-out, s-curve) — deferred.
- **Blend-out instead of blend-in** — current model blends over the first N beats of the incoming clip, "consuming" time from the incoming side. An alternative is to blend over the last N beats of the outgoing clip. These feel slightly different musically. Stick with blend-in for v1.
- **Blend at gap edges** — if we wanted to fade from `activePattern` → clip across a boundary, we'd need additional logic. Deferred.
