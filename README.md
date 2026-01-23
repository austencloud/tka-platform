# TKA Worlds

Unity companion app for TKA Scribe - immersive 3D environments for flow arts visualization.

## Getting Started

### 1. Open in Unity Hub

1. Open Unity Hub
2. Click "Add" → "Add project from disk"
3. Select the `TKAWorlds` folder
4. Unity will detect it as a 2022.3 project and install packages

### 2. First Launch

Unity will:
- Import all packages (Burst, Mathematics, Cinemachine, URP, etc.)
- Compile all scripts
- Create default assets

This may take 5-10 minutes on first launch.

### 3. Create a Test Scene

1. File → New Scene → Basic (URP)
2. Save as `Assets/Scenes/TestScene.unity`
3. Create empty GameObject, name it "World"
4. Add `WorldManager` component
5. Set Realm ID to "procedural"
6. Hit Play

## Project Structure

```
Assets/
├── Scripts/
│   ├── Core/              # Core types, configs, managers
│   │   ├── BiomeType.cs
│   │   ├── ChunkData.cs
│   │   ├── RealmConfig.cs
│   │   ├── RealmPreset.cs
│   │   ├── DefaultRealms.cs
│   │   ├── BiomeCharacteristics.cs
│   │   └── WorldManager.cs
│   ├── Generation/        # Terrain & biome generation
│   │   ├── SeededNoise.cs
│   │   └── BiomeClassifier.cs
│   ├── Rendering/         # Materials, vegetation, atmosphere
│   ├── Physics/           # Player controller, colliders
│   ├── Camera/            # Camera modes (orbit, 3rd, 1st person)
│   ├── Avatar/            # Avatar animation, sequence playback
│   └── Integration/       # Sequence import from web app
│       └── SequenceData.cs
├── Shaders/
│   └── TerrainSplat.shader
├── Compute/
│   └── TerrainGenerate.compute
├── Resources/
│   ├── Vegetation/
│   └── Textures/
└── Scenes/
```

## Implementation Status

### Phase 1: Foundation ✅
- [x] Project structure
- [x] Core data types (ChunkData, RealmConfig, BiomeType)
- [x] Noise system (SeededNoise with Burst)
- [x] Biome classifier (Whittaker diagram)
- [x] Sequence import models
- [x] Default realm presets
- [x] Package manifest

### Phase 2: Terrain Generation (Next)
- [ ] TerrainGenerator using compute shader
- [ ] ChunkMeshBuilder
- [ ] Terrain material setup

### Phase 3: Chunk Streaming
- [ ] ChunkManager
- [ ] LOD system
- [ ] Memory budget enforcement

### Phase 4: Rendering
- [ ] Terrain splat shader (triplanar)
- [ ] VegetationInstancer
- [ ] AtmosphereController
- [ ] WaterController

### Phase 5: Player & Camera
- [ ] PlayerController (CharacterController)
- [ ] CameraModeController (Cinemachine)
- [ ] TerrainColliderManager

### Phase 6: Avatar & Animation
- [ ] AvatarController
- [ ] SequencePlayer
- [ ] PropController

## Data Flow

```
Web App (TKA Scribe)          Unity (TKA Worlds)
┌────────────────────┐        ┌────────────────────┐
│  Create sequence   │        │  Load sequence     │
│  Export JSON       │───────▶│  Parse SequenceData│
│                    │        │  Animate avatar    │
└────────────────────┘        └────────────────────┘
```

## Realm Configurations

Matching the web app:

| Realm | Description |
|-------|-------------|
| `performance-stage` | Campground clearing with fire pit, surrounded by forest |
| `procedural` | Infinite procedural terrain for exploration |
| `flat-testing` | Flat plane for testing |

## Requirements

- Unity 2022.3 LTS
- URP (Universal Render Pipeline)
- Packages: Burst, Mathematics, Cinemachine, Input System

## License

Part of The Kinetic Alphabet project.
