# LOOP Deck Configurator — Concept B "The Turntable" (Design + Plan)

**Date:** 2026-07-10
**Status:** Approved design → implementation
**Surface:** `src/lib/features/store/LoopDeckConfiguratorPage.svelte` (`/shop/loop-deck`)
**Predecessors:** handoff `docs/superpowers/plans/2026-07-10-loop-configurator-concepts-handoff.md`,
research brief `docs/superpowers/specs/2026-07-10-loop-configurator-reimagining-brief.md`,
grounding workflow `wf_7ebe3669-551` (5 gather agents + Opus synthesis, 717k tokens).
**Scope:** presentation only. Concept A (Refined Bento, `d882677301`) is the shipped floor;
this replaces the preview + reflows the controls into the ceiling.

## Locked decisions (Austen, 2026-07-10)

1. **Concept B — The Turntable.** Not C (Dealing Table). Deciding axis, once the
   "visual work cannot be one-shot, must iterate eyes-on" constraint is factored: iteration
   cost per unit of *feel*. B has one degree of freedom and a bounded, parametric tuning
   surface (each dial is one number → nudge → re-screenshot). C's is combinatorial and
   per-card + a mobile bloom budget only verifiable on-device → multiplies the browser
   rounds → genuinely multi-session. C stays the someday Fable swing.
2. **Corner Satellites** desktop layout. Card is the hero dead-center; the 4 controls sit at
   the 4 corners. Corner reading order encodes **Prop → Level → Length → Flavor**. Below
   768px all 4 dock to a bottom rail; card + `$30` sticky.
3. **Premium + intro spin.** On load the card does one slow 3/4 turn (signals draggable),
   then rests and the canvas idles to zero redraw. Drag = spin with flick momentum + spring
   settle. Foil = subtle iridescence, catches only on tilt at masked print regions.

## Non-negotiables (from the brief — do not violate)

- Single screen, no wizard. Real primitives (`SegmentedControl` / `StepperCard` for
  Level/Length; tiles for Flavor/Prop). No sliders, dials, or dropdowns.
- Preview reacts <150ms on every pick; it is the toy.
- Dark-mode: deep-indigo ground (not pure black), alpha-gradient fills, faint grain, 1–2
  nebula orbs. Glass demoted to frames/overlays only.
- One reward loop: spring settle + haptic per commit. Restraint, GPU transforms, mobile-first.
- Presets + forgiving defaults (one tap to buy). Flat `$30` anchor persistently visible.
- Axis order by consequence: Prop → Level → Length → Flavor.

## Architecture — one new component composing reused seams

**New:** `src/lib/features/store/components/DeckTurntable.svelte`. A drop-in for
`<DeckFanCover>` inside `.preview-box`; mirrors its prop contract (`cards`, `deckId`,
`deckName`, `propType`, plus the accent/flavor inputs `DeckFanCover` already takes) so the
call site barely changes. Internals, all patterned on existing seams:

| Concern | Reused seam |
|---|---|
| Canvas + fixed `PerspectiveCamera` + 3-light rig | `src/lib/shared/3d/components/Scene3D.svelte:353-454` |
| 2D art → live 3D texture + retexture `$effect` | `src/lib/shared/3d/components/PropPlane2D.svelte:93-118` |
| Card image (raw `HTMLCanvasElement`, skip blob/URL) | `src/lib/features/store/services/cover-front-renderer.ts:215-220` (`renderFront()`) |
| Retexture concurrency + cache | same file `:129,145-161` (3-lane queue + `urlCache`) |
| Env-lit physical read (PMREM + RoomEnvironment) | `src/lib/shared/3d/components/scenes/ocean/OceanScene.svelte:108-120` |
| Idle perf | `renderMode="on-demand"` on `@threlte/core@8.3.1` + explicit `invalidate()` |
| Reward loop | `getHapticFeedback().trigger("selection")` + `Spring` (`svelte/motion`) |
| Static fallback | `src/lib/features/store/components/DeckFanCover.svelte` |

