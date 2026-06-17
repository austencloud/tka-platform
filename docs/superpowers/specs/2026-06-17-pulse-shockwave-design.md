# Pulse → Pressure Shockwave — Design

**Status:** Designed (2026-06-17), approved in brainstorming, ready for plan.
**Leg:** Next in the effect-leg-bolstering walk (see
`active/2026-06-16-effect-leg-bolstering-design.md`). Predecessors bloom/zap/echo
shipped. Pulse was re-confirmed as the weakest remaining leg over sparkles/petals.
**Sketch:** `static/sketches/2026-06-17-pulse-scope.html` (served at
[/sketches/2026-06-17-pulse-scope.html](http://localhost:5173/sketches/2026-06-17-pulse-scope.html))
— runs the proposed math; the design below is calibrated to it.

---

## Why pulse is the weakest leg

`pulse-2d-renderer.ts` (257 LOC) is a pooled expanding-ring emitter. It already
computes per-tip `speed`, but speed is used **only to gate whether a ring
spawns** (the velocity/continuous triggers). The ring itself — radius, width,
alpha, color — is identical for a hard beat and a soft tap. The draw is a flat
stroked circle or a single radial-gradient band. No glow core, no depth, no
shape variation, no chromatic, no origin event.

Sparkles (particle physics, 3 spawn modes, burst-on-motion) and petals
(velocity-smoothed sway, ember rims, rotation ∝ velocity) are genuine
velocity-reactive sims and stay untouched. Pulse is the flattest and least
reactive of the bottom cluster. It earns the rebuild.

## Unique observable (slot check — `effects-earn-their-slot.md`)

Pulse is the **only** effect that emits a **born-then-detached radial front
anchored to the beat/energy of the moment it spawned.**

- **Distinct from bloom:** bloom is a stationary per-tip halo that breathes in
  place; pulse births a ring that detaches and expands outward.
- **Distinct from echo:** echo freezes discrete phantom *frames* on the beat;
  pulse expands a continuous *front*.
- **Distinct from zap:** zap draws connective bolts *between* tips; pulse is
  *radial* from a single tip.
- **Distinct from water:** water is a fluid droplet/surface sim; pulse is a
  beat/energy-anchored force ring with directional (Mach) deformation.

**Mechanical distinguisher after the rebuild:** the ring *encodes the energy of
its birth instant* in its size, brightness, and shape — you can read hit-strength
and travel-direction off a frozen frame. Nothing else does born-detached radial
fronts, and nothing else deforms directionally with velocity. This is a new
observable, not a restyle.

---

## The rebuild (`pulse-2d-renderer.ts`)

Each pooled ring gains three numeric fields: `birthEnergy`, `dirX`, `dirY`
(zero-alloc — the pool structs are pre-allocated). At spawn the renderer captures
`birthEnergy = clamp(speed / refSpeed, 0..1)` and the normalized motion vector.
Everything below reads those.

1. **Velocity → size + brightness.** A ring's effective max radius and peak alpha
   scale with `birthEnergy`, gated by the `velocityScale` knob:
   `R_max = maxRadius · (0.45 + 0.55 · velocityScale · birthEnergy)`,
   `peakAlpha = intensity · (0.45 + 0.55 · birthEnergy) · falloff`.
   Fast swing = bigger, brighter wave; soft tap = small, quiet.

2. **Mach-cone asymmetry [headline].** The ring is no longer a circle. Radius is
   modulated per sampled angle θ:
   `r(θ) = R · (1 − asym · cos(θ − travelAngle))`, a limaçon/teardrop that
   **bunches toward the travel direction** (Doppler/Mach compression). Critically
   `asym` carries a **base floor plus an energy term**:
   `asym = asymmetry · (0.4 + 0.6 · birthEnergy)` — a high-`asymmetry` preset
   reads as a teardrop *even at rest*, then deforms harder on fast swings. This is
   what makes presets distinguishable at any speed, not only on hard hits (the
   flaw caught in review).

3. **Eased expansion.** Front radius uses `easeOut(progress)` (= `1−(1−p)²`)
   instead of linear creep — the front shoots out then settles (the "snap").

4. **Hot leading front + soft wake.** For `style: "glow"`: trace the deformed
   outer path and a deformed inner path (`inner = 1 − (0.12 + thickness·0.22)`)
   and fill with `"evenodd"` → a single deformed-annulus fill (the colored wake),
   then a thin bright stroke on the outer path (front), then a **white-hot wedge**
   stroked over only the ~±7-segment arc centered on `travelAngle` (the bunched
   leading edge). For `style: "stroke"`: skip the band fill; stroke the outer path
   at `lineWidth = 1.2 + thickness·3` plus the same leading wedge.

5. **Detonation flash.** During the first ~140ms of a ring's life, draw a bright
   additive radial-gradient dot at the origin that collapses (shrinks + fades),
   scaled by `flash · birthEnergy`. The impact mark the wave leaves behind.

6. **Chromatic fringe.** When `chromatic · birthEnergy > 0.02`, stroke the
   deformed path twice more — once offset `+dir`, red; once offset `−dir`, blue —
   so only hard hits fringe. Same trick that landed on bloom/zap.

7. **Harmonic train.** A single trigger optionally emits `round(harmonics · 3)`
   trailing rings at ~110ms spacing with decaying amplitude (`amp = 1 − i·0.22`).
   This one knob spans two preset identities: **Heartbeat** (`harmonics ≈ 0.4` →
   one trailing ring = the paired "lub-dub" thump) and **Ripple**
   (`harmonics ≈ 0.9` → ~3 rings = concentric water trains). The train counts
   against `POOL_SIZE`.

### Perf constraint (discovered in the sketch, MANDATORY)

**No per-segment `shadowBlur`.** The first sketch called `shadowBlur` per path
segment (72 blurred strokes × every ring) and ground the machine to a halt.
`shadowBlur` is one of the most expensive Canvas2D ops; per-segment is
pathological. The hot front comes from the **band fill + a single bright stroke +
a short leading-edge wedge** — no shadow in the per-ring hot path. At most one
cheap blurred pass is acceptable, never per-segment.

### refSpeed calibration

`birthEnergy` normalizes against `refSpeed`. If `refSpeed` is set too high
relative to real in-app tip speeds, energy never approaches 1 and the deform
never fires (the exact miscalibration that made the sketch presets look
identical). The plan must calibrate `refSpeed` so a typical fast swing reaches
`birthEnergy ≈ 0.8–1.0`. Verify in-app, not just in the sketch.

### Determinism

Aging/decay stays frame-based via the existing `clock += dt` (the engine passes
`dt`; the QR export worker renders frames back-to-back, so this stays
deterministic). `Math.random` jitter is acceptable — pulse was never
deterministic. The harmonic-train delay is currently `setTimeout` in the sketch;
in the renderer it must be **frame-clock scheduled** (store a `releaseAt` clock
time per queued ring), never wall-clock `setTimeout`, so export stays correct.

---

## Config changes (recipe)

### 1. Intent + version (`effects-config.ts`)

Add to `PulseIntent`, bump `EFFECTS_CONFIG_VERSION` **19 → 20**:

| Field | Range | Default | Meaning |
|---|---|---|---|
| `velocityScale` | 0–1 | 0.5 | How much birth speed drives ring size + brightness |
| `asymmetry` | 0–1 | 0.45 | Mach-cone deform strength (with base floor in renderer) |
| `chromatic` | 0–1 | 0.30 | RGB fringe on high-energy rings |
| `flash` | 0–1 | 0.50 | Origin detonation flash strength |
| `harmonics` | 0–1 | 0.30 | Trailing overtone-ring count (`round(·3)`) |

All existing fields stay. `style` default flips `"stroke"` → `"glow"` (the rich
path; all four kept presets use glow).

### 2. Defaults (`defaults.ts`)

Add the five fields above to `DEFAULT_EFFECTS_CONFIG.pulse`; change
`style: "stroke"` → `style: "glow"`.

### 3. Migration (`migrations.ts`) — v19 → v20

- The five net-new fields auto-fill via the existing
  `pulse: { ...DEFAULT.pulse, ...input.pulse }` merge — a `// v19 → v20` doc
  comment is the only required code.
- **Default-echo remap** for `style`: a persisted value **equal to the old
  default** (`"stroke"`) remaps to `"glow"` so existing users get the richer
  front; any other persisted value (a user who deliberately chose glow, or chose
  stroke after this ships) is left alone. Exact bloom-v17 / led-v16 precedent.
- **Watch full-intent literals** elsewhere (translator tests, any pulse seed in
  `migrations.ts`) — five new required fields will break them; the cold typecheck
  catches it. Fix those sites.

### 4. Types + translator (`canvas2d-types.ts`, `canvas2d-translator.ts`)

`Pulse2DParams extends PulseIntent` already, so the new fields flow through.
`resolvePulse2D` stays a pass-through (`...intent` + the existing computed
`resolvedPalette`/`maxRadius`/`ringWidth`/`refSpeed`/`blendMode`). No new computed
field — `birthEnergy`/`dir` are runtime per-ring, not resolved params.

### 5. Renderer (`pulse-2d-renderer.ts`)

The rebuild above. Pool struct gains `birthEnergy`/`dirX`/`dirY`; `spawn`
captures them; the per-ring draw replaces the flat stroke/band with the
deformed-front pipeline. Harmonic train uses a frame-clock release queue.

### 6. Customize panel (`PulseCustomize.svelte`)

Append five slider-rows after the existing Thickness slider:
**Velocity → Size**, **Asymmetry**, **Chromatic Fringe**, **Detonation Flash**,
**Harmonics**. Match the existing `slider-row` pattern (0–1, step 0.05, %
readout). No new chip groups; Trigger/Style/Palette/Color/Tracking rows stay as
is. (No checkboxes — `no-checkboxes.md`. Chip groups already use the
button+`aria-checked` pattern.)

### 7. Presets (`pulse-presets.ts`) — 6 → 4

Keep **Sonar, Shockwave, Heartbeat, Ripple** (+ `pulse-custom` with `patch: {}`).
**Remove** `pulse-radar` and `pulse-void`. Each kept preset leans into one
always-visible identity. Re-tuned patches (starting values; in-app retune
expected):

| Preset | trigger | style | palette | intensity | reach | lifetime | thickness | velScale | asym | chr | flash | harm | identity |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Sonar** | beat | glow | sonar | 0.70 | 0.70 | 1.10 | 0.30 | 0.30 | 0.00 | 0.00 | 0.30 | 0.15 | pure concentric circles |
| **Shockwave** | velocity | glow | ember | 0.90 | 0.85 | 0.70 | 0.60 | 0.90 | 0.90 | 0.60 | 0.85 | 0.10 | directional teardrop + fringe + flash |
| **Heartbeat** | continuous | glow | neon | 0.70 | 0.50 | 0.85 | 0.45 | 0.50 | 0.20 | 0.15 | 0.60 | 0.40 | paired double-thump |
| **Ripple** | continuous | glow | ripple | 0.55 | 0.65 | 1.30 | 0.45 | 0.35 | 0.05 | 0.05 | 0.25 | 0.90 | multi-ring concentric trains |

`getSummary` unchanged (`trigger · style · palette`).

**Removed-preset migration note:** preset selection is stored as a string id in
`activePresets.pulse`. A user who had `"pulse-radar"` / `"pulse-void"` selected
keeps their actual ring **values** (presets are applied patches already merged
into `state.pulse`); only the highlighted chip is lost — it reads as Custom. No
config breaks, no migration code needed for the removal.

### 8. Test (`pulse-2d-renderer.test.ts`)

The fake ctx must implement every method the new renderer calls or it throws:
`createRadialGradient` (+ `addColorStop`), `fillRect`, `fill` (with `"evenodd"`),
`beginPath`/`moveTo`/`lineTo`/`arc`, `stroke`, `save`/`restore`, and the
`globalCompositeOperation`/`strokeStyle`/`fillStyle`/`lineWidth` setters. Assert:
energy 0 vs 1 produces different ring radius/alpha; `asymmetry > 0` produces a
non-circular path (sampled radii differ by angle); `harmonics` schedules the
right trailing count; no `shadowBlur` is set inside the per-segment loop.

---

## Verification

- `npx vitest run pulse-2d-renderer.test.ts` — inner loop.
- One cold `npm run check > /tmp/check.log 2>&1` at the commit gate; grep, don't
  re-run. Expect one broken full-intent literal from the new required fields —
  fix it.
- **In-browser (owed, desktop):** open pulse in the animation panel. Confirm: a
  fast swing births a visibly bigger/brighter ring than a slow one; Shockwave
  rings are directional teardrops that snap harder on speed and fringe RGB +
  flash on hard hits; Sonar stays pure circles; Heartbeat gives the paired thump;
  Ripple gives concentric trains. Confirm **no frame-rate regression** vs the old
  flat renderer (the perf constraint above is why).
- Commit with an **explicit pathspec** (shared index holds other agents' work) —
  `commit-only-your-own-changes.md`.

## Commit / tracking

Update the master progress doc
`active/2026-06-16-effect-leg-bolstering-design.md` "Completed this round" with
the pulse entry + commit SHA when done, and advance "Next leg" to re-assess the
remaining cluster.
