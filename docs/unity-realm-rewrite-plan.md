# Unity Realm Rewrite - Implementation Plan

> **Goal:** Port the TKA 3D realm system from Three.js/WebGPU to Unity
> **Timeline:** 3-4 weeks with parallel agent execution
> **Team:** 2 Claude Max instances + Austen

---

## Executive Summary

We're rewriting ~15,000 lines of TypeScript/TSL into C#/HLSL Unity code. The strategy is **parallel workstreams** - multiple agents working on independent systems simultaneously, with integration checkpoints.

### Why This Can Be Fast

1. **Existing architecture is clean** - Clear separation of concerns means clear task boundaries
2. **Unity has equivalents for everything** - No novel problems, just translation
3. **Parallel execution** - Independent systems can be built simultaneously
4. **No UI rewrite** - Unity is 3D only; Svelte app remains for UI

---

## Architecture Decision: Integration Strategy

### Option A: Unity as Standalone App ✓ RECOMMENDED
```
[Svelte Web App] ←→ [Unity Desktop/Mobile App]
                     ↑
              Deep link / file sharing
```
- Unity builds to Windows/Mac/iOS/Android
- Sequences exported as JSON, imported into Unity
- Camera/avatar state synced via local file or network

### Option B: Unity WebGL Embed
```
[Svelte Web App]
       ↓
  [Unity WebGL iframe]
```
- Slower than current WebGPU
- Complex message passing
- Not recommended

### Option C: Full Unity App (Replace Web)
```
[Unity App with UI Toolkit]
```
- Massive scope increase
- Loses web advantages
- Not recommended for MVP

**Decision: Option A** - Unity as standalone 3D viewer, web app remains primary interface.

---

## Project Structure

```
TKA-Unity-Realm/
├── Assets/
│   ├── Scripts/
│   │   ├── Core/
│   │   │   ├── ChunkManager.cs
│   │   │   ├── ChunkData.cs
│   │   │   └── RealmConfig.cs
│   │   ├── Generation/
│   │   │   ├── TerrainGenerator.cs
│   │   │   ├── BiomeClassifier.cs
│   │   │   ├── NoiseGenerator.cs
│   │   │   └── ErosionProcessor.cs
│   │   ├── Rendering/
│   │   │   ├── TerrainMaterialController.cs
│   │   │   ├── VegetationInstancer.cs
│   │   │   ├── AtmosphereController.cs
│   │   │   └── WaterController.cs
│   │   ├── Physics/
│   │   │   ├── PlayerController.cs
│   │   │   ├── TerrainColliderManager.cs
│   │   │   └── PhysicsConfig.cs
│   │   ├── Camera/
│   │   │   ├── CameraModeController.cs
│   │   │   ├── OrbitCamera.cs
│   │   │   ├── ThirdPersonCamera.cs
│   │   │   └── FirstPersonCamera.cs
│   │   ├── Avatar/
│   │   │   ├── AvatarController.cs
│   │   │   ├── SequencePlayer.cs
│   │   │   └── PropController.cs
│   │   └── Integration/
│   │       ├── SequenceImporter.cs
│   │       └── RealmLoader.cs
│   ├── Shaders/
│   │   ├── TerrainSplat.shader
│   │   ├── ProceduralNoise.hlsl
│   │   └── TriplanarMapping.hlsl
│   ├── Compute/
│   │   ├── TerrainGenerate.compute
│   │   └── ErosionSimulate.compute
│   ├── Resources/
│   │   ├── Vegetation/
│   │   └── Textures/
│   └── Scenes/
│       ├── RealmScene.unity
│       └── TestScene.unity
├── Packages/
│   └── manifest.json
└── ProjectSettings/
```

---

## Phase 1: Foundation (Days 1-3)

### 1.1 Project Setup
**Agent: Setup-Agent**

Tasks:
- [ ] Create Unity 2022.3 LTS project (URP pipeline)
- [ ] Configure project settings (linear color space, quality levels)
- [ ] Install packages: Cinemachine, Input System, Burst, Jobs, Mathematics
- [ ] Create folder structure
- [ ] Setup Git LFS for assets
- [ ] Create base scene with placeholder terrain

**Deliverable:** Empty project that builds, with structure in place.

### 1.2 Core Data Structures
**Agent: Core-Agent**

