# Effects Phase 1d (Revised): Echo — Beat-Onset Phantoms

**Status:** Spec (2026-04-17). Replaces the initial Motion design (which was shipped but rejected as visually derivative of trails). Rebuilds in-place on the existing Phase 1d scaffolding.

**Goal:** Replace the derivative "Motion" effect with **Echo** — stroboscopic phantoms of the prop captured at each beat onset that persist and fade over N beats. Earns its slot by visualizing something no other effect shows: the **discrete beat lattice** of a TKA sequence.

## Why Echo, not Motion

Motion as shipped was ghost-stamps + anime speed-lines. Ghost-stamps duplicate trails with lower opacity. Speed-lines look like scratches in isolation on a dark canvas. Both are continuous; neither aligns with TKA's beat grammar.

Echo is fundamentally different from every other effect:

| Effect | What it visualizes |
|--------|-------------------|
| Trails | continuous path through space |
| Fire / Charcoal | emission/energy at tips |
| LED | pattern along staff length |
| Zap | connection between props |
| Sparkles | ornament on motion |
| **Echo** | **discrete station positions at each beat** |

Echo = stroboscopic photography. A phantom of the staff freezes at its pose at each beat onset and dissolves over the next N beats. The viewer sees the beat lattice as a constellation of phantoms — the *punctuation* of the sequence, not its continuous line.

## Intent shape

Replace `MotionIntent` with `EchoIntent`. Effect type `"motion"` → `"echo"` throughout. Bump `EFFECTS_CONFIG_VERSION` 5→6 with a migration that renames `motion` → `echo` in `tipEffectMap` entries and rewrites the old motion intent fields into new echo defaults.

```ts
export interface EchoIntent {
  /** 0-1 — phantom peak alpha. */
  intensity: number;
  /** 1-8 — how many beats a phantom persists before fully fading. */
  decay: number;
  /** Capture interval in beats. 1 = every beat, 0.5 = every half-beat, 2 = every other beat. */
  interval: number;
  /** "staff" = line connecting blue/red tip pair; "tips" = dots at each tip; "both" = line + dots. */
  shape: "staff" | "tips" | "both";
  /** "solid" = use color, "rainbow" = hue shifts per-beat (rainbow constellation), "prop-matched" = blue tips blue, red tips red, "gradient" = hue shifts per-phantom-age. */
  colorMode: "solid" | "rainbow" | "prop-matched" | "gradient";
  /** Hex — when colorMode === "solid". */
  color: string;
  /** 1-8 — stroke width / tip dot size in 2D. */
  thickness: number;
}
```

**Defaults:**

```ts
echo: {
  intensity: 0.7,
  decay: 4,
  interval: 1,
  shape: "staff",
  colorMode: "solid",
  color: "#ffffff",
  thickness: 3,
},
```

## Architecture

Reuses the entire Phase 1d scaffolding with renames:

- `EffectType`: `"motion"` → `"echo"` (bump version 5→6, migrate `tipEffectMap` entries).
- `MotionIntent` → `EchoIntent` (new fields).
- `Motion2DRenderer` → `Echo2DRenderer` (new internals).
- `Motion2DParams` / `Motion3DParams` → `Echo2DParams` / `Echo3DParams`.
- `IMotionOverlayRenderer` → `IEchoOverlayRenderer`.
- `MotionOverlayRenderer` wrapper → `EchoOverlayRenderer`.
- `motion-presets.ts` → `echo-presets.ts`.
- `MotionCustomize.svelte` → `EchoCustomize.svelte`.
- `syncMotionOverlay` → `syncEchoOverlay`.
- `motionRenderer` / `motionConfig` / `prevMotionIntentRef` / `lastMotionFrameTime` / `motionActive` / `motionDisabledByError` / `consecutiveMotionErrors` — all renamed `motion` → `echo` throughout `AnimationEngine.svelte.ts` and `AnimationRenderLoop.ts`.
- `EffectsLayer.svelte` — REMOVE the `MotionBlur` + `SpeedLines` mounts; add a new `GhostStaff3D` component that renders snapshot meshes. Legacy `PropMotionEffects` mount stays (Phase 3 retires it).
- Chip label + icon: `fa-wind` → `fa-clone` (phantom copies read better than wind).

### Echo2DRenderer internals

Per-tip-pair state:
- `lastBeatIndex` per prop (floor of `currentStep / interval`) — last captured beat.
- `phantoms[]` per prop — array of captured snapshots `{ blueA, blueB, redA, redB, beat, age }`. Cleared on `dispose()`.

Each frame:
1. Compute `beatIndex = floor(currentStep / params.interval)`.
2. If `beatIndex > lastBeatIndex` — capture the current tip positions as a new phantom (blueA/blueB/redA/redB). Set `phantom.beat = beatIndex` and `phantom.age = 0`. Update `lastBeatIndex`.
3. Advance every phantom's `age` by `(dt * bpm / 60 / params.interval)` — age in intervals.
4. Cull phantoms where `age >= params.decay`.
5. Render each phantom:
   - alpha = `params.intensity * (1 - age / decay)`
   - color picked by `colorMode`:
     - `solid` → `params.color`
     - `rainbow` → `hsl((beatIndex * 47) % 360, 80%, 60%)` (47° per beat = pleasing non-repeating cycle)
     - `prop-matched` → separate blue/red strokes use `tipColors.blue`/`tipColors.red`
     - `gradient` → `hsl((age / decay) * 240, 80%, 60%)` (fade from red→violet across decay)
   - If `shape` includes `staff`: draw line from `blueA→blueB` with `lineWidth = thickness`, stroke color as above. Repeat for `redA→redB`.
   - If `shape` includes `tips`: draw filled circles at each tip, radius `thickness`.

