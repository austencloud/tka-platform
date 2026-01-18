# Unified 3D Primitives Architecture (v2 - Post-Audit)

## Goal
Consolidate ALL 3D features (Stage, Gallery, Worlds) into a unified system built from composable primitives. Fix the Stage mobile/DevTools bug as part of this unification.

**Design Philosophy:** Composition over inheritance. Physics-optional. Platform-agnostic.

---

## Audit Enhancements (2026 Best Practices)

Based on web research audit, the following enhancements are incorporated:

1. **GamepadProvider** - InputCapabilities tracks gamepads, so support them
2. **Inertia/gesture smoothing** in TouchLookProvider - touch data is noisy
3. **Sensitivity scaling** by camera distance - standard 3D UX
4. **ECS InputSystem** for Worlds instead of monolithic controller
5. **Blur/visibility handling** in KeyboardProvider - prevents stuck keys
6. **Study camera-controls patterns** for damping/collision reference

---

## Target Architecture (Updated)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 5: Destination Integration              │
│  StageController  │  GalleryController  │  WorldsInputSystem     │
│  (Svelte components that compose primitives)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 4: Physics Adapters                     │
│  RapierAdapter  │  RaycastAdapter  │  KinematicAdapter           │
│  (IPhysicsAdapter interface - physics is OPTIONAL)               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 3: Movement Primitives                  │
│  MovementCalculator  │  AnimationParams  │  CollisionChecker     │
│  (pure logic, no physics dependency)                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 2: Camera Primitives                    │
│  FirstPersonLook  │  ThirdPersonOrbit  │  CameraDamping          │
│  CameraConstraints │ DistanceScaledSensitivity                   │
│  (composable behaviors, input-agnostic)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 1: Input Primitives                     │
│  InputCapabilities (existing)  │  InputManager (existing)        │
│  PointerLockProvider  │  TouchLookProvider (with inertia)        │
│  KeyboardProvider     │  GamepadProvider                         │
│  (unified IInputProvider interface)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure (Final)

```
src/lib/shared/3d/
├── input/
│   ├── contracts/
│   │   └── IInputProvider.ts
│   ├── providers/
│   │   ├── KeyboardProvider.ts
│   │   ├── TouchLookProvider.ts
│   │   ├── PointerLockProvider.ts
│   │   └── GamepadProvider.ts
│   └── InputProviderFactory.ts
├── camera/
│   ├── contracts/
│   │   ├── ICameraController.ts
│   │   └── ICameraBehavior.ts
│   ├── behaviors/
│   │   ├── FirstPersonLook.ts
│   │   ├── ThirdPersonOrbit.ts
│   │   ├── CameraDamping.ts
│   │   └── CameraConstraints.ts
│   ├── CameraController.ts
│   └── utils/
│       └── sensitivity.ts
├── movement/
│   ├── contracts/
│   │   └── IMovementController.ts
│   ├── MovementCalculator.ts
│   └── AnimationParameters.ts
└── physics/
    ├── contracts/
    │   └── IPhysicsAdapter.ts
    └── adapters/
        ├── KinematicAdapter.ts
        ├── RaycastAdapter.ts
        └── RapierAdapter.ts
```

---

## Implementation Order

1. **Input Layer** (~8 files)
2. **Camera Layer** (~7 files)
3. **Movement Layer** (~3 files)
4. **Physics Layer** (~4 files)
5. **Integration** (~3 migrations)
6. **Cleanup** (delete deprecated)
