# Phase-Chained Breathing — Design Spec (Mandala Phase 6)

## Overview

Phase-Chained Breathing adds causal connections between mandalas in a formation (Phase 5). Without chains, each mandala breathes independently — the user controls phase offsets as static numeric values. With chains, one mandala's breath cycle actively triggers its neighbors. The result is a breathing relay: a pulse of expansion and contraction that propagates through the formation as a wave.

This is distinct from Phase 5's static phase offset. Phase offsets are set-and-forget geometry; chains are dynamic, time-ordered causality. A formation can use both simultaneously: a circular chain topology produces a traveling wave, while phase offsets could additionally stagger that wave's amplitude across rows.

**Depends on:** Phase 5 (Formations). Chains require at least two mandalas.

**Phase 5 prerequisite (BreathAnimator refactor):** Phase 5 currently computes per-mandala phase inline in a for-loop inside the FormationPane RAF: `const phase = ((masterTime / period) + slot.phaseOffset) % 1`. Phase 6 requires each slot to be wrapped in a `BreathAnimator` object that can emit trigger-point-crossing events and receive external inhale signals. This refactor must be delivered as part of Phase 5 (or as a discrete Phase 5.5 deliverable) before Phase 6 can be built. The `BreathAnimator` interface is defined in the Technical Architecture section below. Phase 6 is blocked until this interface exists.

**Phase 6.0 scope:** Linear, Circular, and Star topologies only — presets-only UI, no custom edge editor. Grid Ripple, Spiral Cascade, Branching Tree, and Random are deferred to Phase 6.1/6.2. See Deferred Topologies section.

---

## Chain Topologies (Phase 6.0)

A topology defines which mandalas fire after which. Each topology is a directed graph where nodes are mandala slots in the formation and edges are trigger relationships.

Phase 6.0 ships three topologies. Four additional topologies are deferred to Phase 6.1/6.2 (see Deferred Topologies below).

### Linear

A → B → C → D → … → N. Exhale of slot 0 triggers inhale of slot 1, exhale of slot 1 triggers slot 2, and so on. The wave terminates at the final slot (no loopback). Useful for line and diagonal formations: the wave sweeps from one end to the other and dies.

The root slot (`rootSlotIndex`) is always slot 0 for Linear. It runs on the autonomous breath clock; all other slots breathe only when triggered.

### Circular

Like Linear but with a loopback edge from the last slot to slot 0. The wave never terminates — it keeps cycling around the ring. Natural fit for the circle formation. The speed control determines how fast the pulse orbits.

For Circular topology, `rootSlotIndex` is 0 by convention. The "root" concept is nominal — any slot in the cycle could be considered the clock source. Slot 0 is the designated autonomous clock that primes the cycle on first activation.

### Star

One designated center mandala triggers all others simultaneously on its exhale. No cascading: the center fires, all N outer mandalas receive the trigger at the same moment (subject to propagation delay). Outer mandalas do not trigger each other. Best for formations with a clear focal point: diamond's center, triangle's apex.

`rootSlotIndex` must be set to the center slot. The chain editor's "Apply Star" button auto-selects the geometrically central slot (closest to the centroid of all slot positions). User can override via the root designation control.

---

## Deferred Topologies (Phase 6.1+)

The following topologies are out of scope for Phase 6.0. They are documented here for planning continuity but must not be built until Phase 6.0 ships.

### Grid Ripple (Phase 6.1)

A rectangular grid where the trigger source is one corner (or the center). Each slot triggers the slots one step further from the source in Manhattan distance. Slots at equal distance fire simultaneously. Produces a concentric expanding square wave pattern. Valid only for grid formations. Deferred because it is formation-type-specific and the Grid Ripple preset in Phase 6.0 is removed.

### Spiral Cascade (Phase 6.1)

Triggers follow the polar ordering of slots from the innermost outward (or outermost inward). Requires a polar formation (ring, concentric rings). Deferred for the same reason as Grid Ripple — formation-type dependency adds complexity that isn't warranted at launch.

### Branching Tree (Phase 6.2)

A rooted tree where each parent triggers its children on exhale. The root has no parent — it runs on its own autonomous breath clock. Tree structure is user-defined via the chain editor. Enables asymmetric cascades: a main wave branches into sub-waves at each junction. Deferred because Branching Tree's value is only realized with the custom edge editor, which is also out of Phase 6.0 scope.

