# TKA Village: Visual Design Spec

> **Principle:** The village is a dark stage. Everything communicates through light. No chrome, no panels floating in 3D, no UI overlays inside the scene. The ground is a canvas. Avatars are silhouettes that glow. Events are phenomena. The viewer should feel like they're watching a campfire from above: warm, alive, legible without explanation.

---

## Design Language

### Color Vocabulary

Every color in the village has a semantic meaning. No color is decorative.

| Color | Hex | Meaning | Used By |
|-------|-----|---------|---------|
| Warm amber | `#e8a87c` | Neutral life, default state | Arena ring, section headers, performing label |
| Soft green | `#4ade80` | Knowledge transfer active | Teaching label, gift flash |
| Cool blue | `#60a5fa` | Receiving/absorbing | Learning label, youth absorption halo |
| Gold | `#fbbf24` | Seeking/desire | Seeking label, pilgrimage trail |
| White | `#ffffff` | Neutral/unspecified | Default label, pure circle glow |
| Deep red-orange | `#ef4444` | Death/loss/extinction | Funeral ground mark, dimmed monument |
| Ember glow | `#f97316` | Fire affinity | Fire circle ring, fire avatars |
| Electric blue | `#3b82f6` | LED affinity | LED circle ring, LED avatars |
| Ash grey | `#6b7280` | Charcoal affinity | Charcoal circle ring |
| Rainbow gradient | (conic) | Trail affinity | Trail circle ring |
| Muted sage | `#86efac` | Youth phase | Youth name label tint |
| Pure white | `#f8fafc` | Elder knowledge glow | Elder emissive halo |
| Pale violet | `#c4b5fd` | Reincarnation echo | Echo particle effect |

### Light Hierarchy (Rendering Order)

From dimmest to brightest, establishing visual priority:

1. **Ground plane** (0.6 opacity, barely there)
2. **Grid lines** (0.15 opacity, spatial reference only)
3. **Monuments** (0.3-0.7 emissive, persistent history)
4. **Circle ground rings** (0.4 emissive, social zones)
5. **Dropped props** (0.5 emissive pulse, attractors)
6. **Avatar bodies** (standard lit, the population)
7. **Name labels** (HTML overlay, state-colored)
8. **Active effects** (fire/LED/trails, brightest, attention-grabbing)
9. **Event flashes** (death, gift, reincarnation, momentary peaks)

### Animation Timing

All visual transitions use the same easing vocabulary:

| Transition | Duration | Easing | Why |
|------------|----------|--------|-----|
| State color change | 300ms | ease-out | Quick enough to track, smooth enough to not flicker |
| Fade in (spawn, model swap) | 1500ms | ease-in-out | Gentle arrival |
| Fade out (death) | 2000ms | ease-out | Lingering departure |
| Glow pulse (dropped prop, monument) | 3000ms loop | sine | Breathing rhythm, organic |
| Flash (gift, reincarnation) | 500ms | ease-out | Attention spike |
| Circle formation | 800ms | ease-out | Visible enough to notice, not jarring |

### Typography

All in-scene text uses the existing monospace stack. No new fonts.

| Element | Size | Opacity | Behavior |
|---------|------|---------|----------|
| Name label | 11px | 0.8 | Always visible, state-colored |
| Phase indicator | 11px | 0.6 | Appended to name: (y), (a), (e) |
| Monument tooltip | 10px | 0 until hover | Appears on pointer proximity |
| Event toast | 12px | 1.0 fade to 0 | Floats up from event location, 2s lifetime |

---

## Prerequisite: VillageAvatar PerformerRig Migration

Before any effect, prop, or grid visualization can work, VillageAvatar must render through PerformerRig instead of bare Avatar3D.

### Current Structure
```
VillageAvatar
  └── T.Group (offset)
       ├── Avatar3D (model + IK)
       └── T.Group (label)
```

### Target Structure
```
VillageAvatar
  └── PerformerRig
       ├── Avatar3D (model + IK)
       ├── ShoulderAnchor
       │    ├── GridAnchor (conditional)
       │    ├── Blue PropAnchor
       │    └── Red PropAnchor
       └── EffectOrchestrator3D (sibling, world space)
  └── T.Group (label, outside rig)
```

### Migration Steps
1. Replace the `<Avatar3D>` call with `<PerformerRig>`, passing existing position/facing/prop state
2. Move the HTML label group outside the rig (it needs to track position but not rotation)
3. Wire `tipEffectMap` from entity's effect affinity to PerformerRig
4. Wire `bluePropType`/`redPropType` from entity's prop component
5. Set `showGrid={false}` by default (grids only appear in specific contexts)
6. Maintain the existing GLTF load delay: PerformerRig's `showAvatar` prop handles this