Port from TypeScript:
```typescript
// Current: src/lib/features/realm/core/types.ts
interface ChunkData {
  vertices: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  blendWeights: Float32Array[];
}
```

To C#:
```csharp
// Unity: Assets/Scripts/Core/ChunkData.cs
public struct ChunkData : IDisposable {
    public NativeArray<float3> vertices;
    public NativeArray<float3> normals;
    public NativeArray<float3> colors;
    public NativeArray<int> indices;
    public NativeArray<float2> blendWeights1;
    public NativeArray<float2> blendWeights2;

    public void Dispose() {
        if (vertices.IsCreated) vertices.Dispose();
        // ... etc
    }
}
```

Files to port:
- [ ] `ChunkData.cs` - from `chunk-manager.ts` types
- [ ] `RealmConfig.cs` - from `realm-definitions.ts`
- [ ] `BiomeType.cs` - from `biome-system.ts` enums
- [ ] `TerrainSettings.cs` - from various config objects

**Deliverable:** All core types defined, compiles clean.

---

## Phase 2: Terrain Generation (Days 3-7)

### 2.1 Noise System
**Agent: Noise-Agent**

Port the seeded noise system:
```csharp
// From: mcp-server/src/core/seeded-noise.ts
public static class SeededNoise {
    public static float Fbm(float x, float y, int octaves, float persistence, uint seed);
    public static float Perlin(float x, float y, uint seed);
    public static float Voronoi(float x, float y, uint seed);
}
```

Key requirements:
- [ ] Deterministic (same seed = same output)
- [ ] Use `Unity.Mathematics` for SIMD
- [ ] Burst-compatible (no managed allocations)

**Reference:** `mcp-server/src/core/seeded-noise.ts`

### 2.2 Compute Shader Terrain Generation
**Agent: Compute-Agent**

Port WebGPU compute to Unity compute shader:

```hlsl
// TerrainGenerate.compute
#pragma kernel GenerateHeightmap
#pragma kernel GenerateNormals
#pragma kernel AssignBiomes

RWStructuredBuffer<float3> vertices;
RWStructuredBuffer<float3> normals;
RWStructuredBuffer<float3> colors;

uint resolution;
float chunkSize;
int2 chunkCoord;
uint seed;

[numthreads(8, 8, 1)]
void GenerateHeightmap(uint3 id : SV_DispatchThreadID) {
    // Port from: generation/gpu/terrain-compute-generator.ts
}
```

Port from:
- [ ] `terrain-compute-generator.ts` → `TerrainGenerate.compute`
- [ ] `terrain-compute-types.ts` → shader constants
- [ ] TSL noise functions → HLSL equivalents

**Deliverable:** Compute shader generates heightmap matching TypeScript output.

### 2.3 Biome Classification
**Agent: Biome-Agent**

Port Whittaker diagram classification:

```csharp
public static class BiomeClassifier {
    public static BiomeType Classify(float temperature, float precipitation, float altitude);
    public static BiomeData GetBiomeData(BiomeType type);
}
```

Port from:
- [ ] `biome-system.ts` → `BiomeClassifier.cs`
- [ ] Biome blend weights
- [ ] Vegetation density tables

### 2.4 Job System Integration
**Agent: Jobs-Agent**

Replace Web Workers with C# Job System:

```csharp
[BurstCompile]
public struct TerrainGenerationJob : IJob {
    public int2 chunkCoord;
    public uint seed;
    public int resolution;

    [WriteOnly] public NativeArray<float3> vertices;
    [WriteOnly] public NativeArray<float3> normals;

    public void Execute() {
        // Generate terrain data
    }
}
```

Architecture:
- [ ] `TerrainJobScheduler.cs` - manages job queue
- [ ] `ChunkGenerationJob.cs` - generates single chunk
- [ ] Priority queue based on camera distance

---

## Phase 3: Chunk Streaming (Days 5-9)

### 3.1 Chunk Manager
**Agent: Chunk-Agent**

Port the chunk streaming system:

```csharp
public class ChunkManager : MonoBehaviour {
    [SerializeField] private int viewDistance = 8;
    [SerializeField] private int maxConcurrentLoads = 4;
    [SerializeField] private long memoryBudgetBytes = 256 * 1024 * 1024;

    private Dictionary<int2, LoadedChunk> loadedChunks;
    private PriorityQueue<ChunkRequest> loadQueue;

    void Update() {
        UpdateVisibleChunks(Camera.main.transform.position);
        ProcessLoadQueue();
        EnforceMemoryBudget();
    }
}
```

