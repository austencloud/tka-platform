# Phase-Chained Breathing — Design Spec (Mandala Phase 6)

## Overview

Phase-Chained Breathing adds causal connections between mandalas in a formation (Phase 5). Without chains, each mandala breathes independently — the user controls phase offsets as static numeric values. With chains, one mandala's breath cycle actively triggers its neighbors. The result is a breathing relay: a pulse of expansion and contraction that propagates through the formation as a wave.

This is distinct from Phase 5's static phase offset. Phase offsets are set-and-forget geometry; chains are dynamic, time-ordered causality. A formation can use both simultaneously: a circular chain topology produces a traveling wave, while phase offsets could additionally stagger that wave's amplitude across rows.

**Depends on:** Phase 5 (Formations). Chains require at least two mandalas.

---

## Chain Topologies

A topology defines which mandalas fire after which. Each topology is a directed graph where nodes are mandala slots in the formation and edges are trigger relationships.

### Linear

A → B → C → D → … → N. Exhale of slot 0 triggers inhale of slot 1, exhale of slot 1 triggers slot 2, and so on. The wave terminates at the final slot (no loopback). Useful for line and diagonal formations: the wave sweeps from one end to the other and dies.

### Circular

Like Linear but with a loopback edge from the last slot to slot 0. The wave never terminates — it keeps cycling around the ring. Natural fit for the circle formation. The speed control determines how fast the pulse orbits.

### Star

One designated center mandala triggers all others simultaneously on its exhale. No cascading: the center fires, all N outer mandalas receive the trigger at the same moment (subject to propagation delay). Outer mandalas do not trigger each other. Best for formations with a clear focal point: diamond's center, triangle's apex.

### Branching Tree

A rooted tree where each parent triggers its children on exhale. The root has no parent — it runs on its own autonomous breath clock. Tree structure is user-defined via the chain editor. Enables asymmetric cascades: a main wave branches into sub-waves at each junction.

### Grid Ripple

A rectangular grid where the trigger source is one corner (or the center). Each slot triggers the slots one step further from the source in Manhattan distance. Slots at equal distance fire simultaneously. Produces a concentric expanding square wave pattern. Valid only for grid formations.

### Spiral Cascade

Triggers follow the polar ordering of slots from the innermost outward (or outermost inward). Requires a polar formation (ring, concentric rings). The wave spirals outward or inward.

### Random

On each breath cycle, each mandala receives a trigger from a randomly selected predecessor. The random seed is fixed per session to ensure the pattern is repeatable within a view, but changes each time the formation is restarted. Useful for ambient or generative modes.

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
3. If the target mandala is already mid-inhale, the signal is **queued** — it takes effect at the start of the next natural breath boundary (no mid-cycle interruption). This prevents glitches on fast chains.
4. If the target is mid-exhale past the trigger point, the signal takes effect **immediately** (the target fast-forwards to start of inhale). This enables tight chase effects.

The "queue vs immediate" threshold is the trigger point value itself: triggers land early = queue, triggers land after the trigger point in the target's cycle = immediate restart.

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

---

## Bidirectional Chains

Bidirectional mode adds the reverse edge to every directed edge in the chain, creating simultaneous waves traveling in both directions. For Circular topology this means two counter-rotating pulses; for Linear it creates a wave that bounces back from the end slot.

Bidirectional chains are implemented by running two independent trigger passes — a forward pass and a reverse pass — with the same trigger point and delay parameters. Each mandala participates in both passes simultaneously. When both waves arrive at the same mandala, the breathing signal is the average of the two triggers' phase positions, producing an interference-like interaction: constructive at the origin node, progressive phasing at intermediate nodes.

Bidirectional mode is off by default and toggle-able per chain.

---

## Multiple Simultaneous Chains

A formation supports any number of named chains simultaneously. Each chain is an independent directed graph operating over the same pool of formation slots.

