# Phase 6: Phase-Chained Breathing — Web Research Audit

Audited: 2026-05-25  
Spec: `docs/superpowers/specs/2026-05-25-mandala-phase6-phase-chains-design.md`

---

## Findings

### 1. Coupled Oscillator Physics (Kuramoto Model)

**Spec says:** Each mandala is a discrete, event-driven oscillator. A trigger fires when a source mandala crosses its trigger point (a phase threshold), and the target queues an inhale. There is no continuous coupling force — the influence is a one-shot pulse. Phase propagates via discrete relay, not continuous mutual attraction.

**2026 SOTA:** The Kuramoto model is the canonical physics-based coupled oscillator framework. It works by applying a continuous coupling force to every oscillator on every time step: `dθᵢ/dt = ωᵢ + (K/N) Σ sin(θⱼ − θᵢ)`. JavaScript implementations exist and run in-browser, but the computational complexity is O(N²) for all-to-all topologies. Nearest-neighbor variants reduce this but still require an ODE solver loop running every rAF frame for all N oscillators. The resulting behavior is *gradual phase drift toward synchrony*, not a sharp traveling wave — oscillators with nearby natural frequencies lock together over multiple cycles before visually distinct phase chains emerge.

**Why Kuramoto doesn't fit this use case:** The spec's goal is a clearly readable *directed pulse* — a wave you can watch propagate from slot A to slot B to slot C. Kuramoto produces emergent synchrony that is beautiful in science visualizations but visually ambiguous as a composition tool. A user setting up a Ring Wave preset expects to see a discrete pulse orbiting the ring, not a diffuse drift toward phase-lock. The spec's trigger-relay model is the correct choice for this interaction intent.

Additionally, Kuramoto requires choosing coupling constant K and natural frequency distributions per oscillator — parameters with no intuitive mapping to "how fast does the wave travel." The spec's `delayFraction` control is a direct, interpretable substitute.

**Verdict:** ✅ Spec is current — the discrete trigger-relay model is the right choice for intentional composition tooling. Kuramoto is not wrong, it is simply the wrong physics for this UX goal. The spec's model is closer to a *leaky integrate-and-fire* (LIF) neuron network — a well-established discrete-event coupled oscillator model used in computational neuroscience, which produces sharp traveling waves by design.

**Recommendation:** No change to the physics model. If you want to note the LIF framing in a code comment for future engineers, `ChainBreathCoordinator` is conceptually a feedforward LIF network with one-shot trigger pulses and refractory period (the "always-queue" rule is the refractory period).

---

### 2. Graph / Network Visualization for Chain Topology Editor

**Spec says:** Phase 6.0 uses a read-only formation diagram showing topology edges as arrows. Phase 6.1 defers the custom edge editor (drag-to-draw arbitrary directed graphs). No library is specified.

**2026 SOTA:** Two mature options exist for Svelte specifically:

- **`@xyflow/svelte` (Svelte Flow)** — v1.5.2 as of March 2026, maintained by xyflow (same team as React Flow). Labeled "still alpha" but under active development. Supports draggable nodes, panning/zooming, edge drawing, custom node components, and dagre layout integration. The node count for formation diagrams (3–16 slots) is well within its performance envelope.

- **Svelvet** — lighter alternative, purpose-built for Svelte node-graph UIs. Less feature-rich but no alpha caveats.

- **`dagre`** — layout algorithm only (no rendering), relevant for auto-positioning the read-only diagram. Still maintained but labeled as feature-frozen; `elkjs` is the more capable successor for complex layouts, though overkill for ≤16 nodes.

The read-only diagram in Phase 6.0 does not require a graph library — it can be a hand-drawn SVG overlay on top of the existing formation placement diagram (which the spec already describes as a "top-down dot layout"). For Phase 6.1's custom edge editor, `@xyflow/svelte` is the SOTA pick.

**Verdict:** ✅ Spec is current for Phase 6.0 (SVG overlay on the existing diagram is correct). ⚠️ Phase 6.1 should evaluate `@xyflow/svelte` before hand-rolling an edge editor — it would save weeks of work.

**Recommendation:** In Phase 6.0, implement the read-only diagram as an SVG `<g>` layer over the formation dot diagram. When scoping Phase 6.1, spike `@xyflow/svelte` first. Svelvet is an acceptable fallback if xyflow's alpha status is a concern at that time.

---

### 3. Wave Propagation Visualization

