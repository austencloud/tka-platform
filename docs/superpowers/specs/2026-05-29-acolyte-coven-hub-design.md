# Acolyte Coven Hub — Design

**Date:** 2026-05-29
**Status:** Design approved, pre-plan
**Author:** Austen + Claude (brainstorming session)

## One-liner

A walkable, forest-based 3D hub where any single user sequence is performed
simultaneously by a center "seed" coven and a ring of satellite covens, each
satellite wearing a different effect from the 16-effect registry. Walk between
living covens to see your sequence breathe through every effect.

## Origin

The museum already renders `TelekineticFormation3D` — a ritual "coven" of 6
acolytes whose arms IK-track 6 center rigs (3 primary planes × original/mirror)
performing one sequence with an LED tip effect. This design generalizes that one
baked exhibit into a generative hub: feed it *any* user sequence, and generate a
field of covens that vary along the **effect** axis.

## Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Core shape | Generative hub — walk-up station that spawns covens and a walkable field |
| Generative axis | **Effect** (the `EFFECTS` registry, 16 entries) — one coven per effect |
| Sequence source | Both: in-hub picker (default-empty state) **and** deep-link from the sequence viewer |
| Home | Forest-based walkable scene (expand `ForestScene`); route shortcut; surfaceable as a museum room later |
| Architecture | Registry-driven `CovenStation` + proximity LOD (Approach A) |
| Per-coven stage | Bespoke GLB per effect (blender-first); **first cut ships ONE template stage**, others reference it until their art lands |
| First-deliverable scope | Engine + 1 template stage. Skins + remaining 15 stages deferred. |

## Why this shape

- **Effect as the generative axis** keeps a single coven's *internal* structure
  (3-plane × mirror) intact while making the *between-coven* variation the
  16-effect library. Walking the field = seeing one sequence in LED vs Trails vs
  Water vs Bloom vs Echo, side by side, all alive.
- **Forest scene as home.** `ForestScene.svelte` is already GLB-asset set
  dressing (KayKit trees/rocks/bushes from R2 CDN, campfire/tent GLBs) arranged
  in a ring — not hand-rolled geometry. Expanding the clearing to hold N coven
  stations is blender-first-compliant and reuses an existing scene.
- **Proximity LOD is load-bearing, not a nice-to-have.** Mounting 12 full covens
  in the skeleton (~144 rigs) crashed the tab. The walkable forest makes LOD
  natural: only nearby covens run full.

## Architecture

### Component decomposition

```
CovenHub.svelte                 (orchestrator: layout + LOD + active sequence)
├── coven-hub-state.svelte.ts   (state factory: active sequence, focus, picker)
├── CovenSequencePicker.svelte  (reuses existing saved-sequence browse primitive)
└── CovenStation.svelte × N     (extracted from TelekineticFormation3D)
```

**`CovenStation.svelte`** — extracted, parameterized form of
`TelekineticFormation3D`.

- Props: `{ sequence, effectId, stageModel, lod, worldX, worldZ }`
- Owns: 6 center rigs (3 primary planes × original/mirror), 6 acolytes, per-frame
  IK tracking of center prop positions, the stage model.
- Sequence + effect arrive via props instead of the baked
  `MUSEUM_EXHIBIT_SEQUENCES[sequenceId]` lookup.
- Effect feeds `tipEffectMap` (today hardcoded `LED_EFFECT_MAP`) keyed off
  `effectId`.
- `lod`:
  - `hero` — full 12-rig formation, live, effect emitting.
  - `idle` — single hero rig, sequence playing, effect emitting.
  - `frozen` — static hero pose or billboard; no per-frame work.

**Boundary test:** `CovenStation` knows nothing about the hub, the registry, or
the player. Give it a sequence + effect + LOD, it performs. `CovenHub` knows
nothing about IK math; it places stations and decides LOD.

**`CovenHub.svelte`** — orchestrator.

- Reads `EFFECTS` registry → lays out one `CovenStation` per `ready3d` effect in
  the expanded forest clearing (ring/scatter; final arrangement tuned against the
  skeleton).
- Center seed coven = the active sequence, full formation, on a center dais.
- Holds active sequence (picker or deep-link).
- Owns the proximity-LOD controller.

**`coven-hub-state.svelte.ts`** — `*.svelte.ts` factory. Active sequence,
focused effect, picker open/closed.

**`CovenSequencePicker.svelte`** — reuses the existing saved-sequence browse
primitive. (Grep for the canonical browser before building; do not hand-roll a
new one. See Open Items.)

### Data flow

```
viewer "View in coven hub"  ─┐
                             ├─→ coven-hub-state.activeSequence
in-hub picker selection    ─┘            │
                                         ▼
EFFECTS registry ──→ CovenHub layout ──→ CovenStation(sequence, effectId, stage, lod)
                            │                       │
                    proximity LOD ctrl ─────────────┘ (sets lod per station)
```

### Proximity LOD