### Random (Phase 6.2, if demand materializes)

On each breath cycle, each mandala receives a trigger from a randomly selected predecessor. The random seed is fixed per session to ensure the pattern is repeatable within a view, but changes each time the formation is restarted. Useful for ambient or generative modes. Low priority: random trigger order reads as "broken chain" to most observers without context.

---

## Trigger System

### Trigger Point

The trigger point is the phase value within a mandala's breath cycle at which it fires its outgoing trigger. Represented as a fraction in `[0, 1]` where:

- `0.0` = start of inhale
- `0.5` = peak expansion (maximum tip dx)
- `1.0` = end of exhale / return to contracted state

Default: `1.0` (fire at full contraction — the natural "passing the baton" moment).

The trigger point is a per-chain scalar, not per-edge. All edges in a chain fire at the same trigger point. Configurable via a slider in the chain editor with labeled stops:

| Label | Value | Description |
|---|---|---|
| Peak Inhale | 0.5 | Fires at maximum expansion |
| Full Exhale | 1.0 | Fires at full contraction (default) |
| Early Release | 0.75 | Fires while still contracting, mid-exhale |
| Quarter Inhale | 0.25 | Fires just after the new cycle begins |

Advanced mode exposes raw `[0, 1]` input for precise control.

### Trigger Semantics

When mandala A fires its outgoing trigger:
1. The trigger is emitted with a timestamp.
2. After the propagation delay for each outgoing edge, the target mandala receives a "start inhale" signal.
3. The signal is **always queued** — it takes effect at the start of the target's next natural breath boundary (end of the current exhale), regardless of where the target currently is in its cycle.

There is no "immediate restart" path. The previous spec had a queue-vs-immediate split based on cycle position, which caused visible phase discontinuities at typical breath periods (5–10s): a mandala would snap from a mid-exhale `tipDx` value to the inhale-start value in a single frame. Always-queue eliminates this glitch class entirely.

**Smooth phase interpolation for long queued delays:** If the target mandala receives a queued trigger while it has more than 40% of its breath period remaining before the natural boundary, the animator applies a gentle ease-out to arrive at the contracted state slightly early (over a 200ms window ending at the boundary). This means the mandala appears to "settle" into the contracted state before restarting, rather than abruptly cutting at the boundary. The 40% threshold and 200ms ease window are implementation constants tunable in `BreathAnimator`.

If a second trigger arrives for a mandala that already has a queued trigger, the later trigger replaces the earlier one (last-write-wins for queued triggers on the same slot).

### Propagation Delay

Propagation delay is the time between when a trigger is emitted and when the target mandala receives it. A scalar `delayMs` per chain, ranging from 0ms (instant) to the full breath period.

A more intuitive control: **delay as a fraction of breath period**. Setting `0.0` means the next mandala starts its inhale the instant the previous one fires. Setting `0.25` means it waits one quarter of the breath period. The underlying engine converts this fraction to wall-clock ms based on the global breath period.

Wave speed = number of mandalas the trigger front advances per breath period. With `delay = 1/N` (where N = number of slots in the chain), the wave completes exactly one full pass per breath cycle — visually, one continuous rolling wave.

---

## Damping

Damping controls whether each successive hop in the chain breathes with less intensity than its predecessor. Implemented as an amplitude multiplier per hop: `amplitude[i] = amplitude[0] * (dampFactor ^ i)`.

- `dampFactor = 1.0` — no damping, all mandalas breathe with the same min/max dx range (default)
- `dampFactor = 0.8` — each hop breathes at 80% of the previous hop's range
- `dampFactor = 0.0` — only the trigger source breathes; targets receive zero amplitude

The practical useful range is `0.7–1.0`. Below 0.7 the chain fades out too quickly to be visible past the second or third hop.

Damping is applied to the **dx range** (the undulation amplitude), not to the breath period or speed. The contracted state (dx min) stays constant across all hops; only the peak expansion (dx max) decreases with each hop.

**Damping curve:** The default decay shape is geometric (exponential per hop), which matches physical energy loss in discrete networks. An optional linear ramp is also available:

- `'geometric'` (default) — `amplitude[i] = amplitude[0] * (dampFactor ^ i)`. Decay slows as it approaches zero; even high-hop nodes retain nonzero amplitude. Most natural-feeling.
- `'linear'` — `amplitude[i] = amplitude[0] * max(0, 1 - i / effectiveMaxHops)` where `effectiveMaxHops` is the longest path from root to leaf in the chain graph. Reaches exactly zero at the terminal node; predictable cutoff. Useful when the user wants the wave to visually "fade to nothing" at a known endpoint rather than asymptotically approach it.