### Performance Note
PerformerRig is heavier than bare Avatar3D because it includes the full transform hierarchy. At 16 simultaneous avatars, budget approximately 0.5ms/frame additional overhead. Profile after migration. If over budget, consider LOD: avatars beyond camera distance threshold render with `showProps={false}` and `showEffects={false}`.

---

## Feature Visuals

### Visual Aging

No new components. Modifications to VillageAvatar only.

**Youth (phase === "youth"):**
- `heightScale: 0.7` on avatar model (via PerformerRig or Avatar3D transform)
- Name label color tinted toward `#86efac` (sage green)
- Phase indicator: name label appends ` (y)` at reduced opacity
- Walk animation plays at 1.25x speed (already in MovementSystem constants)
- Optional: slight random wobble on facing angle (2-3 degree sine oscillation at 0.5Hz) to convey youthful energy

**Adult (phase === "adult"):**
- Default scale, default label color, no indicator
- This is the visual baseline. Everything else is a departure from it.

**Elder (phase === "elder"):**
- `heightScale: 0.95` (subtle, not dramatic)
- Walk animation amplitude scaled to 0.7 (IK target positions lerped 30% toward body center)
- Walk speed already handled by MovementSystem constants
- **Knowledge glow:** Soft emissive sphere (low-poly IcoSphereGeometry, radius 0.4) centered on avatar, opacity = `knowledgeGlow * 0.3`, color `#f8fafc`. Not a particle effect. A quiet, steady presence.
- Phase indicator: 🔥 emoji already present in existing code. Keep it.

**Model Assignment:**
- Each entity receives one avatar model at birth from the 16-model pool (existing dedup logic in VillageWorld.ts already prevents duplicates among living entities)
- That model stays with them for their entire lifespan. No model swaps on phase transition.
- Aging is conveyed entirely through transform scale, animation parameters, glow, and movement speed. The mesh is identity. The motion is age.
- No GLTF reload concerns since the model never changes mid-life

### Monuments

**Component:** `VillageMonument.svelte`

**Geometry:** `CylinderGeometry(0.06, 0.04, height, 6)` where `height = 0.3 + (cohortsSurvived * 0.1)`, max 0.8. Hexagonal cross-section for a crystalline feel.

**Material:** `MeshStandardMaterial` with:
- `color`: derived from the effect affinity of the original inventor (falls back to `#e8a87c` if no affinity system yet)
- `emissive`: same color
- `emissiveIntensity`: 0.5 for living monuments, 0.1 for extinct
- `transparent: true`, `opacity`: 1.0 for living, 0.4 for extinct

**Ground mark:** `RingGeometry(0.15, 0.2, 32)` flat on ground beneath monument, same emissive color at 0.3 opacity. Gives monuments a "planted" look.

**Tooltip:** HTML overlay via `<HTML center sprite>`, only visible when camera is within 5 units. Shows:
```
Sequence: {sequenceId}
Created by: {inventedByName}
Survived: {cohortsSurvived.size} generations
Status: {extinctAtTick ? "Extinct" : "Living"}
```

**Relight animation:** When a monument relights (reincarnation recovery), flash emissiveIntensity to 2.0 over 300ms, then ease back to 0.5 over 1000ms. This is the "resurrection flash" and should be the single brightest moment in the village.

### Performance Circles & Jams

**Solo performer:** No special visual. The performing animation and existing `#e8a87c` label color are sufficient. Watchers orient toward the performer, which is visible through facing angles.

**Jam circle:** `VillageJamCircle.svelte`

**Ground ring:** `RingGeometry(jamRadius, jamRadius + 0.1, 64)` where `jamRadius` is computed from the bounding circle of all participants. Material: `MeshBasicMaterial`, color `#ffffff`, opacity 0.15, pulsing between 0.1 and 0.2 on a 3-second sine cycle. Understated. The avatars performing inside it are the spectacle, not the ring.

**No overhead indicators, no particle fountains.** The jam is visible because multiple avatars are performing in proximity. The ground ring just confirms "yes, this is a jam, not a coincidence."

### Funerals

**Death fade:** When an entity enters `"passing"` state, their avatar opacity lerps to 0 over PASSING_DURATION_TICKS. The name label fades simultaneously. At removal, they're already invisible.

**Ground mark:** At the death location, place a `CircleGeometry(0.3, 32)` flat on the ground. Material: `MeshBasicMaterial`, color `#ef4444`, opacity starts at 0.4, fades to 0 over 200 ticks. A temporary scar on the ground that heals. Not permanent (monuments handle permanence).