**Spec says:** "Visual chain propagation animation (a 'pulse' traveling along edge arrows in the editor or viewport)" is explicitly out of scope. The chain behavior is confirmed by observing the mandalas themselves.

**2026 SOTA:** Wave propagation through a node network is typically rendered via one of two patterns:
1. A glowing dot or colored flash that travels along edge paths using SVG/canvas path animation (offset-path or stroke-dashoffset technique).
2. Radial ripple emanating from each node as it receives a trigger.

GSAP (used widely in 2025–2026 Codrops demos) offers clean path-following animation with `MotionPathPlugin`. WebGL shader ripples are the high-end approach (Codrops 2025 tutorial: animating WebGL shaders with GSAP for ripples/reveals).

The spec's decision to defer this is pragmatically correct — the traveling-pulse overlay would need to synchronize with the actual trigger firing times, which requires the `ChainBreathCoordinator` to be stable first. Building it on top of a working coordinator is far easier than building it alongside one.

**Verdict:** ✅ Spec is correct to defer this. The "watch the mandalas" approach is sufficient for Phase 6.0. If the overlay is added in Phase 6.1, the SVG stroke-dashoffset technique is the lowest-complexity path-following approach and doesn't require GSAP.

**Recommendation:** No change. When adding the visualization layer later, the `ChainBreathCoordinator` already emits trigger events — a thin visualization subscriber can listen to those same events and drive path animations without modifying the coordinator.

---

### 4. Animation Timing / Scheduling

**Spec says:** The `ChainBreathCoordinator` uses a priority queue of scheduled events keyed by target time. On each rAF, it flushes events whose scheduled time ≤ current time. This avoids `setTimeout` jitter on animation-critical timing.

**2026 SOTA:**

**WAAPI GroupEffect / SequenceEffect:** These are the W3C-specified API for coordinating multiple element animations with group and sequence semantics. Research confirms they are **not natively implemented in any major browser as of 2026** — they exist only in the Web Animations polyfill (web-animations-js, maintained by Google). The Level 2 spec is still a working draft. GroupEffect/SequenceEffect cannot be relied on for production animation in 2026.

**rAF priority queue pattern:** The spec's pattern — priority queue flushed in rAF, keyed by wall-clock target time — is the standard game-loop approach for simulation-accurate timing. Paul Irish's seminal `requestAnimationFrame` scheduling article and game-loop literature both confirm this is the correct pattern for animation-critical timing when `setTimeout`'s ±4ms jitter would produce visible phase errors.

The spec is correct that `setTimeout` is inappropriate here: at a 5-second breath period with a 12.5% delay (625ms), a 4ms setTimeout jitter is 0.64% phase error — unnoticeable. But at a 2-second period with a 10% delay (200ms), the same 4ms is 2% phase error, which accumulates over multiple hops in a Circular chain and produces visible drift within ~10 cycles.

**Verdict:** ✅ Spec is current. The rAF priority-queue approach is the 2026 SOTA for this use case. WAAPI GroupEffect/SequenceEffect are not viable alternatives in 2026.