Exposed as `dampingCurve: 'geometric' | 'linear'` in the chain data model (default `'geometric'`). The UI control is a two-option segmented button adjacent to the Damping slider, hidden unless damping is set below 1.0.

---

## Bidirectional Chains

Bidirectional mode adds the reverse edge to every directed edge in the chain, creating simultaneous waves traveling in both directions. For Circular topology this means two counter-rotating pulses; for Linear it creates a wave that bounces back from the end slot.

Bidirectional chains are implemented by running two independent trigger passes — a forward pass and a reverse pass — with the same trigger point and delay parameters. Each mandala participates in both passes simultaneously.

**Interference formula when both waves arrive at the same mandala:**

When mandala M receives a forward trigger (hop count `hF`, amplitude `aF = baseDx * dampFactor^hF`) and a reverse trigger (hop count `hR`, amplitude `aR = baseDx * dampFactor^hR`), the resolved breath amplitude is:

```
resolvedAmplitude = min(baseDx, aF + aR)
```

The additive formula produces a visible constructive-interference bulge at the midpoint of a bidirectional chain — where both waves arrive with equal amplitude, the mandala breathes slightly larger than the endpoints. This is more physically accurate (wave superposition adds amplitudes) and delivers more emergent visual complexity for free. The `min(baseDx, ...)` cap keeps the mandala within its configured design bounds.

**`interferenceMode` setting:** The interference formula is exposed as a per-chain option:

```typescript
interferenceMode: 'additive' | 'max'   // default: 'additive'
```

- `'additive'` (default) — `min(baseDx, aF + aR)`. At midpoints, the two equal-amplitude pulses constructively interfere, producing a larger breath than at the endpoints. Reads as a "pressure node" where the two wave fronts meet.
- `'max'` — `max(aF, aR)`. The stronger wave wins. At equidistant midpoints both amplitudes are equal and the tiebreaker forwards the forward-pass trigger. Produces a uniform appearance — all nodes breathe at similar amplitude with no midpoint distinction. Use when predictable, flat amplitude behavior is preferred over emergent complexity.

**Timing when both triggers arrive in the same cycle:** the queuing rule (always-queue) applies to both independently. When both arrive before the breath boundary in the same cycle, the coordinator combines them per the active `interferenceMode` rule and enqueues a single composite trigger. If they arrive in different cycles, each triggers the slot's next breath independently — the interference rule applies only when both arrive within the same cycle.

The "interference-like interaction" is amplitude interference (constructive at origin, additive superposition at midpoints in the default mode), not phase interference. Mandalas breathe at their natural phase; only the peak expansion varies by wave superposition.

Bidirectional mode is off by default and toggle-able per chain.

---

## Multiple Simultaneous Chains

A formation supports any number of named chains simultaneously. Each chain is an independent directed graph operating over the same pool of formation slots.

