# Fish Ecosystem AAA Research

> Research compiled 2026-05-21 for the ocean scene fish upgrade. Sources: ABZU GDC talks, academic biomechanics (Di Santo et al. 2021 PNAS), open-source shader implementations, Sketchfab market analysis.

## Part 1: Model Sourcing

### Free PBR Fish Models

| Source | Species | License | PBR Quality | Format | Cost |
|--------|---------|---------|-------------|--------|------|
| cgsoul Emperor Angelfish | 1 (angelfish) | CC-BY | 1K albedo+metallic+normal, 450-frame anim | GLTF via Sketchfab | Free |
| KhronosGroup BarramundiFish | 1 (barramundi) | CC0 | Albedo yes, normal map exists but unreferenced (issue #29) | Native GLTF | Free |
| OpenGameArt CDmir fish | 1 | CC0 | Diffuse only | FBX/OBJ | Free |
| Quaternius packs | 7-50+ | CC0 | No PBR (flat color), but good geometry + animations | FBX/OBJ/Blend | Free |

### Paid Packs (Best Value)

**cgsoul (Mikhail Nesterov)** — gold standard for real-time fish:
- **Coral Fish 7 (Pack 1):** 7 fish (Clownfish, Double-Saddle, Powder Blue Tang, Yellow Tang, Caranx, Bannerfish, Bicolor). 800-frame animation loops. ~$15-25. Royalty-free.
- **Tropical Fish Pack 7 v2.0:** 7 fish, 22 animation clips each (feeding, darting, transitions). 13.5k total triangles / 7k vertices. **NoAI license restriction.**
- **Aquarium Fish 7 (Pack 3):** 7 more species, paid.
- **Fish Pack 30 - Coral Bay:** 30 animated species, paid.

### Dead Ends
- Kay Lousberg / Kenney: no fish models
- itch.io CC0: no PBR fish packs
- GitHub repos: only KhronosGroup BarramundiFish
- Poly Pizza: flat colored only

### Recommendation
Free PBR fish = 1-2 models max. For 8+ species with consistent quality: buy cgsoul Coral Fish 7 (~$15-25) + free Emperor Angelfish + BarramundiFish = 9 species. Supplement with Quaternius CC0 geometry if needed for background/distance fish.

---

## Part 2: Per-Species Swim Animation (ABZU Technique)

### How ABZU Does It

Zero skeletal animation. All motion is **cosine waves applied to vertices in the vertex shader**. Per-species tuning via uniforms — no shader recompilation.

**Motion stack (additive layers):**
1. **Translate** — side-to-side body sway (X-axis oscillation)
2. **Yaw** — rotation around Y-axis
3. **Panning Yaw** — cosine wave traveling head→tail: `VERTEX.x += cos(time + body) * mask * wave`
4. **Panning Roll** — same for Z-axis rotation
5. **Masking** — all waves masked to tail region via vertex color gradient

**Performance:** Thousands of fish simultaneously. No joints, no skeletal evaluation, no CPU animation blending.

### Locomotion Spectrum — Concrete Parameter Values

From Di Santo et al. 2021 (PNAS), Donley & Dickson 2000, Gillis 1996:

#### Anguilliform (Eels, Moray)
- Wavelength: 0.58-0.62 BL
- Tail beat frequency: 1-3 Hz (1.5 Hz cruise)
- Tail amplitude: 0.05-0.08 BL
- Head amplitude: 60-80% of tail (whole body moves)
- Body participation: 100%
- Strouhal: 0.42-0.66
- **Shader:** low waveDensity (~1.6/BL), gentle mask gradient, stiffness ~0.0

#### Subcarangiform (Trout, Clownfish, Most Reef Fish)
- Wavelength: 0.8-1.0 BL
- Tail beat frequency: 2-5 Hz
- Tail amplitude: 0.08-0.12 BL
- Head amplitude: 10-30% of tail
- Body participation: posterior 50-70%
- Strouhal: 0.25-0.35
- **Shader:** moderate waveDensity (~1.0-1.25/BL), steeper mask, stiffness ~0.3-0.5

#### Carangiform (Jacks, Mackerel)
- Wavelength: 0.96-1.1 BL
- Tail beat frequency: 2-8 Hz (2.4 Hz cruise)
- Tail amplitude: 0.10-0.15 BL
- Head amplitude: ~0 (essentially rigid)
- Body participation: posterior 30-35%
- Strouhal: 0.19-0.30
- **Shader:** waveDensity ~1.0/BL, very steep mask, stiffness ~0.65

#### Thunniform (Tuna, Sharks)
- Wavelength: 1.0-1.2 BL
- Tail beat frequency: 2-10 Hz (2.4 Hz cruise)
- Tail amplitude: 0.15-0.25 BL (powerful strokes)
- Body participation: posterior 10-15% only
- Strouhal: 0.25-0.36
- **Shader:** waveDensity ~1.0, extremely steep mask, stiffness ~0.85

#### Ostraciiform (Boxfish, Pufferfish)
- Body is rigid — ZERO body wave
- Tail fin oscillation only: 1-3 Hz, 0.05-0.10 BL amplitude
- **Shader:** waveHeight = 0 for body, fin-only animation via separate mask

#### Labriform (Angelfish, Wrasse, Butterflyfish)
- Body stays RIGID during cruise — propulsion via pectoral fin rowing
- BCF (body wave) kicks in only for burst speed
- Pectoral frequency: 2-4 Hz, high amplitude sweep
- **Shader:** minimal body wave at cruise, add pectoral fin flutter channel

### Species → Locomotion Mode Mapping

| Fish | Mode | Key Shader Signature |
|------|------|---------------------|
| Clownfish | Subcarangiform | Moderate body wave + pectoral flutter for maneuvering |
| Blue/Yellow Tang | Subcarangiform→Carangiform | Stiffer body, tail-focused, moderate speed |
| Emperor Angelfish | Labriform (cruise) / Subcarangiform (burst) | Rigid body + pectoral flap at cruise |
| Barracuda | Carangiform | Very stiff, explosive tail, high frequency |
| Moray Eel | Anguilliform | Full-body sinuous wave, low frequency |
| Pufferfish | Ostraciiform | Rigid body, paddling tail fin only |
| Tuna/Shark | Thunniform | Rigid body, powerful crescent tail |
| Koi | Subcarangiform | Slow graceful S-curve, moderate body wave |
| Small schooling fish | Carangiform | Stiff body, rapid tail beat, tight schools |

### Per-Species Shader Parameters (Uniform Set)

| Parameter | Uniform Name | Range | What It Does |
|-----------|-------------|-------|--------------|
| Body wave frequency | uSwimFreq | 1-10 Hz | Tail beats per second |
| Wave number | uWaveK | 1.0-4.0 | Wave crests per body length |
| Base amplitude | uBaseAmplitude | 0.02-0.15 | Max lateral displacement |
| Body stiffness | uStiffness | 0.0-0.95 | 0=full body flex, 1=tail only |
| Amplitude exponent | uAmpExponent | 1.0-4.0 | Steepness of head→tail gradient |
| Stride (lateral sway) | uStrideAmp | 0.0-0.05 | Whole-body side-to-side |
| Roll amount | uRollAmp | 0.0-0.1 | Body roll per stroke |
| Pectoral freq | uPectoralFreq | 0-12 Hz | Pectoral fin flutter rate |
| Pectoral amplitude | uPectoralAmp | 0.0-0.15 | Pectoral fin sweep |

### Fin Animation via Vertex Color Masks

Standard approach across all implementations:
- **Red channel:** Body spine participation (0 at head, 1 at tail)
- **Green channel:** Pectoral fin mask
- **Blue channel:** Dorsal/caudal fin mask
- **Alpha channel:** Available for additional fin groups

Must be baked in Blender during model prep.

---

## Part 3: Reference Implementations

| Source | URL | Notes |
|--------|-----|-------|
| ABZU GDC Talk | gdcvault.com/play/1024409 | Original technique presentation |
| Godot Fish Tutorial | docs.godotengine.org/.../animating_thousands_of_fish.html | ABZU technique in Godot, GLSL portable |
| albertomelladoc/Fish-Animation | github.com/albertomelladoc/Fish-Animation | Unity shader, GLSL portable |
| elvismd/vertex_displacement_fish_shader | github.com/elvismd/vertex_displacement_fish_shader | Clean tutorial implementation |
| Bitshift Programmer | bitshiftprogrammer.com/2018/01/how-to-animate-fish-swimming-with.html | Parameters: WaveSpeed, WaveHeight, WaveDensity, StrideSpeed |
| Colin Geil ABZU Replication | cgeil.artstation.com/projects/YaLr9q | Layered approach documentation |
| Life Below (Three.js) | reef-dive-game.netlify.app | Three.js reef boids demo |
| r3f VAT | github.com/mikelyndon/r3f-webgl-vertex-animation-textures | React Three Fiber VAT implementation |

### Key Academic Papers
- Di Santo et al. 2021, PNAS — "Convergence of undulatory swimming kinematics"
- Donley & Dickson 2000 — Tuna vs mackerel kinematics
- Gillis 1996 — Body wave measurements across species
- Optimal specific wavelength (PLOS ONE) — journals.plos.org/plosone/article?id=10.1371/journal.pone.0179727

---

## Part 4: Predator-Prey Dynamics Design Notes

### Trophic Roles (encode per species)
- **Apex predator:** Large, bold, causes flee in prey species (trout, barracuda)
- **Mesopredator:** Medium, hunts small fish, flees from apex (tang, gray fish)
- **Prey:** Small, tight schools, panic flee from all predators (small schooling fish, clownfish)
- **Neutral:** Ignored by all, ignores all (koi, pufferfish)

### Behavioral States (per fish, encoded in GPU texture)
1. **School** — default boids behavior with same-species cohesion
2. **Flee** — triggered when predator enters perception cone. Speed boost, direction away from threat
3. **Chase** — triggered when prey enters predator's forward cone. Speed boost toward prey
4. **Idle/Drift** — low speed, near-stationary. Territorial fish (clownfish) default to this near their home
5. **Investigate** — slow approach toward unfamiliar species or objects. Curiosity behavior.
6. **Feed** — peck at coral/seabed. Speed near zero, oriented downward.
7. **Rest** — hover near seabed/coral, minimal movement.

### Cascade Effects
- One fish fleeing triggers neighbors to flee (panic propagation)
- Predator swimming through a school causes a parting wake
- Clownfish chase small intruders from anemone territory

### GPU Implementation
- Encode behavioral state in a separate GPU texture (stateTexture)
- State transitions computed in velocity shader based on neighbor species + distance
- Each state modifies the force weights differently (flee = high separation + directional bias, chase = override cohesion with pursuit vector)