Port from:
- [ ] `chunk-manager.ts` → `ChunkManager.cs`
- [ ] LOD selection algorithm
- [ ] Direction-aware priority boosting
- [ ] Memory budget with LRU eviction

### 3.2 LOD System
**Agent: LOD-Agent**

Implement constraint-propagation LOD:

```csharp
public class LodManager {
    public int GetLodLevel(int2 chunkCoord, float3 cameraPos, float3 cameraDir);
    public void PropagateConstraints(Dictionary<int2, int> lodLevels);
}
```

Requirements:
- [ ] Max LOD difference of 1 between neighbors
- [ ] Iterative constraint propagation
- [ ] Skirt vertices for gap hiding

### 3.3 Mesh Generation
**Agent: Mesh-Agent**

Convert chunk data to Unity meshes:

```csharp
public static class ChunkMeshBuilder {
    public static Mesh BuildMesh(ChunkData data, int lod) {
        var mesh = new Mesh();
        mesh.SetVertices(data.vertices);
        mesh.SetNormals(data.normals);
        mesh.SetColors(data.colors);
        mesh.SetIndices(data.indices, MeshTopology.Triangles, 0);

        // Add blend weight vertex attributes
        mesh.SetUVs(2, data.blendWeights1);
        mesh.SetUVs(3, data.blendWeights2);

        return mesh;
    }
}
```

---

## Phase 4: Rendering (Days 7-12)

### 4.1 Terrain Splat Shader
**Agent: Shader-Agent**

This is the most complex shader port. Current TSL does:
1. Triplanar texture sampling
2. 5-layer splat blending (grass, rock, dirt, sand, snow)
3. Procedural texture generation (no texture files)
4. LOD morphing

```hlsl
// TerrainSplat.shader
Shader "TKA/TerrainSplat" {
    Properties {
        _GrassColor ("Grass Color", Color) = (0.3, 0.5, 0.2, 1)
        _RockColor ("Rock Color", Color) = (0.4, 0.4, 0.4, 1)
        // ...
    }

    SubShader {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" }

        Pass {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "TriplanarMapping.hlsl"
            #include "ProceduralNoise.hlsl"

            // Port from: rendering/terrain-splat-material.ts
            ENDHLSL
        }
    }
}
```

Port from:
- [ ] `terrain-splat-material.ts` TSL → HLSL
- [ ] Triplanar sampling functions
- [ ] Procedural pattern generators (grass, rock, etc.)
- [ ] Blend weight interpolation

### 4.2 Vegetation Instancing
**Agent: Vegetation-Agent**

Port instanced vegetation renderer:

```csharp
public class VegetationInstancer : MonoBehaviour {
    [SerializeField] private VegetationCatalog catalog;
    [SerializeField] private int maxInstancesPerCategory = 10000;

    private Dictionary<VegetationType, InstanceBatch> batches;

    public void UpdateVegetation(List<VegetationPlacement> placements) {
        // Group by type, update instance matrices
    }
}
```

Port from:
- [ ] `instanced-vegetation.ts` → `VegetationInstancer.cs`
- [ ] Model catalog (329 GLTF → Unity prefabs or Addressables)
- [ ] Per-chunk vegetation lists

### 4.3 Atmosphere & Sky
**Agent: Atmosphere-Agent**

```csharp
public class AtmosphereController : MonoBehaviour {
    [SerializeField] private Material skyMaterial;
    [SerializeField] private Light sunLight;

    public void UpdateForBiome(BiomeType biome) {
        // Fog color, density, sky gradient
    }
}
```

Port from:
- [ ] `atmosphere.ts` → `AtmosphereController.cs`
- [ ] Biome-specific fog settings
- [ ] Sky gradient procedural or skybox

### 4.4 Water System
**Agent: Water-Agent**

```csharp
public class WaterController : MonoBehaviour {
    [SerializeField] private float waterLevel = 0f;
    [SerializeField] private Material waterMaterial;

    void LateUpdate() {
        // Center water plane on camera
        transform.position = new Vector3(
            Camera.main.transform.position.x,
            waterLevel,
            Camera.main.transform.position.z
        );
    }
}
```

