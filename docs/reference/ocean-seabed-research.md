# Ocean Seabed Research — State of the Art (2024-2026)

> Reference document for upgrading the TKA ocean floor to AAA quality.
> Compiled 2026-05-22 from web research across repos, GDC talks, Shadertoy, and tutorials.

---

## 1. Terrain Displacement

### Multi-Octave FBM (the standard)
- **Octaves**: 4-6 layers. Each doubles frequency, halves amplitude. 4-5 is sweet spot for seabed.
- **Lacunarity**: 2.0 standard. 2.0-2.5 for natural seabed.
- **Gain/Persistence**: 0.5 standard.
- **Displacement scale**: For 100-unit plane, 2-5 units total displacement for gentle dunes. Sand ripple octaves at 0.05-0.2 amplitude.

### Implementation Paths
- **`three-custom-shader-material` (CSM)**: Extend MeshStandardMaterial with custom vertex/fragment. Retains PBR lighting. Recommended.
- **`MeshStandardMaterial.displacementMap`**: Bake heightmap texture. Simpler, less dynamic.
- **TSL Node Material (WebGPU)**: Official `webgpu_tsl_procedural_terrain` example. Future-proof.

### Performance
Vertex displacement is cheap — 256x256 plane = 65K vertices with 5-octave FBM is fine. Can bake to geometry if static.

---

## 2. Object-Terrain Integration

### A. Depth-Based Terrain Blending (the big one)
Used in God of War, Subnautica, most AAA open-world games:
1. Render depth pre-pass of terrain from orthographic camera above
2. In object shader, sample terrain depth texture
3. Where object intersects/near terrain, blend object material toward terrain material

