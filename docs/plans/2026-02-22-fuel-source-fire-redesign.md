# Fuel Source Fire System Redesign

## Problem

The Flame Lab has too many controls for end users: 8 physics presets + 3 sliders + color toggle + S/M/L sizes. The presets are named abstractly (Candlewick, Comet, Ghost Fire) and don't map to concepts spinners already understand. The system needs to be reorganized around fuel sources, a concept every fire spinner already knows.

## Design Decisions (Confirmed)

1. **Fuel IS the preset.** No separate "behavior" axis. Pick your fuel, set intensity, done.
2. **4 fuel sources:** White Gas, Lamp Oil, Isopropyl, Charcoal
3. **End users get 3 controls:** fuel picker, intensity slider, color mode toggle
4. **Admin Flame Lab keeps full physics authoring** with real-time preview
5. **Fuel sources stored in Firestore**, not hardcoded. 4 baked-in defaults for offline fallback.
6. **Physics-informed parameters** grounded in real combustion research.
7. **Two rendering paths:** Navier-Stokes fluid sim (liquid fuels) + particle system (charcoal)

## Fuel Source Physics

### White Gas (Naphtha / Coleman Fuel)
- **Color:** Bright orange-yellow. Soot particles at 1200-1400K. RGB ~(255, 140, 40) peak.
- **Trail decay:** 50-150ms. Fast burn, short trails that snap back.
- **Soot:** Low-moderate. Clean burn.
- **Burn character:** Bright, vivid, the standard. Most spinners' default fuel.
- **Renderer:** Fluid sim. High burnRate, moderate fuelAmount, low-moderate dissipation.

### Lamp Oil (Kerosene / Paraffin / UPLO)
- **Color:** Deep reddish-orange. Soot at 1100-1300K. RGB ~(240, 100, 20) peak.
- **Trail decay:** 150-300ms. Slow burn, lingering trails with visible thickness.
- **Soot:** Moderate-high. Thicker visible trail, more smoke.
- **Burn character:** Warm, deep, photographs well. Longer burn time IRL (5-8 min vs 3-4).
- **Renderer:** Fluid sim. Lower burnRate, higher fuelDissipation persistence, warmer color curve.

### Isopropyl Alcohol (91%+ IPA)
- **Color:** Blue-purple base from CH*/C2* radical chemiluminescence. Near-invisible tips. RGB ~(0, 64, 255) base.
- **Trail decay:** 20-50ms. Almost no persistence. No soot to linger.
- **Soot:** Near zero. Clean combustion to CO2 + H2O.
- **Burn character:** Ethereal, eerie, alien. Nearly invisible in daylight IRL.
- **Renderer:** Fluid sim with modified color pass. Blue shader path instead of blackbody orange curve.

### Charcoal (Steel Wool / Charcoal Cage)
- **Color:** Orange-white sparks (1200-1500K at ejection) fading through orange to dark red to invisible.
- **Trail decay:** 100-500ms per spark particle. Longer than liquid fuel embers.
- **Soot:** None. Produces iron oxide (solid).
- **Renderer:** NEW particle system. Not fluid sim.
- **Spark physics:**
  - Ejection: tangential to spin arc at tip velocity (~3-20 m/s)
  - Deceleration: air drag (Stokes-regime for 50-100um particles)
  - Gravity: downward curve creating shower arcs
  - Cooling: -10 to -50 K/ms (partially offset by continued oxidation)
  - Secondary sparks: carbon-rich pockets in steel wool cause branching micro-explosions
  - Scatter: ~90-120 degree cone around tangential direction

## Architecture

### Data Model

```typescript
// Replaces FirePhysicsParams presets with fuel source documents
interface FuelSourceDocument {
  id: string;                        // "white-gas", "lamp-oil", "isopropyl", "charcoal"
  name: string;                      // Display name
  description: string;               // One-line description
  rendererType: "fluid" | "particle"; // Which rendering path

  // For fluid renderer (liquid fuels)
  fluidParams?: FirePhysicsParams;   // The 14 Navier-Stokes params
  colorCurve?: FireColorCurve;       // Blackbody color temperature mapping

  // For particle renderer (charcoal)
  particleParams?: CharcoalParams;   // Spark physics params

  builtIn: boolean;                  // true for the 4 defaults
  publishedAt?: Timestamp;
  publishedBy?: string;
}

interface FireColorCurve {
  // Maps temperature (0.0-1.0 normalized) to RGB
  // White gas: standard orange blackbody
  // Lamp oil: shifted warmer/redder
  // Isopropyl: blue chemiluminescence curve
  coldColor: [number, number, number];    // RGB at lowest visible temp
  midColor: [number, number, number];     // RGB at mid combustion
  hotColor: [number, number, number];     // RGB at peak
  coreColor: [number, number, number];    // RGB at wick core (brightest)
}

interface CharcoalParams {
  sparkRate: number;           // Sparks per second per tip
  sparkLifetime: number;       // Seconds before fade-out
  sparkInitialSpeed: number;   // Multiplier on tip velocity
  sparkScatter: number;        // Cone angle in degrees (90-120)
  sparkSize: number;           // Base particle size
  sparkSizeVariance: number;   // Random size variation
  gravity: number;             // Downward acceleration
  dragCoefficient: number;     // Air resistance
  secondarySparkChance: number; // Probability of branching sparks
  emberGlowDuration: number;   // How long the glow persists after landing
  coolingRate: number;         // Temperature decay per ms
  initialTemperature: number;  // Starting temp in normalized units
}
```

