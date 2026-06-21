# Fish Ecosystem Upgrade — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 8-model flat-texture fish system with a 50-species PBR ecosystem featuring ABZU-style per-species vertex animation, trophic behavioral ecology, and dynamic species rotation.

**Source pack:** OceanFishPack (50 species, FBX, 1024x1024 albedo textures, scientific size data). Extracted to `static/models/ocean/pack/` as GLB after Blender batch conversion.

**Research:** `docs/reference/fish-ecosystem-research.md` — ABZU GDC technique, Di Santo et al. 2021 biomechanics, locomotion spectrum parameters, predator-prey design notes.

---

## 1. Model Pipeline

### 1.1 FBX → GLB Batch Conversion

Blender Python script processes all 50 FBX files:

1. Import FBX
2. Normalize: scale to unit bounding box, center origin
3. Align forward axis to +Z (verify per-model; the pack may use Unity's +Z convention already)
4. Strip any armatures/bones (pack has none, but defensive)
5. Bake vertex colors:
   - **Red** = spine participation gradient: `vertex.co.z` normalized 0→1 along body axis from head (min Z = 0) to tail (max Z = 1) after +Z forward alignment
   - **Green** = pectoral fin mask: vertices where `abs(vertex.co.x) > bodyWidth * 0.4` AND `vertex.co.y` in middle 30% of body height (lateral fin islands). Fallback: manual vertex group per species if auto-detection fails.
   - **Blue** = dorsal/caudal fin mask: vertices where `vertex.co.z > bodyLength * 0.6` (caudal) OR `vertex.co.y > bodyHeight * 0.7` (dorsal). Combined into single channel.
6. Export GLB with embedded textures, Draco compression

Output: `static/models/ocean/pack/{species_name}.glb` — 50 files, ~100-300KB each after Draco.

### 1.2 Species Roster (All 50)

Each species assigned to a **locomotion mode** and **trophic role**.

#### Resident Species (always in scene, 12-15 species)

| # | Species | Locomotion | Trophic Role | Instance Count | Size Scale |
|---|---------|-----------|--------------|----------------|------------|
| 0 | Clownfish | Subcarangiform | Territorial | 4 | 0.22 |
| 1 | Blue Tang | Sub→Carangiform | Reef Cruiser | 6 | 0.60 |
| 2 | Yellow Tang | Sub→Carangiform | Reef Cruiser | 5 | 0.40 |
| 3 | Emperor Angelfish | Labriform | Reef Cruiser | 3 | 0.76 |
| 4 | Copperband Butterflyfish | Labriform | Reef Cruiser | 4 | 0.40 |
| 5 | Moorish Idol | Labriform | Reef Cruiser | 3 | 0.44 |
| 6 | Blue-Green Chromis | Carangiform | Schooling Prey | 30 | 0.20 |
| 7 | Three-Stripe Damselfish | Carangiform | Territorial | 5 | 0.20 |
| 8 | Lyretail Anthias | Subcarangiform | Schooling Prey | 15 | 0.30 |
| 9 | Blackspotted Puffer | Ostraciiform | Neutral | 2 | 0.66 |
| 10 | Banggai Cardinalfish | Subcarangiform | Reef Cruiser | 4 | 0.16 |
| 11 | Cleaner Wrasse | Labriform | Neutral | 3 | 0.28 |
| 12 | Royal Gramma | Subcarangiform | Territorial | 3 | 0.16 |

**Resident total: ~87 fish, 13 species**

#### Visitor Species (swim through on rotation, 37 species)

Visitors grouped by behavioral pattern. Timer system spawns a visitor group every 30-90s. Group enters from fog wall, traverses scene, exits opposite side. 2-3 visitor groups active simultaneously.

**Pelagic Predators (solo or pairs, 30-60s transit):**

| Species | Locomotion | Trophic Role | Count | Size Scale |
|---------|-----------|--------------|-------|------------|
| Great Barracuda | Carangiform | Apex Predator | 1 | 2.20 |
| Yellowfin Tuna | Thunniform | Apex Predator | 1-2 | 3.00 |
| Giant Trevally | Carangiform | Apex Predator | 1-2 | 2.00 |
| Wahoo | Thunniform | Apex Predator | 1 | 3.20 |
| Mahi-Mahi | Carangiform | Apex Predator | 1-2 | 2.40 |
| Goliath Grouper | Subcarangiform | Mesopredator | 1 | 3.00 |

**Schooling Pelagics (large schools, 45-90s transit):**

| Species | Locomotion | Trophic Role | Count | Size Scale |
|---------|-----------|--------------|-------|------------|
| Atlantic Herring | Carangiform | Schooling Prey | 40-60 | 0.50 |
| European Sardine | Carangiform | Schooling Prey | 40-60 | 0.40 |
| European Anchovy | Carangiform | Schooling Prey | 50-70 | 0.30 |
| Atlantic Mackerel | Carangiform | Schooling Prey | 20-30 | 0.70 |
| Skipjack Tuna | Thunniform | Apex Predator | 3-5 | 1.60 |
| Yellowtail Amberjack | Carangiform | Apex Predator | 3-5 | 2.20 |
| Spanish Mackerel | Carangiform | Mesopredator | 5-8 | 2.40 |
| Sergeant Major | Carangiform | Schooling Prey | 15-25 | 0.30 |

**Reef Visitors (small groups, 60-120s transit):**

| Species | Locomotion | Trophic Role | Count | Size Scale |
|---------|-----------|--------------|-------|------------|
| True Clownfish | Subcarangiform | Territorial | 2-3 | 0.22 |
| Powder Blue Tang | Sub→Carangiform | Reef Cruiser | 3-4 | 0.46 |
| Naso Unicornfish | Subcarangiform | Reef Cruiser | 2-3 | 0.90 |
| Queen Angelfish | Labriform | Reef Cruiser | 1-2 | 0.80 |
| Flame Angelfish | Labriform | Reef Cruiser | 2-3 | 0.20 |
| Lemonpeel Angelfish | Labriform | Reef Cruiser | 2-3 | 0.24 |
| Raccoon Butterflyfish | Labriform | Reef Cruiser | 2-4 | 0.46 |
| Threadfin Butterflyfish | Labriform | Reef Cruiser | 2-4 | 0.46 |
| Moon Wrasse | Labriform | Reef Cruiser | 3-4 | 0.56 |
| Six-Line Wrasse | Labriform | Reef Cruiser | 3-4 | 0.18 |
| Bluehead Wrasse | Labriform | Reef Cruiser | 3-4 | 0.40 |
| Domino Damselfish | Carangiform | Territorial | 3-5 | 0.28 |
| Pajama Cardinalfish | Subcarangiform | Reef Cruiser | 3-5 | 0.16 |
| Longnose Hawkfish | Subcarangiform | Reef Cruiser | 1-2 | 0.26 |
| Picasso Triggerfish | Subcarangiform | Mesopredator | 1-2 | 0.60 |
| Clown Triggerfish | Subcarangiform | Mesopredator | 1 | 1.00 |
| Blue Triggerfish | Subcarangiform | Mesopredator | 1-2 | 0.90 |
| Longspine Porcupinefish | Ostraciiform | Neutral | 1 | 1.00 |
| Valentini Puffer | Ostraciiform | Neutral | 1-2 | 0.22 |
| Red Snapper | Subcarangiform | Mesopredator | 2-3 | 1.50 |

**Deep/Cold Water (rare visitors, 120-180s transit, background distance):**

| Species | Locomotion | Trophic Role | Count | Size Scale |
|---------|-----------|--------------|-------|------------|
| Atlantic Cod | Subcarangiform | Mesopredator | 2-3 | 2.00 |
| Haddock | Subcarangiform | Mesopredator | 2-3 | 1.40 |
| European Hake | Subcarangiform | Mesopredator | 1-2 | 1.60 |

### 1.3 Fragment Shader PBR Upgrade

Current fragment shader uses `texture2D(tDiffuse, vUv).rgb` with simple N·L lighting. Upgrade to:

```glsl
// Per-species textures: albedo (from pack) + generated normal map
uniform sampler2D tAlbedo;
uniform sampler2D tNormal;     // generated via GenPBR or runtime Sobel
uniform float uHasNormal;
uniform float uRoughness;      // per-species, typically 0.4-0.7

// Normal mapping
vec3 N = normalize(vNormal);
if (uHasNormal > 0.5) {
    vec3 mapN = texture2D(tNormal, vUv).rgb * 2.0 - 1.0;
    // TBN from derivatives
    vec3 dp1 = dFdx(vWorldPos), dp2 = dFdy(vWorldPos);
    vec2 duv1 = dFdx(vUv), duv2 = dFdy(vUv);
    vec3 T = normalize(dp1 * duv2.y - dp2 * duv1.y);
    vec3 B = normalize(dp2 * duv1.x - dp1 * duv2.x);
    N = normalize(mat3(T, B, N) * mapN);
}

// Cook-Torrance specular (simplified — single directional light)
vec3 albedo = texture2D(tAlbedo, vUv).rgb;
float NdotL = max(dot(N, uLightDir), 0.0);
vec3 H = normalize(uLightDir + normalize(cameraPosition - vWorldPos));
float NdotH = max(dot(N, H), 0.0);
float spec = pow(NdotH, mix(8.0, 64.0, 1.0 - uRoughness));
vec3 lit = albedo * (uAmbient + NdotL * 0.6) + spec * 0.15;

// Underwater fog
float dist = length(vWorldPos.xz);
float fog = smoothstep(uFogNear, uFogFar, dist);
lit = mix(lit, uFogColor, fog);
```

Normal maps generated offline from albedo using GenPBR (free, browser-based) or at runtime via Sobel edge detection on the albedo texture (cheaper, less accurate but adequate at distance).

---

## 2. ABZU-Style Animation System

### 2.1 Locomotion Modes

6 modes, each a distinct parameter profile in the vertex shader:

| Mode | Body Wave | Stiffness | Pectoral | Species Using |
|------|-----------|-----------|----------|---------------|
| Anguilliform | Full body sinuous | 0.0 | None | (none in pack — future eel/moray) |
| Subcarangiform | Moderate, posterior 50-70% | 0.3-0.5 | Minor | Clownfish, Tangs, Anthias, Cardinalfish, Gramma, Snapper, Cod |
| Carangiform | Stiff, posterior 30-35% | 0.6-0.7 | None | Chromis, Damselfish, Herring, Sardine, Mackerel, Barracuda, Trevally, Amberjack |
| Thunniform | Very stiff, posterior 10-15% | 0.8-0.9 | None | Tuna, Wahoo |
| Ostraciiform | Rigid body, tail fin only | 0.95 | Paddling | Puffer, Porcupinefish |
| Labriform | Rigid at cruise, pectoral rowing | 0.85 (cruise) | Primary propulsion | Angelfish, Wrasse, Butterflyfish, Moorish Idol |

### 2.2 Per-Species Uniform Arrays

Vertex shader reads from uniform arrays indexed by `speciesId`:

```glsl
// Per-locomotion-mode parameters (indexed by locomotionMode, not species)
uniform float uSwimFreq[6];       // Hz: tail beats per second
uniform float uWaveK[6];          // Wave crests per body length
uniform float uBaseAmplitude[6];  // Max lateral displacement (fraction of body)
uniform float uStiffness[6];      // 0=full body, 1=tail only
uniform float uAmpExponent[6];    // Head→tail gradient steepness
uniform float uStrideAmp[6];      // Whole-body lateral sway
uniform float uRollAmp[6];        // Per-stroke body roll
uniform float uPectoralFreq[6];   // Pectoral fin flutter Hz
uniform float uPectoralAmp[6];    // Pectoral sweep angle

// Species → locomotion mode mapping (per-species texture or uniform)
uniform int uLocomotionMode[MAX_SPECIES];
```

### 2.3 Concrete Parameter Values (from Di Santo et al. 2021)

| Parameter | Subcarangiform | Carangiform | Thunniform | Ostraciiform | Labriform |
|-----------|---------------|-------------|------------|--------------|-----------|
| swimFreq | 3.0 Hz | 4.0 Hz | 5.0 Hz | 2.0 Hz | 1.5 Hz |
| waveK | 1.1 | 1.0 | 1.0 | 0.0 | 0.3 |
| baseAmplitude | 0.10 | 0.12 | 0.20 | 0.07 | 0.03 |
| stiffness | 0.4 | 0.65 | 0.85 | 0.95 | 0.85 |
| ampExponent | 2.0 | 3.0 | 4.0 | 1.0 | 1.5 |
| strideAmp | 0.02 | 0.01 | 0.005 | 0.0 | 0.01 |
| rollAmp | 0.04 | 0.02 | 0.01 | 0.0 | 0.02 |
| pectoralFreq | 3.0 | 0.0 | 0.0 | 4.0 | 6.0 |
| pectoralAmp | 0.05 | 0.0 | 0.0 | 0.08 | 0.12 |

### 2.4 Speed-Coupled Animation

```glsl
float freq = uSwimFreq[mode] * speedMult;
float amp = uBaseAmplitude[mode] * (0.7 + 0.3 * speedMult);
```

Idle fish → gentle undulation. Darting fish → rapid tail beat. Automatic from existing `speedMult` trait.

### 2.5 C-Start Escape Response

When `dartStrength > 0` for a fish:
- Amplitude spike: 3x normal
- Frequency spike: 2x
- Asymmetric bend via `sin(localPos.z * 1.5) * 0.3` (already implemented)
- Decays via drag (0.94) over ~0.3s

### 2.6 Vertex Shader Body Wave Core

```glsl
// Read vertex color mask (baked in Blender)
float spineMask = color.r;      // 0 at head, 1 at tail
float pectoralMask = color.g;   // pectoral fin region
float dorsalMask = color.b;     // dorsal/caudal fin region

int mode = uLocomotionMode[speciesId];
float freq = uSwimFreq[mode] * speedMult + perInstanceJitter;
float phase = uTime * freq + localPos.z * uWaveK[mode];

// Amplitude envelope: stiffness controls head→tail gradient
float envelope = pow(spineMask, uAmpExponent[mode]);
float stiffMask = mix(1.0, envelope, uStiffness[mode]);
float bodyAmp = uBaseAmplitude[mode] * stiffMask * (0.7 + 0.3 * speedMult);

// Additive layers
localPos.x += sin(phase) * bodyAmp;                          // body wave
localPos.x += sin(uTime * freq * 0.5) * uStrideAmp[mode];   // lateral stride
localPos.z += sin(phase) * uRollAmp[mode] * spineMask;       // body roll

// Pectoral fin flutter (independent channel)
float pecPhase = uTime * uPectoralFreq[mode] + perInstanceJitter * 3.0;
localPos.y += sin(pecPhase) * uPectoralAmp[mode] * pectoralMask;

// Dorsal/caudal fin flex
localPos.y += sin(phase * 1.5) * bodyAmp * 0.3 * dorsalMask;
```

---

## 3. Behavioral Ecology (GPU State Machine)

### 3.1 Trophic Roles

6 roles encoded as integer per species in config:

| Role ID | Name | Behavior |
|---------|------|----------|
| 0 | Apex Predator | Patrols, chases prey on sight, causes panic flee |
| 1 | Mesopredator | Hunts small prey, flees from apex. Ambush style. |
| 2 | Schooling Prey | Tight schools, panic flee from all predators |
| 3 | Reef Cruiser | Loose social groups, mild flee, moderate schooling |
| 4 | Territorial | Defends home radius, chases intruders, returns to home |
| 5 | Neutral | Ignored by all, ignores all. Slow drift. |

### 3.2 Behavioral States

7 states per fish, stored in new `textureState` GPGPU variable:

| State | ID | Force Modification |
|-------|----|--------------------|
| School | 0 | Default boids (sep + ali + coh) |
| Flee | 1 | High separation + directional bias away from threat. Speed 2x. |
| Chase | 2 | Override cohesion with pursuit vector. Speed 1.5x. |
| Idle | 3 | Near-zero speed, gentle drift. |
| Investigate | 4 | Slow approach toward unfamiliar species. |
| Feed | 5 | Oriented downward, speed near zero. |
| Territorial | 6 | Chase intruders within home radius, return when clear. |

### 3.3 State Transition Logic (velocity shader)

```glsl
// New GPGPU texture: textureState
// .x = current state (0-6)
// .y = state timer (seconds remaining)
// .z = threat direction X (for flee/chase)
// .w = threat direction Z

int myTrophic = uTrophicRole[speciesId];
float currentState = texture2D(textureState, uv).x;
float stateTimer = texture2D(textureState, uv).y;

float newState = currentState;
float newTimer = max(0.0, stateTimer - uDelta);

// During neighbor loop, also check for threats/prey:
for each neighbor {
    int neighborTrophic = uTrophicRole[neighborSpeciesId];
    float d = distance(myPos, neighborPos);
    
    // Perception cone check (forward-facing, ~145 degrees)
    float facing = dot(normalize(myVel), normalize(neighborPos - myPos));
    if (facing < uPerceptionCos) continue;
    
    // Predator detection → FLEE
    if (isThreat(myTrophic, neighborTrophic) && d < uFleeRange) {
        newState = 1.0; // FLEE
        newTimer = 3.0; // flee for 3 seconds minimum
        // Store threat direction for flee vector
    }
    
    // Prey detection → CHASE (only if I'm predator type)
    if (isPrey(myTrophic, neighborTrophic) && d < uHuntRange && facing > 0.7) {
        newState = 2.0; // CHASE
        newTimer = 5.0;
    }
    
    // Territorial defense
    if (myTrophic == 4 && neighborSpeciesId != mySpeciesId && d < uHomeRadius) {
        newState = 6.0; // TERRITORIAL
        newTimer = 2.0;
    }
}

// Panic cascade: fleeing neighbor of same species → I flee too
if (neighborState == 1.0 && sameSpecies && d < uPanicRadius) {
    newState = 1.0;
    newTimer = 2.0;
}

// Timer expiry → return to default state
if (newTimer <= 0.0 && newState != 0.0) {
    newState = 0.0; // back to School
}

// Write new state
gl_FragColor = vec4(newState, newTimer, threatDirX, threatDirZ);
```

### 3.4 Force Modifiers Per State

After computing base boids forces (sep, ali, coh), apply state-specific multipliers:

```glsl
if (state == 1.0) { // FLEE
    vec3 fleeDir = normalize(myPos - threatPos);
    steer = fleeDir * 2.0 + sep * 0.5; // override with flee direction
    adjMax *= 2.0; // speed boost
}
if (state == 2.0) { // CHASE
    vec3 chaseDir = normalize(preyPos - myPos);
    steer = chaseDir * 1.5;
    adjMax *= 1.5;
}
if (state == 3.0) { // IDLE
    steer *= 0.1; // minimal forces
    adjMax *= 0.2;
}
if (state == 6.0) { // TERRITORIAL
    float distFromHome = distance(myPos, homePos);
    if (distFromHome < uHomeRadius) {
        steer = normalize(intruderPos - myPos) * 1.5; // chase intruder
    } else {
        steer = normalize(homePos - myPos) * 1.0; // return home
    }
}
```

### 3.5 Threat Matrix

Encodes which trophic roles threaten which:

| | Apex (0) | Meso (1) | Prey (2) | Cruiser (3) | Territorial (4) | Neutral (5) |
|---|---|---|---|---|---|---|
| **Fears** | nothing | Apex | Apex, Meso | Apex | Apex | nothing |
| **Hunts** | Prey, Cruiser | Prey | nothing | nothing | intruders | nothing |

Encoded as `uThreatMatrix[6*6]` uniform — 1.0 = threatens, 0.0 = ignores.

### 3.6 Player Interaction

`uScatterOrigin` (ray position) acts as a virtual apex predator. All non-apex, non-neutral fish within `uScatterRadius` enter FLEE state. Creates "parting sea" when cursor sweeps through schools.

---

## 4. Species Rotation System

### 4.1 Architecture

CPU-side `SpeciesRotationManager` class:

- Maintains pool of 50 species configs (pre-loaded GLB geometries + textures)
- Tracks active resident species (always present) vs active visitor groups
- Timer-driven: every 30-90s, selects a random visitor group pattern
- Visitor groups: spawn at scene edge, assign velocity toward opposite edge, despawn on exit

### 4.2 GPU Texture Management

GPUComputationRenderer texture size must accommodate max active fish. With residents (~87) + up to 3 visitor groups (max ~200), we need texSize for ~300 fish. `texSize = ceil(sqrt(300)) = 18` → 18x18 = 324 slots.

Visitor fish occupy reserved texture slots. When a visitor group spawns, their positions/velocities are written to the next available block of slots. When they exit, slots are released (position set to 9999 sentinel).

### 4.3 InstancedMesh Pool

One InstancedMesh per active species. When a visitor group enters:
1. Create InstancedMesh with the visitor species geometry
2. Set instance count
3. Assign aReference attributes pointing to their GPU texture slots
4. Add to scene

When they exit:
1. Remove from scene
2. Dispose InstancedMesh
3. Release GPU texture slots

### 4.4 Visitor Group Patterns

| Pattern | Species | Count | Duration | Frequency |
|---------|---------|-------|----------|-----------|
| Sardine Ball | European Sardine | 50-70 | 45s | Every 60-120s |
| Tuna Run | Yellowfin Tuna + Skipjack | 3-5 | 30s | Every 90-180s |
| Barracuda Patrol | Great Barracuda | 1 | 30s | Every 120-240s |
| Reef Visitors | Random 2-3 reef species | 4-8 each | 60-120s | Every 45-90s |
| Mackerel School | Atlantic Mackerel | 20-30 | 45s | Every 90-120s |
| Grouper Ambush | Goliath Grouper | 1 | 60s | Every 180-300s |
| Deep Water Pass | Cod + Haddock + Hake | 2-3 each | 90s | Every 120-240s |

### 4.5 Predator-Prey Event Chains

When an apex predator visitor enters:
1. Prey within perception range → FLEE (scatter outward)
2. Panic cascades through same-species neighbors
3. Predator may CHASE the nearest fleeing prey
4. After 5-10s, prey return to SCHOOL state
5. Predator continues transit and exits

This creates dramatic moments without scripting — pure emergent behavior from the state machine.

---

## 5. Implementation Layers

Build and ship in 3 layers, each independently valuable:

### Layer 1: Models + Animation (highest visual impact)
- Blender batch conversion of 50 FBX → GLB
- Vertex color baking script
- New species config with all 50 species
- Locomotion mode assignment per species
- Upgraded vertex shader with 6 locomotion modes
- Upgraded fragment shader with PBR (albedo + generated normal)
- Resident species rendering (13 species, ~87 fish)

### Layer 2: Behavioral Ecology (interactive drama)
- `textureState` GPGPU variable
- Trophic role assignment per species
- State transition logic in velocity shader (SCHOOL, FLEE, CHASE, TERRITORIAL)
- Force modifiers per state
- Threat matrix
- Panic cascade
- Player ray → FLEE trigger

### Layer 3: Species Rotation (living world)
- `SpeciesRotationManager` CPU class
- Visitor group spawn/despawn system
- InstancedMesh pool management
- GPU texture slot allocation
- Visitor group patterns
- Predator-prey event chains (emergent from Layer 2 state machine)

---

## 6. Performance Budget

| Resource | Budget | Notes |
|----------|--------|-------|
| Active fish | 200-400 | Residents ~87 + visitors ~100-200 |
| GPU textures | texSize 18 (324 slots) | Expandable to 24 (576) if needed |
| Draw calls | 15-20 active species | One InstancedMesh per species |
| VRAM (albedo) | ~15-20 active × 1K² × 4B = ~60-80MB | Acceptable for modern GPUs |
| VRAM (normal maps) | Same as albedo if generated | Skip for distant/small fish |
| Shader complexity | +7 uniforms for locomotion, +1 GPGPU pass for state | Negligible vs existing boids loop |

### Optimization Levers
- Skip normal maps for fish < 0.3 scale (too small to see detail)
- Reduce instance count for distant visitor groups
- LOD: simplified geometry at distance (future, not in scope)
- Cap total active fish at 400 via rotation manager

---

## 7. Files Changed

| File | Action | What |
|------|--------|------|
| `static/models/ocean/pack/*.glb` | Create (50) | Converted + vertex-colored fish models |
| `scripts/convert-fish-pack.py` | Create | Blender batch conversion script |
| `src/.../ocean/fish-species-config.ts` | Create | All 50 species definitions + locomotion + trophic |
| `src/.../ocean/FishSchool.svelte` | Rewrite | Multi-species instancing, new shaders, rotation |
| `src/.../ocean/FishEventSystem.ts` | Extend | Species-aware events, predator response |
| `src/.../ocean/SpeciesRotationManager.ts` | Create | Visitor spawn/despawn, group patterns |
| `src/.../ocean/fish-locomotion-params.ts` | Create | Per-mode animation parameters |
| `tests/unit/3d-viewer/fish-event-system.test.ts` | Update | New behavioral state tests |
| `tests/unit/3d-viewer/species-rotation.test.ts` | Create | Rotation manager tests |
