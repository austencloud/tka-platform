# Ship Fire Effects to Production (v0.11)

## Problem

The fire rendering system is fully built (Navier-Stokes fluid sim, WebGL2 shaders, 22 prop types, 8 physics presets) but the tuning is hardcoded. Austen needs to dial in the exact fire look per prop type via Flame Lab, then publish those settings globally so all users get the same curated fire experience.

## Current State

### What exists

- **WebGLFireRenderer**: Full fluid sim with 11 GLSL shaders, double-buffered FBOs
- **FireTipTracker**: Zero-alloc hot path, transforms fire points from prop-local to canvas space
- **PropFirePoints**: 22 prop types with default fire attachment positions + override callback system
- **Flame Lab**: Admin tuning UI with 8 physics presets, intensity/trail/height sliders, fire point editor, auto-chaining playback
- **Settings UI**: Fire toggle + Natural/Colored + Small/Medium/Large in visibility tab
- **DI wiring**: `flameLabContainer` with `FirePointOverrideProvider`

### What's missing

1. **No persistence to Firebase** - fire point overrides and physics tuning are in `localStorage` (Austen's machine only)
2. **No global defaults** - all users get hardcoded `DEFAULT_PHYSICS` values
3. **3-tier presets map to hardcoded preset IDs** - should instead scale intensity within admin-set parameters
4. **No "Publish" action** in Flame Lab - no way for admin to push tuning to production

## Design

### Two-layer config model

**Admin layer (Firestore `config/fireDefaults`):**

```typescript
interface FireDefaultsDocument {
  // Per-prop fire point positions + wick sizes (from Fire Point Editor)
  firePoints: Record<string, PropFirePointConfig>;

  // Per-prop physics baseline (from Tuning Tab)
  // If a prop has no entry, falls back to global physics
  propPhysics: Record<string, FirePhysicsParams>;

  // Global physics baseline (the "Fire Spin" preset tuned by admin)
  globalPhysics: FirePhysicsParams;

  // Metadata
  updatedAt: Timestamp;
  updatedBy: string;
}
```

**User layer (localStorage via existing `AnimationVisibilityStateManager`):**

- `fireEffect: boolean` - on/off toggle (existing)
- `flameColorMode: "natural" | "colored"` - color mode (existing)
- `firePreset: string` - intensity tier: `"small" | "medium" | "large"` (rewired)

### Intensity tier model

The 3 user-facing tiers (Small/Medium/Large) apply an intensity multiplier to the admin's physics baseline. They do NOT map to different physics presets.

```typescript
const INTENSITY_TIERS = {
  small:  { intensity: 0.5, flameHeight: 0.6 },
  medium: { intensity: 1.0, flameHeight: 1.0 },  // admin's tuned baseline
  large:  { intensity: 1.5, flameHeight: 1.4 },
};
```

Fire point positions and wick sizes (`flameScale`) are always locked to admin values. Users cannot change where fire comes from or how big the wick footprint is.

### Data flow

```
Austen tunes in Flame Lab
    |
    v
"Publish to Production" button (admin-only)
    |
    v
Writes to Firestore: config/fireDefaults
    |
    v
App startup: FireDefaultsLoader fetches once, caches to localStorage
    |
    v
AnimationEngine reads admin defaults as baseline
    |
    v
User's tier choice (S/M/L) multiplies intensity + flameHeight
    |
    v
WebGLFireRenderer renders with final computed params
```

### New services

1. **`IFireDefaultsLoader`** (contract) + **`FireDefaultsLoader`** (implementation)
   - Loads `config/fireDefaults` from Firestore on app startup
   - Caches to `localStorage` for offline resilience
   - Provides `getFirePoints(propType)`, `getPhysics(propType)`, `getGlobalPhysics()`

2. **`IFireDefaultsPublisher`** (contract) + **`FireDefaultsPublisher`** (implementation)
   - Admin-only: writes current Flame Lab state to `config/fireDefaults`
   - Called from Flame Lab "Publish to Production" button
   - Gated by `isAdmin()` check

### Modified files

- **`FirePointOverrideProvider`** - Add Firestore-backed layer: on init, load published defaults. Override lookup: local edit > published default > hardcoded.
- **`AnimationEngine`** - On fire enable, get physics from `FireDefaultsLoader` instead of hardcoded `DEFAULT_PHYSICS`. Apply user's intensity tier as multiplier.
- **`AnimationDesktopControls` / `AnimationMobileControls`** - Rewire Small/Medium/Large from preset IDs to intensity tier IDs.
- **`AnimationVisibilityStateManager`** - Change `firePreset` semantics from preset ID to tier ID. Migration: `"candlewick"` -> `"small"`, `"fire-spin"` -> `"medium"`, `"torch"` -> `"large"`.
- **`FlameLabTuningTab`** - Add "Publish to Production" button (admin-only, with confirmation).
- **`flame-lab-container.ts`** - Register new services.

### What stays unchanged

- `WebGLFireRenderer` - rendering layer untouched
- `FireTipTracker` - tip tracking untouched
- `PropFirePoints` - override callback pattern stays, just gets a new data source
- `FirePresets` - 8 presets remain as Flame Lab starting points, not user-facing
- Settings UI layout - same toggle, same buttons, just rewired underneath

## Release

- v0.11.0 - fire effects are a new user-facing capability
- Feature existed behind Lab only; now it's a production toggle in settings
