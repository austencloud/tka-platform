# Cloud Rendering Research — AAA Techniques for Canvas 2D

Research conducted 2026-05-21 for Celestial theme background.

## The AAA Standard: Volumetric Raymarching Through Noise

Every major game since 2015 (Horizon Zero Dawn, RDR2, Frostbite games) uses the same core: **raymarching through 3D noise fields**. A ray from each pixel steps through a cloud volume, sampling density and accumulating light.

Not directly possible in Canvas 2D (no GPU shaders), but the noise generation and lighting models can be pre-baked.

## The Noise Stack: Perlin-Worley + fBm

### Perlin-Worley Blend (Schneider/Nubis)

The signature noise of modern cloud rendering:

```javascript
// Perlin provides smooth base, Worley provides cellular structure
const perlinWorley = remap(perlin, 0, 1, worley, 1);
```

Where `remap(value, inMin, inMax, outMin, outMax)` maps value from input range to output range.

### Worley (Cellular) Noise

Scatter random points in grid cells, measure distance to nearest:
- Euclidean distance → round cell edges (cloud-like)
- Low values near cell centers = cloud cores
- High values at cell edges = cloud boundaries
- **Inverted** (1 - worley) for cloud density

### Fractal Brownian Motion (fBm)

Layer multiple noise octaves:
```
value = sum(amplitude_i * noise(position * frequency_i))
lacunarity = 2.0  (frequency multiplier)
gain = 0.5  (amplitude multiplier)
octaves = 4-6
```

### Full Density Combination

```
baseShape = remap(perlinFBM, 0, 1, worleyFBM * 0.3, 1.0)
density = pow(max(0, baseShape - threshold), exponent)
```

## Density Remapping — Puffy vs Wispy

The **coverage remap** is the key trick:
```
density = remap(noise, 1.0 - coverage, 1.0, 0.0, 1.0)
```
- Low coverage (0.2) → only noise peaks survive → small wispy clouds
- High coverage (0.9) → most noise contributes → thick full clouds

**Power curve** controls character:
- `pow(density, 0.7)` → puffy cumulus (expands midtones)
- `pow(density, 2.0)` → thin cirrus (crushes midtones)

## Height Gradients — Cloud Types

```javascript
// Cumulus: flat bottom, puffy top
function cumulusGradient(h) {
  return smoothstep(0, 0.1, h) * smoothstep(1, 0.6, h);
}

// Stratus: thin uniform layer  
function stratusGradient(h) {
  return smoothstep(0, 0.05, h) * smoothstep(1, 0.8, h);
}
```

## Lighting Model

### Beer-Lambert Law (Absorption)
```
transmittance = exp(-density * distance * absorption)
```

### Henyey-Greenstein Phase Function (Scattering)
```
phase = (1 - g²) / (4π * (1 + g² - 2g·cosθ)^1.5)
g = 0.8 for strong forward scatter (silver lining)
```

### Powder/Sugar Effect (Dark Edges)
```
powder = 1 - exp(-density * 2)
```
Thin cloud edges appear darker because less multi-scattering occurs.

### Combined
```
light = beer * powder * phase
```

## Canvas 2D Strategy

**Pre-bake noise textures per cloud at startup:**
1. Each cloud = small offscreen canvas (300-400px wide)
2. Fill with Perlin-Worley fBm noise
3. Apply coverage mask (elliptical), power curve, height gradient
4. Bake Beer's law lighting + powder effect into luminance
5. Store as offscreen canvas
6. Per frame: just `drawImage` at animated position

**Performance:** 6 clouds × 300×200px = 360K pixels. Even with 5 noise evals/pixel = ~1.8M evals. Takes 100-300ms one time. Per frame: 6 `drawImage` calls = sub-1ms.

**For cirrus:** Separate noise texture with `pow(density, 2.0)` and stretched aspect ratio.

## Key Sources

- Schneider, "Real-time Volumetric Cloudscapes of Horizon Zero Dawn" (SIGGRAPH 2015)
- Schneider, "Nubis: Authoring Real-Time Volumetric Cloudscapes" (2017)
- Schneider, "Nubis, Evolved" (2022), "Nubis, Cubed" (SIGGRAPH 2023)
- Frostbite, "Physically Based Sky, Atmosphere & Cloud Rendering"
- RDR2 Graphics Study (frustum voxel grid + Fourier opacity mapping)
- Sebastian Lague, "Coding Adventure: Clouds"
- Acerola, "The Science Behind Rendering Clouds in AAA Video Games"
- The Book of Shaders: fBm (chapter 13), Cellular Noise (chapter 12)
- Inigo Quilez: fBM articles