**Recommendation:** No change to the scheduling design. One refinement worth adding: the coordinator should track `accumulatedDrift = (scheduledTime - actualFireTime)` per event and subtract it from the next scheduled delay on the same chain path. This prevents compounding drift in Circular chains over long sessions (each cycle's ±0.5ms timing slip compounds around the ring). This is the same correction technique used in MIDI sequencers.

---

### 5. Amplitude Interference (Bidirectional Chains)

**Spec says:** When forward and reverse waves arrive at the same mandala, the resolved amplitude is `max(aF, aR)`. The winning trigger determines `tipDx` peak. This is "amplitude interference (constructive at origin, amplitude competition at midpoints)."

**2026 SOTA:** Physically accurate wave superposition uses additive interference: `resolvedAmplitude = aF + aR`. This is what real waves do — overlapping wave fronts add their amplitudes, producing constructive interference where they meet (up to 2× the original amplitude). Destructive interference occurs when opposing waves cancel (for sinusoidal waves with opposite phase), but for this use case both waves are in phase with each other (both are positive inhale amplitude pulses), so destructive interference would not occur — you'd get pure constructive addition.

However, additive interference has a practical problem here: the combined amplitude could exceed the configured `baseDx` maximum, causing the mandala to expand beyond its design bounds. The spec would need a normalization cap: `resolvedAmplitude = min(baseDx, aF + aR)`.

**Comparing the two models:**
- `max(aF, aR)`: The stronger wave "wins." At the midpoint of a bidirectional chain (equidistant from both origins), both amplitudes are equal and the mandala breathes at the same amplitude as every other node. No visual distinction at the midpoint. Reads as "uniform wave meeting from both sides."
- `min(baseDx, aF + aR)`: At the midpoint, amplitudes add — the mandala breathes slightly larger than the endpoints. Midpoint reads as a "pressure node" of constructive interference. Visually richer.

The additive model is more physically grounded and produces a more interesting visual (the meeting-point bulges), but requires the normalization cap. The `max` model is simpler and produces a more uniform appearance.

**Verdict:** ⚠️ Better approach exists. The `max(aF, aR)` model is safe but visually flat. The additive model `min(baseDx, aF + aR)` is more physically accurate and produces a visible constructive interference effect at the midpoint. Given the spec's stated goal of "Lissajous-like visual patterns from simple inputs," the additive model would deliver more emergent visual complexity for free.

**Recommendation:** Change the interference formula to `resolvedAmplitude = min(baseDx, aF + aR)`. The normalization cap keeps the mandala within design bounds. Expose this as a per-chain toggle: `interferenceMode: 'additive' | 'max'` (default `additive`). This adds one line to the data model and a few lines to the coordinator's amplitude resolution logic.

---

### 6. Damping Model

**Spec says:** Amplitude decays geometrically per hop: `amplitude[i] = amplitude[0] * (dampFactor ^ i)`. `dampFactor` is a scalar in `[0, 1]`. The practical useful range is `0.7–1.0`.

**2026 SOTA:** Geometric (exponential) decay per hop is the standard model for wave damping in discrete networks. It directly maps to the physical concept of energy loss proportional to current energy per unit distance — identical to how sound attenuates in air, how light attenuates in a medium, and how signal decays in a lossy transmission line. This is `e^(-αd)` discretized to per-hop steps.

Spring-damper systems (mass-spring-damper / critically damped) are the alternative, but they model *temporal* decay (amplitude decaying over time within a single oscillation) rather than *spatial* decay (amplitude decreasing with hop distance). For the spec's use case — amplitude as a function of hop count, not time — geometric decay is the correct model.

Research on spring-damper vs. exponential decay for *interactive* animations (Josh Comeau, Framer Motion design principles, Orange Duck's spring-roll-call) confirms that underdamped springs feel "natural" for UI motion because of the slight overshoot. However, this applies to temporal animations (a UI panel sliding in), not to spatial propagation amplitude across a network. The spec is not modeling the *motion of each mandala over time* — it is modeling the *amplitude ceiling at each hop*. These are different problems requiring different math.

**Verdict:** ✅ Spec is current. Geometric decay is the correct model for spatial amplitude attenuation across a chain. Spring-damper physics apply to a different problem dimension.

**Recommendation:** No change. One optional enhancement: offer a second damping shape alongside geometric — a **linear ramp**: `amplitude[i] = amplitude[0] * max(0, 1 - i / maxHops)`. Linear decay produces a "fade to zero at the last node" effect with a predictable cutoff, which some users may find easier to reason about than exponential. This is a cosmetic addition, not a correctness fix.

---

## Summary Table

| Topic | Verdict | Action |
|---|---|---|
| Coupled oscillator physics (Kuramoto vs. trigger-relay) | ✅ Spec is correct | None — trigger-relay is the right model for this UX |
| Graph library for topology editor | ✅ Phase 6.0 correct; ⚠️ Phase 6.1 should evaluate `@xyflow/svelte` | Spike `@xyflow/svelte` before Phase 6.1 custom editor |
| Wave propagation visualization | ✅ Correct to defer | None — add as a `ChainBreathCoordinator` subscriber in Phase 6.1 |
| Animation scheduling (priority queue vs. WAAPI) | ✅ Spec is correct — WAAPI GroupEffect not browser-native | Consider drift correction for Circular chains |
| Amplitude interference (max vs. additive) | ⚠️ Better approach exists | Change to `min(baseDx, aF + aR)` with `interferenceMode` toggle |
| Damping model (geometric decay) | ✅ Spec is correct | Optional: add linear ramp as a second damping shape |

## Net Assessment

The spec's physics are sound. The most meaningful upgrade is the interference formula (finding 5): switching from `max` to additive-with-cap costs one line in the data model and produces visually richer bidirectional wave interactions. Everything else is either correct as written or correctly deferred. The scheduling architecture (rAF priority queue) is the right call given WAAPI GroupEffect's continued lack of native browser support in 2026.
