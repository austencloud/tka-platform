# Audit: Phase 6 — Phase-Chained Breathing

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase6-phase-chains-design.md`
**Auditor:** Claude Opus 4.6
**Date:** 2026-05-25

---

## VERDICT: CONDITIONAL PASS

The spec is technically sound in its core trigger/propagation model and integrates logically with the Phase 5 formation architecture. The data model is clean, topology functions are genuinely testable in isolation, and the scheduling approach (priority queue flushed per rAF) is correct. However, the spec over-scopes the UI surface (7 topologies, multi-chain, bidirectional, custom edge drawing) for what will realistically be a presets-only feature for 95%+ of users. The `BreathAnimator` contract depends on a Phase 5 interface that doesn't exist yet and whose design is deferred — this is a spec building on a spec building on unimplemented code. Ship a reduced scope and expand later.

---

## STRENGTHS

1. **Clean separation of scheduling from animation.** The `ChainBreathCoordinator` as a pure scheduling engine that dispatches events to per-mandala animators is the right architecture. It avoids the common trap of mixing timing logic into render code.

2. **Topology functions as pure functions.** `(topology, slotCount, slotPositions) => ChainEdge[]` is genuinely unit-testable with zero DOM or canvas dependency. This is a real claim, not spec hand-waving — the inputs and outputs are concrete.

3. **Hop-distance damping is mathematically well-defined.** `amplitude[i] = amplitude[0] * (dampFactor ^ i)` is simple, predictable, and the practical range guidance (0.7-1.0) shows the author tested the visual output at boundary values.

4. **Trigger point as a phase fraction.** Representing the trigger point as `[0, 1]` within the breath cycle is the right abstraction. It decouples chain timing from absolute wall-clock time, making the system period-invariant.

5. **Priority queue scheduling over setTimeout.** Using a frame-flushed priority queue avoids setTimeout jitter on animation-critical paths. This is the 2026 best practice for sub-frame event scheduling.

6. **Presets cover 90% of the visual design space.** Ring Wave, Grid Ripple, Spiral Cascade, Pulse and Echo, Star Burst — these five presets produce the compelling visuals. Most users will never touch the custom editor.

---

## ISSUES

### Critical

**C1: BreathAnimator contract depends on a non-existent Phase 5 interface.**

The spec defines a `BreathAnimator` interface with `onTriggerPointCrossed`, `receiveInhaleTrigger`, `currentPhase`, and `period`. Phase 5's spec says the per-mandala animation is a master-clock-driven phase computation inside the `FormationPane` RAF loop:

```
const phase = ((masterTime / period) + slot.phaseOffset) % 1;
```

There is no per-mandala animator object in Phase 5. The animation state is computed inline in a `for` loop over slots. Phase 6 requires Phase 5 to refactor this into per-slot animator objects that can emit trigger-point-crossing events and receive external inhale signals. This refactor is not mentioned in either spec. The existing `SequenceMandala.svelte` also uses an inline `$effect` RAF loop — not an animator object.

**Impact:** Phase 6 cannot be built on top of Phase 5 as specced without an unspecified intermediate refactor. The Phase 5 spec should be updated to extract per-slot animation into a `BreathAnimator` class, or Phase 6 should spec the refactor explicitly.

---

**C2: Queue-vs-immediate trigger semantics create phase discontinuities.**

Section "Trigger Semantics" rule 4: if the target is mid-exhale past the trigger point, the signal takes effect "immediately" — the target fast-forwards to start of inhale. This is a phase discontinuity: the mandala's `tipDx` jumps from a mid-exhale value to the inhale-start value in a single frame. For slow breath periods (5-10s), this jump is visually jarring — a mandala visibly snapping from semi-contracted to fully-contracted.

The spec should either: (a) add a fast-forward easing ramp (100-200ms ease to the new phase), or (b) always queue (simpler, never glitches, slightly less responsive). The "tight chase effects" justification doesn't outweigh the visual glitch risk at typical breath periods.

### Important

**I1: Bidirectional chain interference model is under-specified.**

The spec says: "the breathing signal is the average of the two triggers' phase positions, producing an interference-like interaction." This averaging is not defined precisely. Average of what? The two `hopCount` values? The two amplitude values? The two phase offsets? If mandala M receives a forward trigger at `hopCount=2` and a reverse trigger at `hopCount=5`, and damping is 0.85, the forward amplitude is `0.85^2 = 0.72` and the reverse is `0.85^5 = 0.44`. Averaging gives `0.58`. But what about timing? If the two triggers arrive at different times within the same breath cycle, averaging their phase positions means the mandala breathes at a phase that neither wave dictated.

This needs a concrete formula: `resultAmplitude = max(fwdAmplitude, revAmplitude)` or `resultAmplitude = (fwdAmplitude + revAmplitude) / 2`, and a clear rule for which trigger's timing wins (first-wins, as stated for multi-chain? or averaged?).

---

**I2: Seven topologies is over-scoped for Phase 6.0.**

Linear, Circular, Star, Branching Tree, Grid Ripple, Spiral Cascade, Random. Of these:

- **Linear and Circular** are the essential pair (covers lines and rings).
- **Star** is high visual impact, low complexity.
- **Grid Ripple** and **Spiral Cascade** are formation-type-specific (only valid for grid and polar formations respectively). They're nice but not essential for launch.
- **Branching Tree** requires the full custom edge editor to be useful — users can't define a tree from a quick-apply button alone (which tree? rooted where?). This pulls in the most complex UI for the least common use case.
- **Random** is trivial to implement but low-value — "random trigger order" reads as "broken chain" to most observers.

Recommendation: ship Linear, Circular, Star as Phase 6.0. Add Grid Ripple and Spiral as Phase 6.1. Branching Tree and Random as Phase 6.2 (if user demand materializes).

---

**I3: Multi-chain first-wins rule creates non-deterministic visual behavior.**

When a slot receives triggers from multiple chains, the spec says "earliest arriving trigger per cycle (first-wins)." In practice, two chains with similar delays will race: frame timing jitter determines which trigger arrives first. The winning chain may alternate frame-to-frame, causing the mandala to flicker between two amplitude/phase values.

Fix: either define a chain priority (lower chain index wins ties), or use the maximum-amplitude trigger (deterministic, visually stable).

---

**I4: No specification for what happens when a formation slot is removed mid-chain.**

The spec covers slot addition (topology quick-apply recomputes) but not slot removal. If a user reduces a ring-8 to ring-6 while a circular chain is active, slot indices 6 and 7 vanish. The chain's edges referencing those indices become dangling. The spec should state: "When formation slot count changes, reapply the active topology preset to the new slot count. If the chain was user-customized, remove dangling edges and warn the user."

### Minor

**M1: Damping slider range (0.7-1.0) is too narrow for the UI.**

The spec says the useful range is 0.7-1.0 and the slider should reflect that. But the data model allows 0.0-1.0. This mismatch between UI range and data model range means the editor can't produce values that the engine supports. Either widen the slider to 0.0-1.0 with a "useful range" indicator, or narrow the data model to match.

---

**M2: Topology quick-apply button count is wrong.**

The spec lists "five labeled buttons" but then enumerates six: `Linear`, `Circular`, `Star`, `Grid Ripple`, `Spiral`, `Random`. Either the count is wrong or one should be removed.

---

**M3: No mention of chain visualization in the mandala viewport.**

The chain editor shows edges as arrows in a top-down diagram. But the user has no visual feedback of the chain propagation in the actual mandala formation viewport. A subtle pulse traveling along formation edges (or a brief brightness flash on trigger reception) would confirm the chain is working. The spec explicitly excludes this ("Visual animation of the chain propagation itself... the editor shows static topology only") — reconsider, since without it users can't tell whether their chain configuration is producing the expected wave direction.

---

**M4: The `rootSlotIndex` field is a scalar but Star topology needs it to be the center, while Circular has no meaningful root.**

For Circular chains, which slot is the "root" (the autonomous clock node)? Slot 0 by convention? Any slot, since the chain is a cycle? The spec doesn't clarify. For user-defined trees, the root designation makes sense. For preset topologies, the root should be auto-assigned by the topology function and the field should be optional or computed.

---

**M5: Missing interaction with Phase 4 (Guided Meditation).**

Phase 4 syncs "inhale/exhale" prompts to the breath cycle. If a chain overrides a mandala's breath timing, the meditation prompts become desynchronized from the visual. The spec should note this incompatibility: "Phase 6 chains and Phase 4 meditation mode are mutually exclusive. Activating chains disables meditation prompts."

---

## RECOMMENDATIONS

1. **Spec the BreathAnimator refactor as a Phase 5.5 or as a required Phase 5 deliverable.** Phase 6 cannot ship without per-slot animator objects. Adding this to Phase 5's architecture now avoids a forced refactor later.

2. **Ship Phase 6.0 with presets only, no custom edge editor.** The drag-to-draw-edges UI is the most complex part of this spec and serves the smallest audience. Five preset topologies (Linear, Circular, Star, Grid Ripple, Spiral) applied via buttons cover the compelling use cases. The custom editor can follow in 6.1 if users ask for it.

3. **Replace the queue-vs-immediate split with always-queue.** Simpler implementation, no phase discontinuities, no edge cases. If tight chase effects are needed later, add an explicit "force restart" mode as an opt-in.

4. **Draw from DAW/modular synth UI patterns for the chain editor.** Ableton Live's Follow Actions (trigger rules on clip end), Bitwig's modulators (phase-offset LFOs chained across tracks), and VCV Rack's cable patching (drag-to-connect with visual signal flow) are direct precedents. The drag-to-draw-edges concept is sound but the spec should reference these patterns for the implementation team. In particular, VCV Rack's "draw a cable from output jack to input jack" is exactly the interaction model described here — the implementation should study its UX for edge cases (crossing cables, disconnecting, visual clutter at high edge counts).

5. **Add a "chain preview" indicator in the formation viewport.** Even a simple approach — briefly brightening each mandala on trigger reception — would close the feedback loop between the chain editor and the visual result. Without this, users configure chains blindly.

6. **Define chain behavior on formation resize explicitly.** "Reapply active topology preset on slot count change; warn if custom edges will be lost."