**Genuinely new (justified):**
- The component itself — no existing card-plane uses anything but flat `MeshBasicMaterial`.
- **Physical card body** — `RoundedBoxGeometry` (`@threlte/extras@9.7.1`, thin depth + bevel)
  + `MeshPhysicalMaterial` (clearcoat ~0.4, roughness ~0.35, metalness 0). Zero-thickness
  plane = "sticker" (Report 4 Pitfall #4); the bevel is what makes it an object.
- **Foil** — `iridescence` ~0.4 + an `iridescenceMap` mask texture (`colorSpace = NoColorSpace`)
  so hue-travel only catches on print regions. Cheapest convincing path, no custom shader.
- **Drag handler** (~20 lines, inside the component) — pointer-delta → `rotation.y`
  (+ small clamped `rotation.x` foil tilt) through a Svelte 5 `Spring`; release velocity =
  flick momentum decaying via the spring. Both alternatives are ruled out: repo's
  `interactivity()` is documented-broken (`ManualRaycaster.svelte` header: "bypasses broken
  Threlte interactivity"); `OrbitControls` orbits the *camera* around one centered object →
  gimbal-locks, reads as a viewer demo (Report 4 Pitfall #5). One object dead-center needs no
  raycast, so the hand-rolled path is *smaller* than adopting either.
- **iridescenceMap art asset** — a foil-region mask (new asset, not code).

## Layout — Corner Satellites (desktop) / bottom rail (mobile)

Edit `LoopDeckConfiguratorPage.svelte`:
- Swap `.preview-box` contents (`:322-341`, the `<Crossfade fill>`+`<DeckFanCover>`) →
  `<DeckTurntable>` inside the same `<Crossfade key fill>` wrapper. Card floats center-stage.
- Kill the 2-column `.config-layout` grid (`:678-689`). Controls dock at the 4 corners around
  the card, reading order **Prop → Level → Length → Flavor**.
- **Every control unchanged** — reuse the wired primitives, do not rebuild any:
  - Prop → existing `BaseCard` drill-to-`PropPicker` modal (`:421-442`)
  - Level / Length → existing `StepperCard`s (`:370-400`)
  - Flavor → existing `BaseCard` drill-to-modal radiogroup (`:405-414`)
- Presets row (`:352-365`), advanced panel (`:468-520`), `$30` anchor (`:522`), `BuyButton`
  (`:524-533`) all stay. Flat $30 stays visible.
- `< 768px`: the 4 corner satellites collapse to a bottom rail; card + `$30` sticky above.
- Dark ground: deep-indigo, alpha-gradient fills, faint grain, keep the 1–2 nebula radial
  orbs already painted on `.preview-box` (`:712-715`); glass on frames only. Tokens via the
  `styling` skill hierarchy — no hand-picked hex. Reserve the card-stage box height
  (`.preview-box` `clamp()` at `:719`) so retexture/stepper changes cause **no layout shift**.

## Motion + foil — premium + intro spin

- **Intro:** on mount, animate `rotation.y` one slow 3/4 turn via `Spring`/`Tween`, then rest.
  After settle, stop calling `invalidate()` → canvas idles to zero redraw.
- **Drag:** pointer events on the canvas wrapper (`touch-action: none` on that wrapper only);
  `deltaX → rotation.y`, small clamped `deltaY → rotation.x`; through the `Spring`. Release
  velocity → flick momentum (no inertia on release reads as a UI slider — Pitfall #6).
- **Foil:** `iridescence` + masked `iridescenceMap`; hue-travel on tilt only, on print regions.
- **Haptic:** `getHapticFeedback().trigger("selection")` on drag-start + every flavor / prop /
  preset commit. The one reward loop (spring settle already covers the visual half).
- **`invalidate()`** on every drag frame + spring tick + texture swap; nowhere else.
- `dpr={Math.min(devicePixelRatio, 2)}`.

## Fallback

`prefers-reduced-motion` OR no WebGL2 context → render `<DeckFanCover>` (the current static
fan), no 3D init. Gate on a WebGL-context probe + the reduced-motion media query.

## Boundaries — do NOT touch

Checkout, the `loopConfig` `$derived.by` builder (`LoopDeckConfiguratorPage.svelte:223-231`),
SKU `loop-deck-custom`, the Firebase whitelist, `BuyButton`, `createMerchCheckout`.

## Implementation ledger (checkbox — durable state across eyes-on rounds)

- [x] **Step 0** — Baseline screenshot of shipped Concept A at `/shop/loop-deck`. *(eyes-on #1)*
- [x] **Step 1** — Create `DeckTurntable.svelte`: Canvas + camera + light rig + env + card
      body + texture from `renderFront()`. No drag, no foil yet. Render one card static in a
      `src/routes/test/*` harness. *(eyes-on #2 ✓ — reads as lit object, bevel visible on tilt;
      baked cover via blob path = exact fan parity, MPC stripe frame kept)*
- [x] **Step 2** — Drag-to-spin + intro spin + haptic reward loop, driven by a `useTask` spring
      integrator (Svelte-Spring's own rAF desynced with on-demand render → froze mid-spin;
      the integrator self-sustains `invalidate()` and idles to zero on settle). Flick coasts
      by release velocity then **snaps the landing to the nearest full turn** so the card
      always rests facing the buyer (edge-on-rest was the first-attempt bug). *(eyes-on #3 ✓ —
      angled read shows bevel; firm flick spins + settles front)*
- [x] **Step 3** — Foil **redesigned after eyes-on**: the spec's `iridescence`+mask plan proved
      invisible (MPC face is ~85% white; thin-film hue-travel doesn't read on white even at max,
      verified at foil=1.0 grazing). Replaced with a **glossy lamination sweep** — `foil` drives
      clearcoat (0.35→0.95) + a tightened hotspot (clearcoatRough 0.20→0.03) + env-reflection
      boost (0.9→2.6), keeping a faint `iridescence` (foil·0.35) for the spectral edge. This is
      honest to the real laminated product and needs no per-card mask asset. *(eyes-on #4 ✓ —
      pose-A vs pose-B proved the specular band sweeps across the face on tilt; subtle, not
      plastic. Final intensity = the `foil` prop, Austen-tunable on the real page.)*
- [x] **Step 4** — Retexture-speed verified: baked-cover fetch+decode ~6-7ms warm (order of
      magnitude under budget). Rapid flavor cycling ×3 + prop swap Staff→Fan kept up — card
      rendered the correct Fan-prop BΦ- art, settled front, no stall/blank; fan parity held
      through the prop swap. *(eyes-on #5 ✓)*
- [x] **Step 5** — Layout swapped in `LoopDeckConfiguratorPage.svelte`. Killed the 2-col
      `.config-layout` grid; built a named-areas **Corner Satellites** grid: hero card spans
      rows 1-2 so Prop (TL) / Level (TR) / Length (BL) / Flavor (BR) pin to its four corners,
      `$30` + Buy in row 3 under the card. Reused every wired control (StepperCards, BaseCard
      drill-to-modal). DOM order Prop→Level→Length→Flavor→Buy = tab/reading order. Kept the
      nebula stage. `< 860px` reflows via ONE grid-template swap → card + `$30` on top, dials as
      a 2×2 bottom rail. Flavor description got a `min-height` reserve so it can't shove `$30`.
      *(eyes-on #6 ✓ — desktop corners hug the card [geometry: dials at card top/bottom edges];
      mobile 2×2 rail verified at 390px; `$30` y=927 constant across 5 flavor swaps, spread 0)*
- [x] **Step 6** — Fallback wired via `use3DPreview = mounted && isWebGL2Available() &&
      !reducedMotion()` (canonical primitives; SSR + first hydration render the fan → no
      mismatch). *(eyes-on #7 ✓ — forced reduced-motion via matchMedia patch + client-side
      remount: `hasCanvas:false`, fan renders in the Corner Satellites card slot, no 3D init)*
- [ ] **Step 7** — Gate: `npm run check` + `npm run build` green. Commit with explicit pathspec.

## Risk + eyes-on checklist

| Risk | Why | Catch at |
|---|---|---|
| Card reads as sticker/decal | zero-thickness plane, no edge | #2 — tilt, confirm bevel |
| Flat/plasticky "UI screenshot" | ambient-only light, no env map | #2/#4 — directional key + env specular |
| Baked highlights fight real lights | print art has painted shading | #4 — no double-shadow under rotation |
| Foil upside-down first swap | texture `flipY` at load | #3/#4 — check first frame after swap |
| Spin "stops dead" like a slider | no release inertia | #3 — flick → momentum + spring decay |
| Canvas never idles (battery/heat) | `renderMode` left default | #3 — frame time → ~0 idle; `invalidate()` only redraw |
| Retexture stall > 150ms | cold uncached `renderFront()` | #5 — PerfMonitor during swap; `prewarmCovers` |
| Layout shift on retexture/stepper | card stage box not height-reserved | #6 — swap every axis, nothing below moves |
| Mobile DPR too high | uncapped `devicePixelRatio` | Step 1 `dpr` cap; mobile emulation pass |
| Reduced-motion users get spinning canvas | 3D not gated | #7 — static fan, no WebGL init |

Verification uses **chrome-devtools MCP** (`emulate`/`resize_page` + `take_screenshot`) so the
sub-768px mobile branch is screenshot-verifiable — the gap the prior session's claude-in-chrome
viewport pin (~1477px) could not cover. Own dev server on `:5174` (5173 is Austen's).