**Mourner orientation:** Mourning entities face the death location with speed 0. No special visual effect on mourners themselves. The visual reads clearly: a circle of still avatars facing inward. Everyone watching understands what happened.

### Dropped Props

**Component:** `VillageDroppedProp.svelte`

When a prop drops (from Feature 2: Prop Identity), render a `Prop3D` at the death location, lying flat (rotation.x = -PI/2), at y = 0.05 (just above ground).

**Pulse:** Emissive intensity oscillates 0.3-0.7 on a 3-second sine. This distinguishes it from monument pillars (which are steady) and death marks (which fade).

**Pickup:** When an entity picks up the prop, the prop mesh lerps position toward the entity over 500ms, then disappears as it's absorbed into their PerformerRig's prop slot.

### Effect Affinity Visuals

**Per-avatar:** PerformerRig's `tipEffectMap` is set based on entity's effect affinity. Uses existing presets:
- Fire: `fire-presets.ts` default
- LED: `led-presets.ts` default
- Charcoal: `charcoal-presets.ts` default
- Trails: `trail-presets.ts` default
- Pure: empty `tipEffectMap` (no effects)

Effects are only visible during `"performing"`, `"practicing"`, or `"jamming"` states. During idle/wandering, `showEffects={false}` on PerformerRig to save GPU.

**Circle ground rings:** `VillageCircle.svelte`

Triggered when CircleSystem detects 3+ same-affinity performers in proximity. `RingGeometry(circleRadius, circleRadius + 0.15, 64)`, flat on ground. Color from the affinity:

```typescript
const CIRCLE_COLORS: Record<EffectAffinity, string> = {
  fire: "#f97316",
  led: "#3b82f6",
  charcoal: "#6b7280",
  trails: "conic-gradient", // special case: use ShaderMaterial with rainbow
  pure: "#f8fafc",
};
```

Opacity 0.25, no pulse (steady presence, unlike jam rings which pulse). A PointLight at circle center, same color, intensity 0.3, distance 4. This tints nearby avatars and ground in the affinity's color.

### Reincarnation Echo

**Youth-phase particle effect:** When a youth entity has `_reincarnationEcho`, render 3-5 small particle sprites (0.02 radius circles) that drift upward from the avatar's position, color `#c4b5fd` (pale violet), opacity fading from 0.6 to 0 over 2 seconds, respawning continuously. Use a simple `Points` geometry with a custom ShaderMaterial for GPU efficiency, or just 5 HTML sprite divs.

**Fade-out:** The particle effect intensity scales with `(1 - lifecycleProgress / youthPhaseRatio)`. By the time the entity exits youth phase, the particles are gone. The echo is a youth-only phenomenon.

**No label indicator.** Veteran observers learn to spot the violet drift. It's a discovery, not a notification.

### Prop Wall

**Location:** Fixed position at arena edge (angle 0, radius arenaRadius - 0.5). A flat `BoxGeometry(2, 1.5, 0.1)` panel, dark material (`#1a1a1a`), positioned vertically like a display board.

**Mounted props:** Broken/retired PropArtifacts rendered as small Prop3D instances arranged in a grid on the panel face. Scale 0.3x. Emissive 0. Slightly darkened material. Maximum 12 displayed (oldest fall off).

**Interaction:** Camera proximity within 3 units shows HTML tooltips for each mounted prop: owner chain, total beats, cause of retirement.

### Event Toasts

**Component:** `VillageEventToast.svelte`

Lightweight HTML overlays that float upward from event locations. No 3D geometry.

| Event | Toast Text | Color | Duration |
|-------|-----------|-------|----------|
| Teaching completed | "{teacher} taught {learner}" | `#4ade80` | 2s |
| Sequence invented | "{name} invented something new" | `#fbbf24` | 3s |
| Sequence forgotten | "{name} forgot a sequence" | `#ef4444` | 2s |
| Sequence extinct | "A sequence was lost forever" | `#ef4444` | 4s |
| Gift given | "{gifter} gifted {receiver}" | `#4ade80` | 2s |
| Monument placed | "A monument rises" | `#e8a87c` | 3s |
| Monument relit | "Knowledge resurrected" | `#f8fafc` flash | 3s |
| Reincarnation | (no toast, only particle effect) | -- | -- |

Toasts are optional and should be toggleable in VillageControls. At high sim speeds (10x+), suppress toasts entirely to prevent spam.

---

## Controls Panel Additions

The existing VillageControls sidebar expands with new sections. Same visual style: dark panel, amber headers, compact stats.