Options:
- [ ] Simple plane with reflective material (matches current)
- [ ] URP water shader (nicer but more work)

---

## Phase 5: Physics & Player (Days 10-14)

### 5.1 Player Controller
**Agent: Player-Agent**

```csharp
public class PlayerController : MonoBehaviour {
    [SerializeField] private float moveSpeed = 5f;
    [SerializeField] private float sprintMultiplier = 2f;
    [SerializeField] private float jumpForce = 5f;

    private CharacterController controller;
    private Vector3 velocity;
    private bool isGrounded;

    void Update() {
        // Input handling, movement, jumping
    }
}
```

Port from:
- [ ] `player-controller.ts` → `PlayerController.cs`
- [ ] Unity's CharacterController (simpler than Rapier port)
- [ ] Ground detection, slope limits

### 5.2 Camera System
**Agent: Camera-Agent**

Use Cinemachine for camera modes:

```csharp
public class CameraModeController : MonoBehaviour {
    [SerializeField] private CinemachineVirtualCamera orbitCam;
    [SerializeField] private CinemachineVirtualCamera thirdPersonCam;
    [SerializeField] private CinemachineVirtualCamera firstPersonCam;

    public CameraMode CurrentMode { get; private set; }

    public void CycleMode() {
        // V key cycles: Orbit → ThirdPerson → FirstPerson → Orbit
    }
}
```

Port from:
- [ ] `UnifiedCameraController.svelte` → `CameraModeController.cs`
- [ ] Orbit controls (drag to rotate)
- [ ] Third-person follow
- [ ] First-person look
- [ ] Pointer lock equivalent (Cursor.lockState)

### 5.3 Terrain Colliders
**Agent: Collider-Agent**

```csharp
public class TerrainColliderManager : MonoBehaviour {
    public void AddChunkCollider(int2 coord, ChunkData data) {
        var go = new GameObject($"Collider_{coord.x}_{coord.y}");
        var collider = go.AddComponent<MeshCollider>();
        collider.sharedMesh = ChunkMeshBuilder.BuildCollisionMesh(data);
    }

    public void RemoveChunkCollider(int2 coord) {
        // Destroy collider GameObject
    }
}
```

---

## Phase 6: Avatar & Animation (Days 12-16)

### 6.1 Avatar System
**Agent: Avatar-Agent**

```csharp
public class AvatarController : MonoBehaviour {
    [SerializeField] private Animator animator;
    [SerializeField] private Transform leftHand;
    [SerializeField] private Transform rightHand;

    public void SetPose(AvatarPose pose) {
        // IK or direct bone manipulation
    }
}
```

This requires:
- [ ] Avatar rig (Humanoid or custom)
- [ ] Prop attachment points
- [ ] Animation state machine or procedural posing

### 6.2 Sequence Playback
**Agent: Sequence-Agent**

```csharp
public class SequencePlayer : MonoBehaviour {
    [SerializeField] private AvatarController avatar;

    private SequenceData currentSequence;
    private float playbackTime;

    public void LoadSequence(string json) {
        currentSequence = JsonUtility.FromJson<SequenceData>(json);
    }

    void Update() {
        if (isPlaying) {
            playbackTime += Time.deltaTime;
            var pose = InterpolatePose(currentSequence, playbackTime);
            avatar.SetPose(pose);
        }
    }
}
```

Port from:
- [ ] Sequence JSON format
- [ ] Pose interpolation
- [ ] Beat timing

### 6.3 Props (Staff, Poi, Fans)
**Agent: Props-Agent**

```csharp
public class PropController : MonoBehaviour {
    [SerializeField] private PropType propType;
    [SerializeField] private MeshRenderer meshRenderer;

    public void UpdateMotion(PropMotion motion) {
        transform.localRotation = motion.rotation;
        // Trail rendering if applicable
    }
}
```

---

## Phase 7: Integration & Polish (Days 14-18)

### 7.1 Sequence Import
**Agent: Import-Agent**

```csharp
public class SequenceImporter : MonoBehaviour {
    public void ImportFromJson(string path) {
        var json = File.ReadAllText(path);
        var sequence = JsonUtility.FromJson<SequenceData>(json);
        FindObjectOfType<SequencePlayer>().LoadSequence(sequence);
    }

    // Watch for file changes (development)
    // Or accept drag-drop
}
```