Constraints:
- A slot can appear in multiple chains. When it receives triggers from multiple sources, it uses the **earliest arriving trigger** per cycle (first-wins).
- A slot can be the source node in multiple chains simultaneously (it fires to all outgoing edges across all chains on its exhale).
- Cycles within a single chain are valid (that's what Circular topology is). Accidental cycles in user-defined trees are detected and highlighted in the editor with a warning — they don't crash, but the user should be intentional about them.

Use case for multiple chains: a hexagonal formation with a primary circular wave chain (all 6 outer slots) plus a secondary chain where opposite-corner pairs breathe in synchrony. Two chains, different topologies, coexisting.

---

## Chain Editor UI

The chain editor is a panel within the formation configuration controls. It becomes available when the formation has 2+ mandala slots.

### Connection Mode

A visual overhead diagram of the formation layout (same top-down dot layout used by the formation placement diagram). Users draw edges between dots:

- Tap/click a source dot → drag to a target dot → release to create a directional edge (arrow drawn from source to target)
- Tap an existing edge arrow to select it; Delete key removes it
- Long-press/right-click a dot to designate it as chain root (filled circle indicator)

### Topology Quick-Apply Buttons

Above the diagram, five labeled buttons apply a named topology to the current formation in one tap:

`Linear` `Circular` `Star` `Grid Ripple` `Spiral` `Random`

Each button computes the appropriate edge set for the current formation's slot arrangement and applies it. Overwrites the current edge set after a confirmation if the user has manually drawn edges.

### Chain Parameters

Below the diagram:

| Control | Type | Default |
|---|---|---|
| Trigger Point | Segmented button (4 presets) + Advanced toggle | Full Exhale (1.0) |
| Propagation Delay | Slider, 0%–100% of period | 15% |
| Damping | Slider, 0.7–1.0 | 1.0 (off) |
| Bidirectional | Toggle button | Off |

### Named Chains

For multi-chain setups, a small tab row above the diagram shows chain names. "Add Chain" adds a new blank chain. Each chain gets a color for its edge arrows. Switching tabs swaps which chain's edges are displayed and editable.

---

## Preset Chain Patterns

Preset chains are stored as topology + parameter recipes, applied to the current formation's slot count. They are accessible from the chain editor via a "Presets" button.

### Ring Wave

**Topology:** Circular  
**Trigger Point:** Full Exhale (1.0)  
**Delay:** `1 / N` where N = slot count (one complete wave per breath cycle)  
**Damping:** 1.0  
**Bidirectional:** Off  

A single pulse orbits the ring. At 8 slots with delay = 12.5%, each slot fires 12.5% of the period after the previous one. The wave completes exactly one orbit per breath cycle.

### Grid Ripple

**Topology:** Grid Ripple (corner origin)  
**Trigger Point:** Full Exhale (1.0)  
**Delay:** 10% per Manhattan step  
**Damping:** 0.9  
**Bidirectional:** Off  

An expanding square wave from one corner. Damping makes the outermost slots breathe subtly while the origin breathes fully — a natural perspective depth cue.

### Spiral Cascade (Outward)

**Topology:** Spiral (center-out)  
**Trigger Point:** Peak Inhale (0.5)  
**Delay:** 8% per hop  
**Damping:** 0.95  
**Bidirectional:** Off  

Fires at peak expansion — the "splash" aesthetic. The center mandala fully expands, then each ring outward expands fractionally later, creating a ripple outward from center.

### Pulse and Echo

**Two chains:**  
1. Primary: Circular, Full Exhale, 12% delay, damping 1.0  
2. Echo: Circular, Full Exhale, 12% delay + half-period offset, damping 0.8, Bidirectional On  

The echo chain runs half a period behind the primary, creating a counter-wave. The two waves meet on opposite sides of the ring every half period, visually colliding and passing through each other.

### Star Burst

**Topology:** Star (center out)  
**Trigger Point:** Full Exhale (1.0)  
**Delay:** 0ms (instant)  
**Damping:** 1.0  
**Bidirectional:** Off  

Center fires, all outer nodes inhale simultaneously. Maximum visual contrast between the center's exhale and the ring's synchronized inhale. Works best with 6–8 outer nodes.

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
  bidirectional: boolean;
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

The per-mandala breath animator (to be designed as part of Phase 5) must expose:

```typescript
interface BreathAnimator {
  onTriggerPointCrossed: (callback: (hopCount: number) => void) => void;
  receiveInhaleTrigger(amplitude: number, hopCount: number): void;
  get currentPhase(): number;   // [0, 1]
  get period(): number;          // ms
}
```

The `ChainBreathCoordinator` subscribes to `onTriggerPointCrossed` on all animators and calls `receiveInhaleTrigger` on targets.

### Scheduling

The coordinator uses a priority queue of scheduled events keyed by target time. On each animation frame, it flushes all events whose scheduled time ≤ current time. This avoids drift from `setTimeout` jitter on animation-critical timing.

### Preset Application

Topology presets are pure functions: `(topology: ChainTopology, slotCount: number, slotPositions: Point[]) => ChainEdge[]`. They take the current formation's slot positions and return the appropriate edge set. Grid Ripple uses Manhattan distance from an origin slot; Spiral uses polar angle ordering. All topology functions are deterministic and testable in isolation.

---

## What's Not in Scope

- Cross-formation chains (chains that span two independent formations) — Phase 6 is scoped to a single formation
- Time-variable trigger points (the trigger point changing over time, e.g. ratcheting forward each cycle) — a Phase 7 enhancement
- Visual animation of the chain propagation itself (e.g. drawing a "pulse" traveling along the edge arrows in the editor) — the editor shows static topology only
- Audio sync (chain pulse triggers an audio beat) — belongs in the Audio-Reactive phase (Phase 7)
- Saving named chains to user library — chains are saved as part of the formation preset, not independently