Beat onset requires `currentStep` and `bpm` — pass them through `RenderFrameParams` (`currentStep` is already there; `bpm` needs threading if not present — reuse what the sparkles/zap tip pipeline uses).

**Additive blend (`globalCompositeOperation = "lighter"`)** so overlapping phantoms brighten where the prop returned to a position.

### Echo3D rendering

Replace `MotionBlur` + `SpeedLines` mount in `EffectsLayer.svelte` with a new `GhostStaff3D.svelte` component.

`GhostStaff3D` maintains a ring buffer of captured poses per prop. At each beat onset, snapshot `{ worldPosition, worldRotation }` from the current `PropState3D`. For each phantom in the buffer, render a translucent copy of the staff mesh at the snapshot pose. Use `T.Mesh` + `T.CylinderGeometry` matching `AUSTEN_STAFF` dimensions with `MeshBasicMaterial transparent opacity={alpha} color={resolvedColor}`.

Beat onset detection in 3D: subscribe to the same `currentStep` signal the 2D renderer reads, or use a reactive `$derived` on `floor(currentStep / interval)` passed down from `EffectsLayer`.

### Presets

Four named + Custom:

1. **Stroboscope** — white, decay 4, interval 1, staff shape, solid — the classic look. *Preview color: `#ffffff`*
2. **Rainbow Trail** — rainbow, decay 6, interval 1, staff — each beat a different color. *Preview: `rainbow`*
3. **Twin Ghosts** — prop-matched, decay 3, interval 1, both (staff+tips) — blue phantoms + red phantoms side by side. *Preview: prop pair*
4. **Pulse** — cyan, decay 2, interval 0.5, tips only — tight strobing dots on every half-beat. *Preview: `#22d3ee`*
5. **Custom**

### Customize panel

- Shape chip row: Staff / Tips / Both
- Color mode chip row: Solid / Rainbow / Prop-Matched / Gradient
- Conditional color picker: shown only when `colorMode === "solid"`
- Sliders: Intensity (0-1), Decay (1-8 beats, step 0.5), Interval (0.25-2 beats, step 0.25), Thickness (1-8, step 1)

## Task breakdown

Ordered by dependency:

1. **Rename `motion` → `echo` in EffectType + EffectsConfig + defaults + migrations v5→v6** (also migrate `tipEffectMap` entries + old intent field names).
2. **Rename contracts + wrapper class** (`IMotionOverlayRenderer` → `IEchoOverlayRenderer`, `MotionOverlayRenderer` → `EchoOverlayRenderer`, `MotionTipInput` → `EchoTipInput`).
3. **Rename 2D renderer file + class** (`Motion2DRenderer` → `Echo2DRenderer`) — keep the skeleton, new implementation comes in Task 4.
4. **Implement `Echo2DRenderer`** with beat-onset phantom logic + unit tests (replacing the ghost-stamps/speed-lines implementation).
5. **Thread `currentStep` + `bpm` through to `renderFrame`** — verify `RenderFrameParams.currentStep` reaches the echo render path; add `bpm` if missing.
6. **Rename all `motion` references in AnimationEngine + AnimationRenderLoop to `echo`.**
7. **Replace 3D mount in `EffectsLayer`** — remove `MotionBlur`/`SpeedLines`, add new `GhostStaff3D.svelte`.
8. **Build echo presets** (`echo-presets.ts`) — Stroboscope / Rainbow Trail / Twin Ghosts / Pulse / Custom. Delete `motion-presets.ts`.
9. **Build `EchoCustomize.svelte`** — Shape chip row + colorMode chip row + conditional picker + 4 sliders. Delete `MotionCustomize.svelte`.
10. **Update `EffectsPanel.svelte` routing** — `getPresetGroup` returns `ECHO_PRESET_GROUP` for `"echo"`; mount `EchoCustomize` for `"echo"`.
11. **Update `EffectSelector`** — chip id `motion` → `echo`, label `Motion` → `Echo`, icon `fa-wind` → `fa-clone`. Update `EFFECT_COLORS` and `EFFECT_LABELS` maps in `EffectsPanel.svelte`.
12. **Final verification** — build, tests, manual visual check if possible.

## Test plan

- **Unit:** `migrations.test.ts` v5→v6 case (motion→echo rename + field defaults). `Echo2DRenderer.test.ts` covering: beat-onset capture triggers at interval boundary, decay culls phantoms after `decay` beats, alpha decays linearly with age, `dispose()` clears phantoms.
- **Integration:** build + check pass at every commit boundary.
- **Visual:** each preset produces distinct output. Stroboscope = white staff lines fading. Rainbow Trail = multi-color staff lines. Twin Ghosts = blue + red side-by-side. Pulse = tight cyan dot pulses on half-beats.

## Non-goals (deferred)

- Velocity-reactive decay (faster motion = longer phantom persistence)
- Per-phantom subtle drift/sag
- "Burn-in" mode where phantoms never fade (accumulate permanently across sequence)
- Audio-reactive beat detection (use TKA's authoritative step index, not FFT)

## References

- Phase 1c tag: `phase-1c-sparkles-complete`
- Phase 1d Motion (rejected, being replaced): commits `9c192d8bd7..6a8b14b2c4`, tag `phase-1d-motion-complete` (will be moved or deleted)
- Deferred items: `docs/superpowers/specs/effects-unification-deferred-items.md`