### 7.2 Realm Configuration Loading
**Agent: Config-Agent**

```csharp
public class RealmLoader : MonoBehaviour {
    [SerializeField] private RealmConfig[] realmConfigs;

    public void LoadRealm(string realmId) {
        var config = realmConfigs.First(r => r.id == realmId);
        ApplyConfig(config);
    }
}
```

Port realm definitions:
- [ ] Hannon's Camp
- [ ] Performance Stage
- [ ] Procedural World

### 7.3 Debug Panel
**Agent: Debug-Agent**

```csharp
public class DebugPanel : MonoBehaviour {
    void OnGUI() {
        if (showDebug) {
            GUILayout.Label($"Chunks loaded: {chunkManager.LoadedCount}");
            GUILayout.Label($"FPS: {1f / Time.deltaTime:F1}");
            GUILayout.Label($"Memory: {Profiler.GetTotalAllocatedMemoryLong() / 1024 / 1024} MB");
        }
    }
}
```

---

## Phase 8: Build & Release (Days 16-20)

### 8.1 Build Configuration
- [ ] Windows standalone
- [ ] macOS standalone
- [ ] Android (stretch goal)
- [ ] iOS (stretch goal)

### 8.2 Performance Optimization
- [ ] Profile and identify bottlenecks
- [ ] LOD tuning
- [ ] Draw call batching
- [ ] Memory optimization

### 8.3 Release Package
- [ ] Installer/DMG
- [ ] Auto-updater (optional)
- [ ] Deep link handling (tka://realm/...)

---

## Parallel Execution Strategy

### Week 1: Foundation + Generation
```
Agent A (Opus):     Setup → Core Types → Chunk Manager
Agent B (Opus):     Noise System → Compute Shaders → Biome
```

### Week 2: Rendering + Physics
```
Agent A:            Terrain Shader → Vegetation → Atmosphere
Agent B:            Player Controller → Camera → Colliders
```

### Week 3: Avatar + Integration
```
Agent A:            Avatar System → Sequence Player → Props
Agent B:            Import/Export → Config Loading → Debug UI
```

### Week 4: Polish + Release
```
Agent A:            Performance optimization → Bug fixes
Agent B:            Build pipeline → Platform testing
```

---

## Risk Mitigation

### High Risk: Shader Porting
**Mitigation:** Start shader work early (Phase 4), have fallback to simple materials.

### Medium Risk: Asset Pipeline
**Mitigation:** Use Unity's Addressables for vegetation models, convert GLTF batch.

### Medium Risk: Sequence Format Compatibility
**Mitigation:** Document exact JSON schema, write validator.

### Low Risk: Physics Differences
**Mitigation:** Unity CharacterController is mature, should be straightforward.

---

## Success Criteria

1. **Terrain parity** - Same visual quality as web version
2. **60 FPS** - Consistent framerate on mid-range hardware
3. **Sequence playback** - Load and play any exported sequence
4. **All camera modes** - Orbit, third-person, first-person working
5. **Standalone builds** - Windows and macOS at minimum

---

## Files to Reference During Port

| Unity Target | TypeScript Source |
|--------------|-------------------|
| `ChunkManager.cs` | `core/chunk-manager.ts` |
| `TerrainGenerator.cs` | `generation/gpu/terrain-compute-generator.ts` |
| `BiomeClassifier.cs` | `generation/biome-system.ts` |
| `NoiseGenerator.cs` | `mcp-server/src/core/seeded-noise.ts` |
| `TerrainSplat.shader` | `rendering/terrain-splat-material.ts` |
| `VegetationInstancer.cs` | `rendering/instanced-vegetation.ts` |
| `AtmosphereController.cs` | `rendering/atmosphere.ts` |
| `WaterController.cs` | `rendering/water.ts` |
| `PlayerController.cs` | `shared/3d-core/physics/player-controller.ts` |
| `CameraModeController.cs` | `shared/3d-core/camera/UnifiedCameraController.svelte` |
| `RealmConfig.cs` | `core/realm-definitions.ts` |

---

## Next Steps

1. **Create Unity project** with folder structure
2. **Port core types** (ChunkData, RealmConfig, BiomeType)
3. **Implement noise system** with Burst compilation
4. **Create compute shader** for terrain generation
5. **Build chunk streaming** with Job System
6. **Port terrain shader** (biggest single task)

Ready to begin when you are.