### Firestore Structure

```
config/
  fuelSources/          <- NEW collection
    white-gas            <- FuelSourceDocument
    lamp-oil
    isopropyl
    charcoal
  fireDefaults           <- EXISTING, unchanged (fire points, global physics)
```

### Rendering Pipeline

```
User selects fuel → FuelSourceDocument loaded
  ├─ rendererType === "fluid"
  │   → Existing WebGLFireRenderer
  │   → fluidParams override DEFAULT_PHYSICS
  │   → colorCurve modifies display pass (blackbody mapping)
  │   → Intensity slider scales fuelAmount + burnRate + temperatureInjection
  │
  └─ rendererType === "particle"
      → NEW CharcoalParticleRenderer
      → particleParams configure spark behavior
      → Tip positions from FireTipTracker (same source)
      → Intensity slider scales sparkRate + sparkSize
```

### End User UI (in animation viewer)

```
┌─────────────────────────────────┐
│  Fire                      [ON] │
├─────────────────────────────────┤
│                                 │
│  ┌────────┬────────┬──────────┐ │
│  │ White  │  Lamp  │  Iso-    │ │
│  │  Gas   │  Oil   │  propyl  │ │
│  ├────────┴────────┴──────────┤ │
│  │        Charcoal            │ │
│  └────────────────────────────┘ │
│                                 │
│  Intensity          ○────────── │
│                                 │
│  Color   [ Natural ] [ Tinted ] │
│                                 │
└─────────────────────────────────┘
```

### Admin Flame Lab

Two tabs (same as today):

**Tuning Tab (redesigned):**
- Fuel source selector (same picker as end user, plus "New Fuel Source" button)
- Full physics editor for selected fuel, organized in 4 collapsible groups:
  - Combustion: burnRate, fuelAmount, fuelEfficiency, temperatureInjection
  - Convection: buoyancyStrength, upwardBias
  - Persistence: velocityDissipation, temperatureDissipation, fuelDissipation, coolingRate
  - Turbulence: vorticityStrength, splatRadius, pressureDissipation, velocityInjectScale
- Color curve editor (4 color pickers for cold/mid/hot/core)
- For charcoal: particle-specific params instead of fluid params
- Real-time preview with animation canvas
- Save / Rename / Delete fuel source
- Publish to production (pushes all fuel sources to Firestore)

**Fire Points Tab (unchanged):**
- SVG canvas for wick position editing per prop type
- Same as today

### Migration from Current System

| Current | New |
|---------|-----|
| 8 hardcoded presets in FirePresets.ts | 4 FuelSourceDocuments in Firestore |
| preset ID stored in config | fuel source ID stored in config |
| FireOverlayConfig.physicsPreset | FireOverlayConfig.fuelSourceId |
| Trail Length slider (user-facing) | Baked into fuel source persistence params (admin-only) |
| Flame Height slider (user-facing) | Baked into fuel source convection params (admin-only) |
| S/M/L size buttons in settings | Removed (intensity slider replaces) |
| FirePresets.ts exports | Deprecated, replaced by FuelSourceLoader |

### New Files

- `CharcoalParticleRenderer.ts` - WebGL particle system for spark rendering
- `FuelSourceLoader.ts` - loads fuel sources from Firestore with baked-in fallbacks
- `FuelSourceDocument.ts` - TypeScript interfaces
- `charcoal-shaders.ts` - GLSL vertex/fragment shaders for spark particles
- `fuel-color-curves.ts` - default color curves for the 4 built-in fuels
- `FuelSourceEditor.svelte` - admin fuel source editing UI (replaces preset cards + 3 sliders)
- `FuelSourcePicker.svelte` - shared fuel picker component (used by both end user and admin)
- `CharcoalParamsEditor.svelte` - admin editor for charcoal-specific params

### Deleted/Deprecated

- `FirePresets.ts` - replaced by Firestore fuel sources
- Trail Length slider from end user UI
- Flame Height slider from end user UI
- S/M/L size buttons from settings visibility panel

## Physics Research Reference

Full combustion physics data is documented separately. Key simulation parameters per fuel:

| Param | White Gas | Lamp Oil | Isopropyl |
|-------|-----------|----------|-----------|
| burnRate | 4.0-6.0 (fast) | 2.0-3.5 (slow) | 5.0-7.0 (very fast) |
| fuelAmount | 0.8-1.2 | 0.6-0.9 | 0.4-0.7 |
| coolingRate | 3.0-5.0 | 1.5-3.0 | 5.0-8.0 |
| velocityDissipation | 0.92-0.95 | 0.95-0.98 | 0.88-0.91 |
| temperatureDissipation | 0.92-0.95 | 0.95-0.98 | 0.88-0.91 |
| buoyancyStrength | 60-100 | 40-70 | 80-120 |
| vorticityStrength | 5-10 | 3-7 | 8-15 |
| Color peak RGB | (255,140,40) | (240,100,20) | (0,64,255) |

Charcoal uses the particle system exclusively, no fluid params.
