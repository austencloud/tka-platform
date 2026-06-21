# Cosmic Scene Upgrade: Crystal Garden

## Vision

Hybrid aesthetic: **Deep Space Solitude** above (vast void, distant galaxy arm, humbling scale) + **Alien Crystal Garden** below (bioluminescent crystal forests, spore particles, prismatic caustics). Look up = feel small. Look around = feel wonder.

## Scope

Three progressive tiers, each shippable:

- **Tier 1 (this spec):** Crystal Garden Foundation — instanced crystal forest, upgraded ground shader, prismatic caustics
- **Tier 2 (future):** Life + Interaction — GPGPU spore cloud, mouse interactivity, crystal proximity reactions
- **Tier 3 (future):** Atmosphere + Polish — galaxy arm backdrop, quality tiers, loading orchestration, starfield/nebula upgrades

## Tier 1: Crystal Garden Foundation

### New: CrystalFormations.svelte

Replaces `LunarCrystals.svelte`. GPU-instanced crystal forest with 4 species.

**Species:**

| Species | Shape | Size Range | Visual Character |
|---|---|---|---|
| Spire | Tall hexagonal prism + pointed cap | 1.5–4m | Sentinels, slow pulse |
| Cluster | 3-5 short crystals from shared base | 0.3–1.2m | Grouped shimmer |
| Plate | Flat disc formations | 0.5–2m wide | Light catchers, prismatic |
| Branch | Tree-like branching | 1–3m | Organic bioluminescent veins |

**Geometry source:** AI-generated GLB models (user generates via Meshy or equivalent). Fallback: procedural geometry (hexagonal cylinders, cones). Instancing code works with both — extract first mesh from GLB, clone into InstancedMesh.

**Placement:** Concentric rings from platform edge (6m–25m). Seeded RNG (deterministic). Denser outward. Collision grid for overlap avoidance.

**Instancing:** One InstancedMesh per species. Per-instance attributes:
- Transform matrix (position, rotation, scale)
- Color tint (species palette + per-instance jitter)
- Glow intensity + phase (bioluminescent pulse offset)

**Material:** MeshPhysicalMaterial — transmission 0.6-0.9, iridescence 0.3-0.7, roughness 0.05. Shader injection adds pulsing emissive from glow attributes.

**Target count:** ~150 crystals total (adjustable via config, quality-tiered in Tier 3).

### New: cosmic-instancing.ts

Adapted from `ocean-instancing.ts`:
- `createCrystalInstancedMesh(geometry, placements, options)` — InstancedMesh with per-instance color/glow attributes
- Shader injection for `aInstanceColor`, `aGlowIntensity`, `aGlowPhase` — modifies standard material fragment to add pulsing emissive
- `disposeCrystalMesh()` — cleanup

### New: crystal-shaders.ts

Shared GLSL:
- Bioluminescent pulse: `emissive *= intensity * (0.5 + 0.5 * sin(time * hz + phase))`
- Chromatic edge: Fresnel-based color shift at crystal boundaries
- Inner glow: Subsurface scatter approximation via thickness estimate

### New: PrismaticCaustics.svelte

Rainbow-shifted Voronoi caustics on ground plane:
- 50m × 50m additive-blended plane at ground level
- Voronoi cell pattern (same algorithm as Ocean's VoronoiCaustics)
- Per-cell spectral color based on cell ID — adjacent cells = adjacent hues
- Intensity scales with proximity to crystal formations
- Time-animated drift + 30s color cycle
- Edge fadeout for seamless blending

### Upgrade: LunarGroundPlane.svelte

Current: simplex noise veins + 12 craters + PBR rock texture (~150 lines shader).

Upgraded 7-layer shader (mirrors ProceduralSeabed pattern):

1. Base regolith — PBR rock texture, world-space sampled
2. Crystal vein network — existing ridge simplex, enhanced with color jitter
3. Bioluminescent patches — FBM-masked organic glow blobs near crystal bases
4. Frost/sublimation — Voronoi frost at crystal contact points
5. Dust variation — low-freq noise albedo modulation
6. Micro-sparkle — high-freq noise × view angle for mineral glints
7. Crater integration — existing 12 craters preserved

World-space UV sampling eliminates tiling artifacts.

### Config Changes

`CosmicSceneConfig` gains:
- `crystals.species[]` — per-species config (count, sizeRange, palette, pulseHz)
- `crystals.placementRadius` — ring min/max
- `caustics` — colors, intensity, drift speed, proximity falloff
- `ground.layers` — enable/disable individual shader layers

Night and Aurora variants each get distinct crystal palettes:
- Night: cool blues, cyan, ice-white glow
- Aurora: teal, magenta, warm amber glow

### Files Changed

| File | Action |
|---|---|
| `cosmic/CrystalFormations.svelte` | NEW |
| `cosmic/cosmic-instancing.ts` | NEW |
| `cosmic/crystal-shaders.ts` | NEW |
| `cosmic/PrismaticCaustics.svelte` | NEW |
| `cosmic/LunarGroundPlane.svelte` | UPGRADE |
| `scene-configs.ts` | EXTEND (new config sections) |
| `CosmicScene.svelte` | UPDATE (swap LunarCrystals → CrystalFormations, add PrismaticCaustics) |
| `cosmic/LunarCrystals.svelte` | DELETE (absorbed) |
| `cosmic/EnergyParticles.svelte` | KEEP (absorbed in Tier 2, not Tier 1) |

### Unchanged Components

StationPlatform, EarthSphere, EarthGodRays, AudienceSeating, MeteorStreaks, Starfield, NebulaLayer — all preserved as-is in Tier 1.

### Success Criteria

- Crystal formations render with visible iridescence and bioluminescent pulsing
- 150+ crystals at 60fps on desktop (measured)
- Prismatic caustics visible on ground near crystal clusters
- Ground shader shows at least 5 distinct visual layers
- Night and Aurora variants each have distinct crystal palettes
- No regressions in existing scene functionality