Constraints:
- A slot can appear in multiple chains. When it receives triggers from multiple sources within the same breath cycle, it uses the **highest-amplitude trigger** (not earliest-arriving). If two triggers have equal amplitude, the trigger from the chain with the lower index in the `chains` array wins. This rule is deterministic regardless of frame timing jitter — the winning trigger is always the same for a given configuration.
- A slot can be the source node in multiple chains simultaneously (it fires to all outgoing edges across all chains on its exhale).
- Cycles within a single chain are valid (that's what Circular topology is). Accidental cycles in user-defined trees are detected and highlighted in the editor with a warning — they don't crash, but the user should be intentional about them.

Use case for multiple chains: a hexagonal formation with a primary circular wave chain (all 6 outer slots) plus a secondary chain where opposite-corner pairs breathe in synchrony. Two chains, different topologies, coexisting.

---

## Formation Slot Changes

When the formation's slot count changes (user adds or removes mandalas while chains are active), the following rules apply:

### Slot added

The new slot is appended at the highest index. Existing chain edges are unaffected. The chain editor displays the new slot as an unconnected node. The user may reconnect it manually, or re-apply a topology preset to incorporate it.

### Slot removed

When a slot is removed:
1. All chain edges referencing the removed slot index (as either `sourceSlotIndex` or `targetSlotIndex`) are immediately deleted — dangling edges are never allowed to persist.
2. Slot indices above the removed slot are decremented by 1 to preserve contiguity. All chain edges with source or target indices above the removed slot are updated accordingly.
3. If the removed slot was a chain `rootSlotIndex`, the root is reassigned to slot 0 of that chain as a fallback. The chain coordinator logs a warning: "Root slot removed — defaulting to slot 0."
4. If edge deletion leaves a chain with zero edges, the chain is disabled (not deleted) and the user is notified: "[Chain name] has no edges after slot removal. Re-apply a topology or draw edges to reactivate."

If the user had applied a named preset topology (e.g. Circular), slot removal does **not** auto-reapply the preset. The spec doesn't silently mutate user state. If the user wants the topology recomputed for the new slot count, they re-tap the preset button.

---

## Chain Editor UI

The chain editor is a panel within the formation configuration controls. It becomes available when the formation has 2+ mandala slots.

**Phase 6.0 scope: presets only, no custom edge drawing.** The drag-to-draw-edges interaction (drawing arbitrary directed graphs between slot dots) is deferred to Phase 6.1. Phase 6.0 UI exposes topology quick-apply buttons plus chain parameters. Users configure visually compelling chains without needing to understand the underlying graph. Custom edge authoring ships when there is demonstrated demand for Branching Tree and other freeform topologies.

### Topology Quick-Apply Buttons

Three labeled buttons apply a named topology to the current formation in one tap:

`Linear` `Circular` `Star`

Each button computes the appropriate edge set for the current formation's slot arrangement and applies it. The topology function runs immediately; no confirmation is required (destructive history is handled by the undo stack, not confirmation dialogs).

Each button also shows a small icon indicating the wave direction:
- **Linear** — horizontal arrow sweeping left to right
- **Circular** — circular arrow (clockwise)
- **Star** — radial burst from center dot

### Formation Diagram (Read-Only in Phase 6.0)

A visual overhead diagram of the formation layout (same top-down dot layout used by the formation placement diagram). In Phase 6.0, this diagram is read-only: it shows the current topology's edges as arrows but does not accept drag-to-draw input. Edge arrows are colored per the active chain's color. The root slot is indicated by a filled circle.

This diagram exists as a visual confirmation that the topology applied correctly. Custom edge editing is deferred.

### Chain Parameters

Below the diagram:

| Control | Type | Default |
|---|---|---|
| Trigger Point | Segmented button (4 presets) + Advanced toggle | Full Exhale (1.0) |
| Propagation Delay | Slider, 0%–100% of period | 15% |
| Damping | Slider, 0.0–1.0 | 1.0 (off) |
| Damping Curve | Segmented button (Geometric / Linear), visible when damping < 1.0 | Geometric |
| Bidirectional | Toggle button | Off |
| Interference | Segmented button (Additive / Max), visible when Bidirectional is on | Additive |

Note: Damping slider covers the full data-model range `[0.0, 1.0]`. A secondary label below the slider marks the "useful range" bracket at `0.7–1.0` with a tick and note: "below 0.7 fades quickly." This keeps the UI honest about the full range without hiding low-damping values.

### Named Chains

For multi-chain setups, a small tab row above the diagram shows chain names. "Add Chain" adds a new blank chain. Each chain gets a color for its edge arrows (auto-assigned from a fixed palette; user can tap the color swatch to override). Switching tabs swaps which chain's edges are displayed.

---

## Preset Chain Patterns (Phase 6.0)

Preset chains are stored as topology + parameter recipes, applied to the current formation's slot count. They are accessible from the chain editor via a "Presets" button. Phase 6.0 ships three presets (one per supported topology). Grid Ripple and Spiral Cascade presets are deferred with their respective topologies.

### Ring Wave

**Topology:** Circular  
**Trigger Point:** Full Exhale (1.0)  
**Delay:** `1 / N` where N = slot count (one complete wave per breath cycle)  
**Damping:** 1.0  
**Bidirectional:** Off  

A single pulse orbits the ring. At 8 slots with delay = 12.5%, each slot fires 12.5% of the period after the previous one. The wave completes exactly one orbit per breath cycle.

### Sweep

**Topology:** Linear  
**Trigger Point:** Full Exhale (1.0)  
**Delay:** `1 / (N - 1)` where N = slot count (wave traverses all slots in one breath cycle)  
**Damping:** 1.0  
**Bidirectional:** Off  

A wave sweeps from slot 0 to the final slot and terminates. Works for any formation with a natural spatial ordering (row, diagonal, arc). Predictable and readable.

### Star Burst

**Topology:** Star (center out)  
**Trigger Point:** Full Exhale (1.0)  
**Delay:** 0ms (instant)  
**Damping:** 1.0  
**Bidirectional:** Off  

Center fires, all outer nodes inhale simultaneously. Maximum visual contrast between the center's exhale and the ring's synchronized inhale. Works best with 6–8 outer nodes.

---

### Deferred Presets (Phase 6.1+)

The following presets require deferred topologies and are out of scope for Phase 6.0:

- **Grid Ripple** (requires Grid Ripple topology)
- **Spiral Cascade (Outward)** (requires Spiral Cascade topology)
- **Pulse and Echo** — two-chain preset using Circular + bidirectional; deferred because multi-chain authoring UI complexity is not warranted at launch. The data model supports it; the UX does not yet.

---

## Interaction with Formation Rotation

The formation can rotate as a whole (Phase 5 formation-level rotation: the slot positions orbit the center). Chain topology edges are defined between **slot indices**, not geometric positions. When the formation rotates, the slots rotate with it, but their chain relationships stay intact.

This means a Ring Wave chain rotates with the formation: the traveling pulse orbits in formation-space coordinates, and the apparent direction of orbit in screen-space counter-rotates as the formation rotates. For slow formation rotation, this produces a precessing wave — the orbit axis slowly drifts. This is a feature, not a bug: it creates complex Lissajous-like visual patterns from simple inputs.

If the user wants the wave to appear to orbit at a fixed screen-space direction regardless of formation rotation, they must counter-rotate the chain's trigger ordering manually. The chain editor does not auto-compensate for formation rotation.

---

## Technical Architecture

### Data Model

```typescript
/** A single directed edge in a chain graph */
interface ChainEdge {
  sourceSlotIndex: number;
  targetSlotIndex: number;
}

/** A complete chain definition */
interface BreathChain {
  id: string;
  label: string;
  color: string;               // editor display color
  edges: ChainEdge[];
  rootSlotIndex: number;       // the autonomous "clock" node(s)
  triggerPoint: number;        // [0, 1] — phase fraction at which source fires
  delayFraction: number;       // [0, 1] — delay as fraction of breath period
  dampFactor: number;          // [0.0, 1.0] — amplitude multiplier per hop
  dampingCurve: 'geometric' | 'linear';  // default: 'geometric'
  bidirectional: boolean;
  interferenceMode: 'additive' | 'max';  // default: 'additive'; only meaningful when bidirectional=true
}

/** Formation-level chain configuration */
interface FormationChainConfig {
  chains: BreathChain[];
  enabled: boolean;
}
```

### ChainBreathCoordinator

A service that sits above the per-mandala breath animators. It:

1. Maintains a list of active chains and their edge graphs.
2. Listens to breath clock events from each mandala's animator (specifically the trigger-point crossing event).
3. On a trigger-point crossing from mandala A, looks up all outgoing edges from A across all chains.
4. For each outgoing edge, schedules a "start inhale" event for the target mandala after `delayMs = delayFraction * period`.
5. Computes the target mandala's amplitude as `sourceAmplitude * dampFactor^hopDistance`.
6. Dispatches the scheduled event. The target mandala's animator receives it and applies queue-or-immediate logic.

The coordinator is a pure scheduling engine — it does not directly animate. All animation state stays in the per-mandala breath animators.

### Hop Distance Tracking

For damping, each trigger carries its `hopCount` (number of edges traversed since the root). The coordinator increments hop count on each relay and passes it to the target's amplitude calculation. The root mandala always has `hopCount = 0`.

For star topology (all outer nodes fire back at each other), hop count is capped at the maximum depth to prevent runaway amplitude decay in feedback paths.

### Breath Animator Contract

**Blocking dependency on Phase 5 refactor.** Phase 5's current design computes per-slot phase inline: `const phase = ((masterTime / period) + slot.phaseOffset) % 1`. This is a for-loop inside the FormationPane RAF — there is no per-slot animator object. Phase 6 cannot subscribe to trigger-point crossings or inject inhale triggers without a per-slot object.

Phase 5 must refactor each slot's animation computation into a `BreathAnimator` class before Phase 6 development begins. This refactor is not optional and is not a Phase 6 responsibility.

The per-mandala breath animator (delivered as part of Phase 5 or Phase 5.5) must expose:

```typescript
interface BreathAnimator {
  /** Subscribe to trigger-point crossings. Called once per breath cycle when
   *  currentPhase passes through triggerPoint from below. */
  onTriggerPointCrossed: (callback: (hopCount: number) => void) => void;

  /** Receive an inbound chain trigger. Always queued — applies at next natural
   *  breath boundary. If a queued trigger already exists, this one replaces it
   *  (last-write-wins). If more than 40% of the period remains before the
   *  boundary, applies a 200ms ease-out to the contracted state before restart. */
  receiveInhaleTrigger(amplitude: number, hopCount: number): void;

  /** Current position in the breath cycle, [0, 1]. */
  get currentPhase(): number;

  /** Breath period in milliseconds. */
  get period(): number;
}
```

The `ChainBreathCoordinator` subscribes to `onTriggerPointCrossed` on all animators and calls `receiveInhaleTrigger` on targets. The coordinator does not directly modify any animation state — all state mutations go through `receiveInhaleTrigger`.

### Scheduling

The coordinator uses a priority queue of scheduled events keyed by target time. On each animation frame, it flushes all events whose scheduled time ≤ current time. This avoids drift from `setTimeout` jitter on animation-critical timing.

**Drift correction for Circular chains:** In a Circular topology, every cycle's ±0.5ms rAF timing slip compounds around the ring. Over a long session this produces visible phase drift between slots that were originally synchronized. The coordinator must track `accumulatedDrift` per chain path and subtract it from the next scheduled delay on the same path:

```
scheduledDelay = nominalDelayMs - accumulatedDrift[pathId]
accumulatedDrift[pathId] = scheduledTime - actualFireTime
```

This is the same correction technique used in MIDI sequencers. `actualFireTime` is the timestamp passed into the rAF callback at the moment the event flushes. The drift accumulator resets when the chain is paused, disabled, or re-applied. Linear and Star topologies do not loop and therefore do not accumulate drift — the correction only applies to paths that cycle back to the root.

### Preset Application

Topology presets are pure functions: `(topology: ChainTopology, slotCount: number, slotPositions: Point[]) => ChainEdge[]`. They take the current formation's slot positions and return the appropriate edge set. All topology functions are deterministic and testable in isolation with zero DOM or canvas dependency. Phase 6.0 topology functions: Linear (sequential index ordering), Circular (linear + loopback), Star (centroid-closest slot to all others). Phase 6.1 topology functions (when built): Grid Ripple (Manhattan distance from origin), Spiral (polar angle ordering).

---

## What's Not in Scope

### Phase 6.0 exclusions (deferred to Phase 6.1/6.2)

- **Custom edge drawing UI** — drag-to-draw arbitrary directed graphs between slot dots. Phase 6.0 is presets-only. When scoping Phase 6.1, spike `@xyflow/svelte` v1.5.2 (March 2026, maintained by xyflow — the same team as React Flow) before hand-rolling an edge editor. It supports draggable nodes, panning/zooming, edge drawing, custom node components, and dagre layout integration; the node count for formation diagrams (3–16 slots) is well within its performance envelope. Would save weeks vs. hand-rolling. Svelvet is an acceptable fallback if xyflow's alpha status is a concern at that time.
- **Grid Ripple topology** — formation-type-specific; deferred to Phase 6.1
- **Spiral Cascade topology** — formation-type-specific; deferred to Phase 6.1
- **Branching Tree topology** — requires custom edge editor; deferred to Phase 6.2
- **Random topology** — low visual value; deferred to Phase 6.2 if demand materializes
- **Pulse and Echo preset** — multi-chain authoring UX not warranted at launch; deferred to Phase 6.1

### Permanently out of scope for Phase 6

- **Cross-formation chains** (chains that span two independent formations) — Phase 6 is scoped to a single formation
- **Time-variable trigger points** (the trigger point changing over time, e.g. ratcheting forward each cycle) — a Phase 7 enhancement
- **Visual chain propagation animation** (a "pulse" traveling along edge arrows in the editor or viewport) — the editor shows static topology only; chain behavior is confirmed by observing the mandalas themselves
- **Audio sync** (chain pulse triggers an audio beat) — belongs in the Audio-Reactive phase (Phase 7)
- **Saving named chains to user library** — chains are saved as part of the formation preset, not independently
