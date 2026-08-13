# Ghost Chrono-Frost Design

**Status:** Approved 2026-08-11  
**Scope:** Unified Ghost intent across the 2D and 3D performer renderers  
**Supersedes:** The flat 2D sprite-copy treatment and the beat-sampled generic-cylinder 3D implementation

## Outcome

Ghost must read as the actual prop leaving frozen poses in time. It is an
onion-skin of the canonical prop silhouette, not a tip trail, motion blur,
particle wake, or generic staff stand-in.

The visual direction is **Chrono-Frost**:

- The newest past poses retain a translucent ice-glass body and a bright edge.
- Middle-aged poses lose their body fill while the edge stays legible.
- The oldest poses are a thin, desaturated rim that fades cleanly to zero.
- Blue and red props keep independent Ghost colors.
- The live prop is never replaced or dimmed by Ghost.

## Behavior contract

Ghost history is keyed by quantized prop pose: prop identity, rig-local center,
and 3D orientation. Sampling follows motion rather than animation beat indexes.
The Density control makes the position and rotation quantization finer as its
value rises, so higher Density always produces more distinct poses.

Revisiting a pose refreshes the existing exposure. It does not append a second
copy. Stationary props therefore hold one exposure instead of building a muddy
stack. A playback loop, backward scrub, prop-type change, or effect disable
clears the exposure.

Persistence is time-based. The authoring range maps to a short 0.38–2.0 second
window, matching the existing 2D Ghost contract. Intensity controls the peak
opacity and rim energy, not the number of phantoms. When captures outnumber the
mounted draw slots, the visible poses are selected across distinct ages from
the full retained window instead of taking only the newest poses.

The current live pose is omitted from the phantom draw list. It becomes visible
only after the prop moves into a different quantized pose.

## Ownership and composition

`@austencloud/scene-3d`'s `Prop3D` remains the only owner of prop geometry and
prop-specific rotation. Ghost composes `Prop3D` inside stable phantom slots and
overrides only the descendant mesh materials. It must not introduce a second
prop-type switch or hand-authored Ghost geometry.

A shared pure pose-history owner provides quantized capture, refresh, pruning,
epoch reset, and bounded oldest-first eviction. Both 2D and 3D Ghost use it so
their Density, Persistence, and revisit semantics cannot drift apart again.

The 3D renderer owns only:

- converting the live state into a rig-local pose snapshot;
- quality-tier slot limits;
- stable `Prop3D` phantom slots; and
- the Chrono-Frost shader/material presentation.

## Material contract

The phantom material is transparent, double-sided, depth-tested, and does not
write depth. Its edge comes from view-angle Fresnel, with a low-amplitude frozen
shimmer keyed to each captured pose so breakup does not jump between reusable
slots. The far face keeps enough body fill to read as glass while its rim is
attenuated to prevent doubled outlines. Old poses draw before young poses; the
ordering is continuous by age rather than inherited from pool-slot assignment.

Age maps to three continuous visual phases:

1. **Frozen body:** strong rim, visible glass fill, highest emissive energy.
2. **Shedding body:** fill falls rapidly; rim stays bright enough to preserve
   the complete prop silhouette.
3. **Cold outline:** no body fill; rim reaches pale cold white while it is still
   legible, then fades to zero.

No refraction, particles, screen-space smear, or moving phantom geometry is part
of this effect.

## 2D presentation contract

The 2D renderer tells the same age story with cached treatments of the canonical
prop sprite. A fresh exposure has a translucent Ghost-colored body and a bright
ice rim. The body falls away through the middle of the lifetime while frozen
grain becomes visible. The oldest exposure is a pale cold outline that fades to
zero. The current live pose is omitted, so Ghost never recolors or doubles the
live prop.

The treatment cache owns three sprite-space layers: colored body, expanded rim,
and clipped frozen grain. It is keyed by source image, rendered size, and Ghost
color. Per-frame work is limited to transformed blits with age-derived alpha;
the renderer does not rebuild masks for every phantom. Canvas compositing builds
the masks without depending on `CanvasRenderingContext2D.filter`, whose browser
support is not reliable enough to be a rendering contract.

Visible 2D poses are selected across the retained age window per prop. One prop
cannot consume the other prop's draw budget, and higher Density grows the
lightweight capture history rather than drawing an unbounded stack. The current
pose remains in history so it becomes eligible as soon as the prop moves into a
different quantized pose.

The 2D renderer uses the Ghost-owned `blueColor` and `redColor`. Desktop and
mobile controls both compose the shared effect-control manifest instead of
maintaining a Ghost-specific slider implementation.

## Performance contract

Each prop gets a stable, pre-mounted slot pool. Quality tiers cap visible
phantoms per prop at:

| Tier   | Slots per prop |
| ------ | -------------: |
| High   |             10 |
| Medium |              6 |
| Low    |              4 |

The mounted draw pool remains capped at the tier limits. A separate bounded
buffer of lightweight pose snapshots retains enough of the Persistence window
for the draw slots to be selected across distinct ages; finer Density grows
that buffer without mounting more geometry. When the capture buffer exceeds its
resolved cap, the oldest exposure is evicted first. Runtime capture must not
allocate new prop geometry or material instances. Every slot owns one reusable
shader material; canonical prop geometry is mounted once per slot and hidden
when unused.

## Intent and controls

Ghost owns `blueColor` and `redColor`. Existing saved configurations migrate to
the established blue `#3b82f6` and red `#ef4444`, preserving their current
appearance while removing the hidden dependency on Trails.

The shared control manifest exposes Color, Intensity, Persistence, and Density.
The same fields drive 2D and 3D surfaces.

Ghost exposes no named presets. Chrono-Frost is one visual identity with direct
controls for blue and red color, intensity, persistence, and density.

## Verification

Automated proof must cover:

- pose revisit refreshes instead of duplicating;
- stationary poses deduplicate;
- higher Density yields finer sampling;
- Persistence is time-based and fully prunes expired poses;
- epoch/backward reset clears history;
- capacity evicts the oldest pose;
- visible slots span the retained age window instead of only the newest poses;
- Density retains a stable motion span without mounting more prop geometry;
- quality tiers resolve to 10/6/4 slots;
- Ghost resolves its own colors; and
- the 3D renderer composes canonical `Prop3D` with no generic cylinder path;
- frost breakup follows the pose key rather than the reusable slot; and
- body/rim radiance is normalized before final transparency is composed.
- the 2D current pose is excluded from the phantom draw list;
- the 2D age progression moves from body to frozen grain to cold rim;
- the 2D draw budget is bounded per prop and spans the retained age window;
- 2D Ghost colors come from Ghost intent rather than the live prop sprite; and
- the 2D treatment path has a direct-blit fallback when an offscreen 2D context
  is unavailable.

Visual proof uses `/test/effect-grid` while moving at 1920×1080, 2560×1440,
3840×2160, 1440×900, 820×1180, 960×412, and 375×667. The acceptance bar is a
recognizable prop silhouette at every age, obvious blue/red separation, clean
decay, no live-pose z-fighting, no accumulated mud, and no viewport clipping.