### Population Section (existing, expanded)

Add to existing stats:
```
Monuments: {monumentSystem.monuments.length}
Active Jams: {performanceSystem.activeJams.length}
Extinct (recovered): {count of relit monuments}
```

### Avatar Inspector (existing, expanded)

When an avatar is selected, add:
```
Ego: {entity.personality.ego.toFixed(2)}
Effect: {entity.effect.affinity}
Prop: {entity.prop.heldProp?.propType ?? "none"}
Prop Wear: {entity.prop.heldProp?.wear.toFixed(0)}%
Sequences:
  {sequenceId}: {proficiency}% ({source}) [decay bar]
```

The decay bar is a tiny inline bar (40px wide) showing time remaining before decay starts: full = just used, empty = actively decaying.

### Toggles Section (new)

```
[ ] Show toasts
[ ] Show monuments
[ ] Show circle rings
[ ] Show effect particles
[ ] Show reincarnation glow
```

All on by default. Off for performance or clarity.

### Timeline Strip (new, bottom of panel)

A compact sparkline-style visualization showing village health over the last 500 ticks:

- **Green line:** total knowledge (sum of all entities' known sequences)
- **Red dots:** extinction events
- **Gold dots:** invention events
- **White dots:** reincarnation events

Width: full panel width. Height: 40px. No axes, no labels. Pure gestalt. The viewer glances at it and sees "knowledge is growing" or "we just had a crash."

---

## Camera Behavior

### Default: OrbitControls (existing)

No changes to default camera. User has full manual control.

### Auto-focus (optional, togglable)

When enabled and no user input for 15 seconds:

1. Camera smoothly orbits to face the most "interesting" location, scored by:
   - Active jam: +10
   - Active funeral: +8
   - Monument placement: +6
   - Teaching pair: +3
   - Performing solo: +1

2. Camera lerps target to the scored location over 2 seconds. If user touches controls, auto-focus cancels immediately and doesn't re-engage for 15 seconds.

3. Never auto-zoom. Only auto-orbit and auto-target. The user's zoom level is sacred.

---

## Performance Budget

| Element | Budget per frame | Notes |
|---------|-----------------|-------|
| 16 PerformerRigs | 4ms | Largest cost. LOD at distance. |
| Effects (performing only) | 1ms | Only active performers, max 4-6 simultaneous |
| Monuments (static) | 0.2ms | Instanced if > 10 |
| Circle rings (static) | 0.1ms | Max 3-4 simultaneous |
| Event toasts (HTML) | 0.1ms | DOM, not 3D |
| Dropped props | 0.1ms | Max 3-4 on ground at once |
| Labels (HTML sprites) | 0.3ms | 16 sprites, Threlte HTML |
| **Total** | **~6ms** | Leaves 10ms headroom at 60fps |

### LOD Strategy

| Camera Distance | Avatar Detail |
|----------------|--------------|
| < 8 units | Full: avatar + props + effects + grid (if applicable) |
| 8-15 units | Reduced: avatar + props, no effects |
| > 15 units | Minimal: avatar only, no props, no effects |

Apply via `$derived` in VillageAvatar reading camera distance from Threlte context.

---

## File Manifest

| File | Type | Purpose |
|------|------|---------|
| `components/VillageAvatar.svelte` | REWRITE | Migrate to PerformerRig, add aging visuals, effect wiring, LOD |
| `components/VillageScene.svelte` | MODIFY | Add monument, circle, jam, death mark, dropped prop, toast layers |
| `components/VillageMonument.svelte` | CREATE | Hexagonal pillar with emissive glow and tooltip |
| `components/VillageCircle.svelte` | CREATE | Effect affinity ground ring with point light |
| `components/VillageJamCircle.svelte` | CREATE | Pulsing white ground ring for active jams |
| `components/VillageDroppedProp.svelte` | CREATE | Pulsing prop on ground with pickup animation |
| `components/VillageDeathMark.svelte` | CREATE | Fading red ground circle |
| `components/VillageEventToast.svelte` | CREATE | Floating HTML text that fades upward |
| `components/VillagePropWall.svelte` | CREATE | Display board with retired props |
| `components/VillageReincarnationGlow.svelte` | CREATE | Violet particle drift on echo youth |
| `components/VillageControls.svelte` | MODIFY | New sections: toggles, timeline strip, expanded inspector |
| `components/VillageTimelineStrip.svelte` | CREATE | Sparkline health visualization |
| `state/village-visual-state.svelte.ts` | CREATE | Toggle states, camera auto-focus scoring, event toast queue |