`CovenHub` runs one `useTask` distance check against the player/camera position:

- Nearest 1–2 covens → `hero`.
- Next band → `idle`.
- Rest → `frozen`.

Hysteresis on the thresholds so covens don't thrash `hero`↔`frozen` at a
boundary. Wake/sleep transitions can crossfade later; not required for first cut.

This is the mechanism that makes 16 covens feasible after 12-full crashed.

### Stage (blender-first)

Replace the legacy procedural `Stage3D` (BoxGeometry) per coven with a bespoke
GLB authored in Blender and run through the canonical pipeline (export →
`optimize-ocean-glb` style pass → `static/models/coven-stages/<effect>.glb`).

- **First cut:** one template stage GLB. All covens reference it.
- Per-effect stages added by authoring a GLB and setting
  `EffectMeta.stageModel`. `null` → falls back to the template.
- The bespoke stage *is* the per-effect "totem" — the showcase model for that
  effect's identity.

### EffectMeta extension

`effect-registry.ts` `EffectMeta` gains optional 3D fields:

```ts
interface EffectMeta {
  readonly id: string;
  readonly label: string;
  readonly icon: `fa-${string}`;
  readonly color: `#${string}`;
  readonly ready3d?: boolean;    // show this coven in the hub yet?
  readonly stageModel?: string;  // GLB path; null → template stage
  readonly skin?: string;        // acolyte skin id; null → default avatar
}
```

Foundation reads these. A new effect's 3D presence lights up by flipping
`ready3d` and (optionally) pointing `stageModel`/`skin`. Zero foundation churn.

## Scope — first deliverable

**In:**
1. Expand `ForestScene` (or a forest-based hub scene) to hold N coven stations.
2. Extract `CovenStation` from `TelekineticFormation3D` (parameterized
   sequence/effect/stage/LOD).
3. `CovenHub` orchestrator: registry-driven placement.
4. Proximity-LOD controller.
5. `coven-hub-state` factory.
6. Sequence entry: in-hub picker (reuse existing browser) + viewer deep-link.
7. Route shortcut.
8. One template GLB stage.
9. `EffectMeta` 3D fields.

**Deferred (flagged dependencies):**
- Per-coven acolyte **skins** — avatar variation is design-only today
  (`project_avatar_popover`); a net-new system. Field is wired; rendering later.
- The other 15 bespoke GLB stages — art pipeline.
- Wake/sleep crossfade polish.
- Surfacing the hub as a formal museum room (route ships first).

## Reuse ledger (never-hand-roll)

| Need | Reuse | Evidence |
|---|---|---|
| Coven formation + IK | Extract `TelekineticFormation3D` | `src/lib/features/museum/components/game/TelekineticFormation3D.svelte` |
| Forest environment | Expand `ForestScene` (GLB set dressing) | `src/lib/shared/3d/environments/scenes/ForestScene.svelte` |
| Effect catalog / colors / labels | `EFFECTS`, `EFFECT_COLORS`, `EFFECT_LABELS` | `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts:48` |
| Canvas + camera + controls | `<Canvas>` + `OrbitControls` (or museum UCC) | `src/routes/test/custom-avatar/+page.svelte`, `OrbitControls.svelte` |
| Tip effect wiring | `tipEffectMap` on `PerformerRig` | `TelekineticFormation3D.svelte:99` |
| Sequence picker | Existing saved-sequence browser | **TODO: grep canonical primitive before building** |
| Stage GLB pipeline | Blender export → optimize → `static/models/` | `.claude/rules/blender-first-3d-scenes.md` |

## Open items (resolve during planning)

1. **Sequence picker primitive** — grep `src/lib/**` for the canonical
   saved-sequence browse/gallery component before `CovenSequencePicker` is
   planned. Do not hand-roll.
2. **Camera/nav** — forest hub: reuse museum FPS/UCC walk nav, or `OrbitControls`
   fly-around? Walkable implies FPS-style; confirm which existing nav to reuse.
3. **Forest expansion mechanics** — `ForestScene` currently assumes a single
   performer `Stage3D`. Decouple from the single-performer assumption to host N
   stations among the trees.
4. **Effect rendering per station** — confirm each effect's tip renderer runs
   independently per coven (multiple concurrent effect instances) without global
   state collisions. Cross-ref `feedback_tipeffectmap_sync`.

## Throwaway

`src/routes/test/coven-hub/+page.svelte` is a layout skeleton built during
brainstorming (center coven + ring of full covens, color-tagged by effect, ring
count toggle). Keep as a layout reference until `CovenHub` lands, then delete.

## Related

- `.claude/rules/blender-first-3d-scenes.md` — stage GLB pipeline
- `.claude/rules/effects-earn-their-slot.md` — effect uniqueness bar
- Memory: `project_effects_unification`, `project_avatar_popover`,
  `feedback_tipeffectmap_sync`, `feedback_3d_prop_color_swap`