### B. Height-Based Texture Splatting
From [Advanced Terrain Splatting](https://www.gamedeveloper.com/programming/advanced-terrain-texture-splatting):
- Each texture layer stores height/depth in alpha channel
- At blend boundaries, pick texture with highest height value (not linear interpolation)
- "Sand doesn't stick to stones — it falls down and fills cracks between them, leaving tops of stones pure."

### C. Geometry-Level Integration (Sediment Mounding)
- At each object position, push terrain vertices DOWN slightly (burial)
- Around object base, push vertices UP slightly (sediment mounding)
- Modify heightmap at scatter time before generating geometry

### D. Skirt/Apron Geometry
Thin geometry "skirts" around object bases that blend from object to terrain material. Cheap (few extra triangles per object), highly effective. Used in ABZU.

---

## 3. Sand Material / Shader

### Journey Sand Shader (gold standard)
[Alan Zucconi's 6-part breakdown](https://www.alanzucconi.com/2019/10/08/journey-sand-shader-1/):

**Sand Normal**: Noise texture perturbs surface normals per-pixel. Micro-variation without geometry.

**Diffuse Color**: Varies with view angle and light direction. Underwater: warm tan in caustic-lit, cool blue-gray in shadow.

**Specular**: Wet specular — wider, softer highlights. Roughness 0.6-0.8.

**Glitter**: Random noise texture, where `dot(reflectedGrainNormal, viewDir) > threshold` → bright specular point. Reduce intensity underwater but keep for wet sparkling effect.

**Sand Ripples**: Based on slope angle. Perpendicular to current direction, 5-15cm wavelength. Secondary normal map modulated by terrain slope, scrolled slowly.

### Triplanar Mapping
For slopes/reef walls — project textures from 3 axes, blend by surface normal. [Ben Golus's article](https://bgolus.medium.com/normal-mapping-for-a-triplanar-shader-10bf39dca05a) on correct normal map handling.

### Parallax Occlusion Mapping (POM)
Adds perceived depth to sand without extra geometry. [Moana Shadertoy](https://wallisc.github.io/rendering/2020/12/08/Making-Of-Moana-the-shadertoy.html) uses 6-step POM. Costs 8-32 texture samples per fragment. Use distance falloff to disable beyond 10-15 units.

### Bioturbation / Detrital Zones
DTIC paper identifies 3 components:
1. Power-law roughness (broad terrain shape)
2. Rippled-sand component (flow-generated)
3. Bioturbative component (organism disturbance)

Worley/cellular noise for irregular disturbed patches → modulate ripple normal intensity.

### Color Variation Layers
- Base: warm tan/beige
- Depth gradient: shift toward blue-gray with distance (water absorption)
- Patch variation: Voronoi patches of different hue (sediment composition)
- Near-object darkening: AO-like effect where objects sit
- Caustic brightening: additive caustic pattern

---

## 4. Caustics

### A. Projected Texture Animation (cheapest)
[GPU Gems Ch.2](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics):
- Tileable caustic texture or atlas (32 frames)
- Project via world-space XZ, animate UV + cross-fade
- Fade by depth. Align with main light.
- Cost: 1 texture sample. Looks good at medium distance.

### B. Voronoi Procedural (mid-range) — CURRENT APPROACH
[Cyanilux](https://www.cyanilux.com/tutorials/water-shader-breakdown/):
- Voronoi noise in fragment shader, world XZ
- Animate cell positions with sin(time)
- Sharpen: `pow(voronoi, 5.0)`
- 20-40 ALU ops per fragment. Resolution-independent.

### C. Physical Refraction Tracing (highest quality)
[martinRenou/threejs-caustics](https://github.com/martinRenou/threejs-caustics):
- Environment texture encoding (RGB=XYZ, A=depth) from above
- `refract()` + iterative intersection stepping
- `dFdx`/`dFdy` for intensity (Evan Wallace technique)
- ~60fps with 256x256 ray grid. Extra render pass.

### Terrain Normal Alignment
Caustics should follow terrain normal, not just XZ projection. Offset UV by terrain normal for slopes.

---

## 5. Debris and Detritus

### InstancedMesh + LOD
[Bandinopla article](https://medium.com/@pablobandinopla/grass-debri-in-three-js-6da6b3d599c3):
- `BatchedMesh` (r156+) for mixed-geometry debris — single draw call
- LOD tiers: full geo close, simplified mid, billboard far, culled beyond
- Frustum culling per-instance
- [InstancedMesh2](https://github.com/agargaro/instanced-mesh): BVH culling, LOD, sorting. 1M instances demonstrated.

### MeshSurfaceSampler + Poisson Disc
- `MeshSurfaceSampler` samples points on terrain mesh
- Filter through Poisson disc for spacing
- Use surface normal for orientation
- Weight by slope/height (more shells in flat areas)

### Shader-Based Detail (no geometry)
- High-frequency detail normal map
- Distance-faded (beyond ~5 units)
- Color variation via secondary noise (dark specks)
- Zero geometry, zero draw calls.

---

## 6. Key References

### Repos
| Repo | What | Stars |
|---|---|---|
| [martinRenou/threejs-caustics](https://github.com/martinRenou/threejs-caustics) | Physical caustics in Three.js | 360 |
| [N8python/caustics](https://github.com/N8python/caustics) | Raymarching caustics (in drei) | 26 |
| [THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) | Extend standard materials | — |
| [IceCreamYou/THREE.Terrain](https://github.com/IceCreamYou/THREE.Terrain) | Procedural terrain + splatting | — |
| [agargaro/instanced-mesh](https://github.com/agargaro/instanced-mesh) | InstancedMesh2 with BVH/LOD | — |
| [Nugget8/Three.js-Ocean-Scene](https://github.com/Nugget8/Three.js-Ocean-Scene) | Perlin seabed + tile LOD | 55 |

### Shadertoy
| Shader | What |
|---|---|
| [Moana (wlsyzH)](https://www.shadertoy.com/view/wlsyzH) | POM sand, volumetric water, wet sand |
| [Underwater Caustics (XttyRX)](https://www.shadertoy.com/view/XttyRX) | Voronoi caustics on seabed |
| [Seascape (Ms2SD1)](https://www.shadertoy.com/view/Ms2SD1) | FBM ocean classic |

### Articles
| Article | What |
|---|---|
| [Journey Sand Shader (6 parts)](https://www.alanzucconi.com/2019/10/08/journey-sand-shader-1/) | Sand material: normals, diffuse, specular, glitter, ripples |
| [Making of Moana Shadertoy](https://wallisc.github.io/rendering/2020/12/08/Making-Of-Moana-the-shadertoy.html) | POM, wet sand, volumetric |
| [Advanced Terrain Splatting](https://www.gamedeveloper.com/programming/advanced-terrain-texture-splatting) | Height-based blending |
| [Maxime Heckel: Caustics in WebGL](https://blog.maximeheckel.com/posts/caustics-in-webgl/) | Step-by-step caustics tutorial |
| [GPU Gems: Water Caustics](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics) | Classic caustics reference |
| [Beneath the Waves UE4](https://80.lv/articles/beneath-the-waves-creating-underwater-scene-in-ue4) | Three-pass weathering |
| [Inigo Quilez: Colored Fog](https://iquilezles.org/articles/fog/) | Per-channel RGB absorption |
