# Unified Tip Points Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three duplicate prop tip position registries (fire, LED, trail) with a single unified registry so all effects share one set of tip positions per prop type.

**Architecture:** One `PropTipPoints.ts` defines `{ dx, dy }` positions per prop type. Each effect renderer applies its own global scaling at read time. One override provider, one persistence path, one editor experience.

**Tech Stack:** Svelte 5 + TypeScript + ITI DI + Firebase Firestore

**Spec:** `docs/superpowers/specs/2026-03-11-unified-tip-points-design.md`

---

## Chunk 1: Unified Tip Point Registry

### Task 1: Create unified PropTipPoints.ts

**Files:**
- Create: `src/lib/shared/animation-engine/domain/types/PropTipPoints.ts`

This file replaces `PropFirePoints.ts`, `PropLedPoints.ts`, and `PropTrailPoints.ts`. It defines position-only tip points. The `dx`/`dy` values come from the existing fire point definitions (the most complete set).

- [ ] **Step 1: Create `PropTipPoints.ts`**

```typescript
// src/lib/shared/animation-engine/domain/types/PropTipPoints.ts

/**
 * Unified Prop Tip Point Definitions
 *
 * Single source of truth for tip positions across all effects (fire, LED,
 * trails, charcoal). Coordinates are in prop-local space (same units as
 * PROP_DIMENSIONS):
 *   - dx: offset along prop primary axis from center
 *   - dy: offset perpendicular to prop axis
 *
 * Effect-specific scaling (flameScale, brightness, trailWidth) is NOT stored
 * here. Each effect renderer applies its own global scaling at read time.
 */

/**
 * A single tip attachment point on a prop. Position only — no effect-specific
 * properties. All effects (fire, LED, trail, charcoal) emit from these same
 * positions.
 */
export interface TipPoint {
  /** Offset along prop primary axis from center (prop-dimension units) */
  dx: number;
  /** Offset perpendicular to prop axis from center (prop-dimension units) */
  dy: number;
}

/**
 * Tip point configuration for a prop type.
 */
export interface PropTipConfig {
  /** Tip attachment points in prop-local coordinates */
  points: TipPoint[];
}

// ─── Staff Family ─────────────────────────────────────────────────────────────

const STAFF_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -150, dy: 0 },
    { dx: 150, dy: 0 },
  ],
};

const BIGSTAFF_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -300, dy: 0 },
    { dx: 300, dy: 0 },
  ],
};

// ─── Club Family ──────────────────────────────────────────────────────────────

const CLUB_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 130, dy: 0 }],
};

const BIGCLUB_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 130, dy: 0 }],
};

// ─── Fan Family ───────────────────────────────────────────────────────────────

const FAN_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 77, dy: -92 },
    { dx: 109, dy: -51 },
    { dx: 120, dy: 0 },
    { dx: 109, dy: 51 },
    { dx: 77, dy: 92 },
  ],
};

const BIGFAN_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 154, dy: -184 },
    { dx: 218, dy: -102 },
    { dx: 240, dy: 0 },
    { dx: 218, dy: 102 },
    { dx: 154, dy: 184 },
  ],
};

// ─── Triad Family ─────────────────────────────────────────────────────────────

const TRIAD_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 130, dy: 0 },
    { dx: -65, dy: -113 },
    { dx: -65, dy: 113 },
  ],
};

const BIGTRIAD_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 260, dy: 0 },
    { dx: -130, dy: -226 },
    { dx: -130, dy: 226 },
  ],
};

// ─── Hoop Family ──────────────────────────────────────────────────────────────

const MINIHOOP_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 40, dy: -80 },
    { dx: 120, dy: -25 },
    { dx: 120, dy: 25 },
    { dx: 40, dy: 80 },
    { dx: -30, dy: 0 },
  ],
};

const BIGHOOP_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 80, dy: -150 },
    { dx: 230, dy: -50 },
    { dx: 230, dy: 50 },
    { dx: 80, dy: 150 },
    { dx: -60, dy: 0 },
  ],
};

// ─── Buugeng Family ───────────────────────────────────────────────────────────

const BUUGENG_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 130, dy: -40 },
    { dx: -130, dy: 40 },
  ],
};

const BIGBUUGENG_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 260, dy: -80 },
    { dx: -260, dy: 80 },
  ],
};

const FRACTALGENG_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 120, dy: -80 },
    { dx: -120, dy: 80 },
  ],
};

const TRIGENG_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 130, dy: -60 },
    { dx: 0, dy: 0 },
    { dx: -130, dy: 60 },
  ],
};

// ─── Sword ────────────────────────────────────────────────────────────────────

const SWORD_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 280, dy: 0 }],
};

// ─── Triquetra Family ─────────────────────────────────────────────────────────

const TRIQUETRA_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 130, dy: 0 },
    { dx: -65, dy: -113 },
    { dx: -65, dy: 113 },
  ],
};

// ─── Chicken Family ───────────────────────────────────────────────────────────

const CHICKEN_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: -150, dy: 0 },
    { dx: 150, dy: 0 },
  ],
};

// ─── Guitar Family ────────────────────────────────────────────────────────────

const GUITAR_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 290, dy: 0 }],
};

const UKULELE_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 170, dy: 0 }],
};

// ─── Doublestar Family ────────────────────────────────────────────────────────

const DOUBLESTAR_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 150, dy: 0 },
    { dx: -150, dy: 0 },
    { dx: 0, dy: -75 },
    { dx: 0, dy: 75 },
  ],
};

const BIGDOUBLESTAR_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 300, dy: 0 },
    { dx: -300, dy: 0 },
    { dx: 0, dy: -150 },
    { dx: 0, dy: 150 },
  ],
};

// ─── Eightrings Family ────────────────────────────────────────────────────────

const EIGHTRINGS_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 75, dy: -65 },
    { dx: -75, dy: -65 },
  ],
};

const BIGEIGHTRINGS_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 150, dy: -130 },
    { dx: -150, dy: -130 },
  ],
};

// ─── Quiad ────────────────────────────────────────────────────────────────────

const QUIAD_TIP_POINTS: PropTipConfig = {
  points: [
    { dx: 125, dy: 0 },
    { dx: 0, dy: -125 },
    { dx: -125, dy: 0 },
    { dx: 0, dy: 125 },
  ],
};

// ─── Torch ────────────────────────────────────────────────────────────────────

const TORCH_TIP_POINTS: PropTipConfig = {
  points: [{ dx: -140, dy: 0 }],
};

const BIGTORCH_TIP_POINTS: PropTipConfig = {
  points: [{ dx: -120, dy: 0 }],
};

// ─── Poi ──────────────────────────────────────────────────────────────────────

const POI_TIP_POINTS: PropTipConfig = {
  points: [{ dx: 130, dy: 0 }],
};

// ─── No tips (contact ball, hand) ─────────────────────────────────────────────

const EMPTY_TIP_POINTS: PropTipConfig = {
  points: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Override Provider (callback pattern avoids circular dependency with feature layer)
// ═══════════════════════════════════════════════════════════════════════════════

type TipPointOverrideFn = (propType: string) => PropTipConfig | null;
let overrideProvider: TipPointOverrideFn | null = null;

/**
 * Register a callback that can supply custom tip points for a prop type.
 * Pass null to remove the override provider.
 */
export function setTipPointOverrideProvider(
  provider: TipPointOverrideFn | null
): void {
  overrideProvider = provider;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════════════════════

export const PROP_TIP_POINTS: Record<string, PropTipConfig> = {
  // Staff family
  staff: STAFF_TIP_POINTS,
  simple_staff: STAFF_TIP_POINTS,
  bigstaff: BIGSTAFF_TIP_POINTS,
  staff_v2: STAFF_TIP_POINTS,

  // Club family
  club: CLUB_TIP_POINTS,
  bigclub: BIGCLUB_TIP_POINTS,

  // Fan family
  fan: FAN_TIP_POINTS,
  bigfan: BIGFAN_TIP_POINTS,

  // Triad family
  triad: TRIAD_TIP_POINTS,
  bigtriad: BIGTRIAD_TIP_POINTS,

  // Hoop family
  minihoop: MINIHOOP_TIP_POINTS,
  bighoop: BIGHOOP_TIP_POINTS,

  // Buugeng family
  buugeng: BUUGENG_TIP_POINTS,
  bigbuugeng: BIGBUUGENG_TIP_POINTS,
  fractalgeng: FRACTALGENG_TIP_POINTS,
  trigeng: TRIGENG_TIP_POINTS,

  // Hand
  hand: EMPTY_TIP_POINTS,

  // Triquetra family
  triquetra: TRIQUETRA_TIP_POINTS,
  triquetra2: TRIQUETRA_TIP_POINTS,

  // Sword
  sword: SWORD_TIP_POINTS,

  // Chicken family
  chicken: CHICKEN_TIP_POINTS,
  bigchicken: CHICKEN_TIP_POINTS,

  // Guitar family
  guitar: GUITAR_TIP_POINTS,
  ukulele: UKULELE_TIP_POINTS,

  // Doublestar family
  doublestar: DOUBLESTAR_TIP_POINTS,
  bigdoublestar: BIGDOUBLESTAR_TIP_POINTS,

  // Eightrings family
  eightrings: EIGHTRINGS_TIP_POINTS,
  bigeightrings: BIGEIGHTRINGS_TIP_POINTS,

  // Quiad
  quiad: QUIAD_TIP_POINTS,

  // Contact ball family
  contactball: EMPTY_TIP_POINTS,
  bigcontactball: EMPTY_TIP_POINTS,
  doublecontactball: EMPTY_TIP_POINTS,
  bigdoublecontactball: EMPTY_TIP_POINTS,

  // Torch family
  torch: TORCH_TIP_POINTS,
  bigtorch: BIGTORCH_TIP_POINTS,

  // Poi
  poi: POI_TIP_POINTS,
};

export const DEFAULT_TIP_POINTS: PropTipConfig = STAFF_TIP_POINTS;

/**
 * Look up tip points for a prop type. Checks override provider first,
 * then hardcoded registry, then falls back to staff-like endpoints.
 */
export function getTipPoints(
  propType: string | null | undefined
): PropTipConfig {
  if (!propType) return DEFAULT_TIP_POINTS;
  const key = propType.toLowerCase();
  if (overrideProvider) {
    const override = overrideProvider(key);
    if (override) return override;
  }
  return PROP_TIP_POINTS[key] ?? DEFAULT_TIP_POINTS;
}
```

- [ ] **Step 2: Verify the new file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from `PropTipPoints.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/PropTipPoints.ts
git commit -m "feat: add unified PropTipPoints registry"
```

---

### Task 2: Update FireTipTracker to use unified tips

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/FireTipTracker.ts`

Change the import from `getFirePoints`/`FirePoint` to `getTipPoints`/`TipPoint`. The `flameScale` field on `PropTipData` output gets a constant `1.0` — the WebGL renderer already multiplies by `config.intensity` for global scaling.

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { getFirePoints, type FirePoint } from "../../domain/types/PropFirePoints";
```
With:
```typescript
import { getTipPoints, type TipPoint } from "../../domain/types/PropTipPoints";
```

- [ ] **Step 2: Update `emitPropTips` method**

In `emitPropTips()` (line ~163), replace:
```typescript
const fireConfig = getFirePoints(propType);
const firePoints = fireConfig.points;
```
With:
```typescript
const tipConfig = getTipPoints(propType);
const tipPoints = tipConfig.points;
```

Update the loop (line ~197) — replace:
```typescript
for (let i = 0; i < firePoints.length && outputIndex < MAX_TOTAL_TIPS; i++) {
    const fp: FirePoint = firePoints[i]!;
```
With:
```typescript
for (let i = 0; i < tipPoints.length && outputIndex < MAX_TOTAL_TIPS; i++) {
    const tp: TipPoint = tipPoints[i]!;
```

Update the coordinate transform (line ~202):
```typescript
const worldX = centerX + (tp.dx * cosA - tp.dy * sinA) * gridScaleFactor;
const worldY = centerY + (tp.dx * sinA + tp.dy * cosA) * gridScaleFactor;
```

Update the `emitTip` call (line ~205) — pass `1.0` instead of `fp.flameScale`:
```typescript
this.emitTip(
    this.prevTips[prevSlot]!,
    worldX,
    worldY,
    propIndex,
    i,
    1.0, // flameScale now uniform; global intensity handles scaling
    currentTime,
    outputIndex
);
```

Update the invalidation loop (line ~219):
```typescript
for (let i = tipPoints.length; i < MAX_TOTAL_TIPS / 2; i++) {
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/FireTipTracker.ts
git commit -m "refactor: FireTipTracker uses unified tip points"
```

---

### Task 3: Update LedTipTracker to use unified tips

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/LedTipTracker.ts`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { getLedPoints } from "../../domain/types/PropLedPoints";
```
With:
```typescript
import { getTipPoints } from "../../domain/types/PropTipPoints";
```

- [ ] **Step 2: Update tip count calculation in `update()`**

In `update()` (lines ~82-85), replace:
```typescript
const blueLedConfig = getLedPoints(config.bluePropType);
const redLedConfig = getLedPoints(config.redPropType);
const totalLedCount =
    (blueLedConfig?.points.length ?? 0) + (redLedConfig?.points.length ?? 0);
```
With:
```typescript
const blueTipConfig = getTipPoints(config.bluePropType);
const redTipConfig = getTipPoints(config.redPropType);
const totalLedCount =
    (blueTipConfig?.points.length ?? 0) + (redTipConfig?.points.length ?? 0);
```

- [ ] **Step 3: Update `emitPropTips` method**

In `emitPropTips()` (line ~162), replace:
```typescript
const ledConfig = getLedPoints(propType);
const points = ledConfig.points;
```
With:
```typescript
const tipConfig = getTipPoints(propType);
const points = tipConfig.points;
```

In the loop (line ~185), the `lp.dx`/`lp.dy` references stay the same (the field names match `TipPoint`).

Update the `emitTip` call (line ~205) — pass `1.0` instead of `lp.brightness`:
```typescript
this.emitTip(
    this.prevTips[prevSlot]!,
    worldX,
    worldY,
    propIndex,
    i,
    1.0, // brightness now uniform; global LED brightness handles scaling
    color,
    currentTime,
    outputIndex
);
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/LedTipTracker.ts
git commit -m "refactor: LedTipTracker uses unified tip points"
```

---

### Task 4: Create TipPointOverrideProvider

**Files:**
- Create: `src/lib/features/effects-lab/services/implementations/TipPointOverrideProvider.ts`

Replaces `FirePointOverrideProvider`, `LedPointOverrideProvider`, and `TrailPointOverrideProvider`. Based on `FirePointOverrideProvider` (the most mature, Firestore-backed). Stores position-only `{ dx, dy }` points.

- [ ] **Step 1: Create `TipPointOverrideProvider.ts`**

```typescript
// src/lib/features/effects-lab/services/implementations/TipPointOverrideProvider.ts

import type { PropTipConfig } from "$lib/shared/animation-engine/domain/types/PropTipPoints";
import type { IEffectPointOverrideProvider } from "../contracts/IEffectPointOverrideProvider";
import type { IEffectPointsPersister, EffectPoint } from "../contracts/IEffectPointsPersister";

/** Deep-copy that works on Svelte 5 $state proxies (structuredClone cannot clone them). */
function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Unified tip point override provider backed by shared EffectPointsPersister.
 *
 * Position-only tip configs ({ dx, dy }) are stored in Firestore via the
 * persister. All users read from the same document, so admin edits propagate
 * globally in real time.
 *
 * Fallback chain (highest to lowest priority):
 * 1. Points from EffectPointsPersister (Firebase-backed)
 * 2. Admin-published defaults
 */
export class TipPointOverrideProvider implements IEffectPointOverrideProvider {
  private publishedDefaults: Map<string, PropTipConfig>;

  constructor(private readonly persister: IEffectPointsPersister) {
    this.publishedDefaults = new Map();
  }

  getOverride(propType: string): PropTipConfig | null {
    const key = propType.toLowerCase();

    const stored = this.persister.getPoints(key);
    if (stored) {
      return {
        points: stored.map((p) => ({
          dx: p.dx,
          dy: p.dy,
        })),
      };
    }

    return this.publishedDefaults.get(key) ?? null;
  }

  saveOverride(propType: string, config: PropTipConfig): void {
    const key = propType.toLowerCase();

    const points: EffectPoint[] = config.points.map((p) => ({
      dx: p.dx,
      dy: p.dy,
    }));
    this.persister.save(key, points);
  }

  clearOverride(propType: string): void {
    const key = propType.toLowerCase();
    this.persister.save(key, []);
  }

  hasOverride(propType: string): boolean {
    const key = propType.toLowerCase();
    return this.persister.getPoints(key) !== null;
  }

  getOverriddenTypes(): string[] {
    const types: string[] = [];
    const candidates = [
      "staff", "fan", "club", "buugeng", "triad", "minipoi",
      "doublestaff", "sword", "bigstaff", "bigfan", "bigclub",
      "minihoop", "bighoop", "bigbuugeng", "fractalgeng", "trigeng",
      "triquetra", "chicken", "guitar", "ukulele", "doublestar",
      "eightrings", "quiad", "torch", "poi",
    ];
    for (const key of candidates) {
      if (this.persister.getPoints(key) !== null) {
        types.push(key);
      }
    }
    return types;
  }

  exportAll(): Record<string, PropTipConfig> {
    const result: Record<string, PropTipConfig> = {};
    for (const key of this.getOverriddenTypes()) {
      const override = this.getOverride(key);
      if (override) {
        result[key] = deepCopy(override);
      }
    }
    return result;
  }

  importAll(overrides: Record<string, PropTipConfig>): void {
    for (const [key, config] of Object.entries(overrides)) {
      if (this.isValidConfig(config)) {
        this.saveOverride(key, config);
      }
    }
  }

  loadPublishedDefaults(defaults: Record<string, PropTipConfig>): void {
    this.publishedDefaults.clear();
    for (const [key, config] of Object.entries(defaults)) {
      this.publishedDefaults.set(key.toLowerCase(), deepCopy(config));
    }
  }

  saveUserDefault(propType: string, config: PropTipConfig): void {
    this.saveOverride(propType, config);
  }

  getUserDefault(propType: string): PropTipConfig | null {
    return this.getOverride(propType);
  }

  hasUserDefault(propType: string): boolean {
    return this.hasOverride(propType);
  }

  clearUserDefault(propType: string): void {
    this.clearOverride(propType);
  }

  getUserDefaultTypes(): string[] {
    return this.getOverriddenTypes();
  }

  private isValidConfig(config: unknown): config is PropTipConfig {
    if (!config || typeof config !== "object") return false;
    const c = config as Record<string, unknown>;
    if (!Array.isArray(c.points)) return false;
    return c.points.every(
      (p: unknown) =>
        p !== null &&
        typeof p === "object" &&
        typeof (p as Record<string, unknown>).dx === "number" &&
        typeof (p as Record<string, unknown>).dy === "number"
    );
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/effects-lab/services/implementations/TipPointOverrideProvider.ts
git commit -m "feat: add unified TipPointOverrideProvider"
```

---

### Task 5: Simplify EffectDescriptor

**Files:**
- Modify: `src/lib/features/effects-lab/domain/EffectDescriptor.ts`

All descriptors now use `getTipPoints()` for default points. The per-point intensity fields (`getIntensity`, `setIntensity`, `intensityLabel`, etc.) are removed from the interface since we no longer have per-point scaling. The `createPoint` method returns `TipPoint` (just `{ dx, dy }`).

- [ ] **Step 1: Rewrite EffectDescriptor.ts**

```typescript
// src/lib/features/effects-lab/domain/EffectDescriptor.ts

import type { TipPoint } from "$lib/shared/animation-engine/domain/types/PropTipPoints";
import { getTipPoints } from "$lib/shared/animation-engine/domain/types/PropTipPoints";

/**
 * Describes how a visual effect behaves in the Effects Lab editor.
 * Shared components use this to adapt their UI (colors, labels)
 * without knowing the specific effect type.
 */
export interface EffectDescriptor {
  /** Unique ID for persistence and routing */
  id: string;
  /** Display label */
  label: string;
  /** FontAwesome icon class */
  icon: string;
  /** Primary accent color (hex) */
  accentColor: string;
  /** Mid-opacity accent for backgrounds (rgba) */
  accentColorMid: string;
  /** Border accent (rgba) */
  accentColorBorder: string;
  /** Whether this effect type has a point placement editor */
  hasPointEditor: boolean;
  /** Create a new point at the given coordinates */
  createPoint(dx: number, dy: number): TipPoint;
  /** Load default points for a prop type from the unified registry */
  getDefaultPoints(propType: string): TipPoint[];
}

export type EffectMode = "trails" | "fire" | "charcoal" | "led";

const sharedCreatePoint = (dx: number, dy: number): TipPoint => ({ dx, dy });
const sharedGetDefaultPoints = (propType: string): TipPoint[] =>
  getTipPoints(propType).points;

export const FIRE_DESCRIPTOR: EffectDescriptor = {
  id: "fire",
  label: "Fire",
  icon: "fas fa-fire",
  accentColor: "#f97316",
  accentColorMid: "rgba(249, 115, 22, 0.15)",
  accentColorBorder: "rgba(249, 115, 22, 0.3)",
  hasPointEditor: true,
  createPoint: sharedCreatePoint,
  getDefaultPoints: sharedGetDefaultPoints,
};

export const LED_DESCRIPTOR: EffectDescriptor = {
  id: "led",
  label: "LED",
  icon: "fas fa-lightbulb",
  accentColor: "#00ff88",
  accentColorMid: "rgba(0, 255, 136, 0.15)",
  accentColorBorder: "rgba(0, 255, 136, 0.3)",
  hasPointEditor: true,
  createPoint: sharedCreatePoint,
  getDefaultPoints: sharedGetDefaultPoints,
};

export const TRAILS_DESCRIPTOR: EffectDescriptor = {
  id: "trails",
  label: "Trails",
  icon: "fas fa-wind",
  accentColor: "#3b82f6",
  accentColorMid: "rgba(59, 130, 246, 0.15)",
  accentColorBorder: "rgba(59, 130, 246, 0.3)",
  hasPointEditor: false,
  createPoint: sharedCreatePoint,
  getDefaultPoints: () => [],
};

export const CHARCOAL_DESCRIPTOR: EffectDescriptor = {
  id: "charcoal",
  label: "Charcoal",
  icon: "fas fa-meteor",
  accentColor: "#f59e0b",
  accentColorMid: "rgba(245, 158, 11, 0.15)",
  accentColorBorder: "rgba(245, 158, 11, 0.3)",
  hasPointEditor: true,
  createPoint: sharedCreatePoint,
  getDefaultPoints: sharedGetDefaultPoints,
};

/** All registered effect descriptors, in display order */
export const EFFECT_DESCRIPTORS: EffectDescriptor[] = [
  TRAILS_DESCRIPTOR,
  FIRE_DESCRIPTOR,
  CHARCOAL_DESCRIPTOR,
  LED_DESCRIPTOR,
];

/** Look up a descriptor by ID */
export function getEffectDescriptor(id: string): EffectDescriptor {
  return EFFECT_DESCRIPTORS.find((d) => d.id === id) ?? TRAILS_DESCRIPTOR;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Errors in files that still reference removed `EffectDescriptor` fields (`getIntensity`, `setIntensity`, etc.). These are fixed in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/effects-lab/domain/EffectDescriptor.ts
git commit -m "refactor: simplify EffectDescriptor to use unified tip points"
```

---

## Chunk 2: DI Wiring + Editor Updates

### Task 6: Update effects-lab-container.ts

**Files:**
- Modify: `src/lib/shared/di/containers/effects-lab-container.ts`

Replace two separate providers with one `TipPointOverrideProvider`. Wire it with the unified `setTipPointOverrideProvider`.

- [ ] **Step 1: Rewrite effects-lab-container.ts**

```typescript
// src/lib/shared/di/containers/effects-lab-container.ts

import { createContainer } from "iti";
import { EffectPointsPersister } from "$lib/features/effects-lab/services/implementations/EffectPointsPersister";
import { TipPointOverrideProvider } from "$lib/features/effects-lab/services/implementations/TipPointOverrideProvider";
import { FireDefaultsLoader } from "$lib/shared/animation-engine/services/implementations/FireDefaultsLoader";
import { FireDefaultsPublisher } from "$lib/shared/animation-engine/services/implementations/FireDefaultsPublisher";
import { setTipPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropTipPoints";

/**
 * Effects Lab DI container.
 *
 * Registration order matters:
 * 1. `effectPointsPersister` — shared Firebase-backed position storage
 * 2. `fireDefaultsLoader` — admin-published defaults from Firestore
 * 3. `tipPointOverrideProvider` — depends on persister, single unified provider
 */
export const effectsLabContainer = createContainer()
  .add({
    effectPointsPersister: () => {
      const persister = new EffectPointsPersister();
      persister.load();
      return persister;
    },
    fireDefaultsLoader: () => new FireDefaultsLoader(),
    fireDefaultsPublisher: () => new FireDefaultsPublisher(),
  })
  .add(({ effectPointsPersister, fireDefaultsLoader }) => ({
    tipPointOverrideProvider: () => {
      const provider = new TipPointOverrideProvider(effectPointsPersister);

      // Hook into the domain-level tip point lookup so overrides
      // take effect automatically in all tip trackers
      setTipPointOverrideProvider((propType) => provider.getOverride(propType));

      // Load admin-published defaults from Firestore; strip flameScale
      // from legacy fire point data to produce position-only tip configs
      fireDefaultsLoader.load().then(() => {
        const firePoints = fireDefaultsLoader.getAllFirePoints();
        if (Object.keys(firePoints).length > 0) {
          const tipDefaults: Record<string, { points: { dx: number; dy: number }[] }> = {};
          for (const [key, config] of Object.entries(firePoints)) {
            tipDefaults[key] = {
              points: config.points.map((p) => ({ dx: p.dx, dy: p.dy })),
            };
          }
          provider.loadPublishedDefaults(tipDefaults);
        }
      });

      // Subscribe to real-time updates
      fireDefaultsLoader.subscribe(() => {
        const firePoints = fireDefaultsLoader.getAllFirePoints();
        if (Object.keys(firePoints).length > 0) {
          const tipDefaults: Record<string, { points: { dx: number; dy: number }[] }> = {};
          for (const [key, config] of Object.entries(firePoints)) {
            tipDefaults[key] = {
              points: config.points.map((p) => ({ dx: p.dx, dy: p.dy })),
            };
          }
          provider.loadPublishedDefaults(tipDefaults);
        }
      });

      return provider;
    },
  }));

export type EffectsLabContainer = typeof effectsLabContainer;
```

- [ ] **Step 2: Update container-types.ts if needed**

Check `src/lib/shared/di/container-types.ts` — replace references to `firePointOverrideProvider` and `ledPointOverrideProvider` with `tipPointOverrideProvider`.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Errors in files still referencing old container items. Fixed in next tasks.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/effects-lab-container.ts
git commit -m "refactor: wire single TipPointOverrideProvider in DI container"
```

---

### Task 7: Update EffectPointEditorTab

**Files:**
- Modify: `src/lib/features/effects-lab/components/EffectPointEditorTab.svelte`

Replace the provider branching logic with a single `tipPointOverrideProvider`. Remove cross-effect copy sources (no longer needed — all effects share the same points).

- [ ] **Step 1: Simplify the script block**

Replace the entire provider resolution block (lines 24-57) with:

```typescript
const provider = container.items.tipPointOverrideProvider as IEffectPointOverrideProvider;
const persister = container.items.effectPointsPersister as IEffectPointsPersister;
const editorState = new EffectPointEditorState(provider, descriptor, persister);
```

Remove the `firePointProvider`, `ledPointProvider`, `copySourceProviders`, and `buildCopySourceProviders` variables/function entirely.

- [ ] **Step 2: Remove copySourceProviders from template**

In the template (line 92), change:
```svelte
<EffectPointListPanel {editorState} {descriptor} {copySourceProviders} />
```
To:
```svelte
<EffectPointListPanel {editorState} {descriptor} />
```

- [ ] **Step 3: Update EffectPointListPanel props**

In `EffectPointListPanel.svelte`, remove the `copySourceProviders` prop and any "Copy From" UI that uses it. (This feature is no longer needed since all effects share tips.)

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/effects-lab/components/EffectPointEditorTab.svelte
git add src/lib/features/effects-lab/components/EffectPointListPanel.svelte
git commit -m "refactor: EffectPointEditorTab uses single unified provider"
```

---

### Task 8: Update EffectPointEditorState

**Files:**
- Modify: `src/lib/features/effects-lab/state/effect-point-editor-state.svelte.ts`

Remove references to effect-specific intensity methods from the descriptor. The `importJSON` validation no longer checks for effect-specific properties.

- [ ] **Step 1: Update `importJSON` validation**

In `importJSON()` (line ~205), remove the intensity validation block:
```typescript
const intensity = this.descriptor.getIntensity(p);
if (typeof intensity !== "number" || isNaN(intensity)) {
    return `Invalid point: each point needs a valid ${this.descriptor.intensityLabel} (number)`;
}
```

The validation just needs `dx` and `dy` — that check already exists above this block.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/effects-lab/state/effect-point-editor-state.svelte.ts
git commit -m "refactor: EffectPointEditorState drops per-point intensity"
```

---

### Task 9: Update EffectPointListPanel (remove intensity sliders + copy-from)

**Files:**
- Modify: `src/lib/features/effects-lab/components/EffectPointListPanel.svelte`

Remove per-point intensity sliders, the "Copy From" dropdown, and the `handleIntensityChange` function. Each point now shows only `dx`, `dy` coordinates and action buttons.

- [ ] **Step 1: Remove `copySourceProviders` from Props**

In the Props interface (line ~21-25), remove the `copySourceProviders` field:
```typescript
interface Props {
    editorState: EffectPointEditorState;
    descriptor: EffectDescriptor;
}
```
And update the destructuring (line ~27) to remove it.

Also remove the `CopySource` type import and `showCopyMenu` state variable.

- [ ] **Step 2: Remove `handleIntensityChange` function**

Delete the function at lines ~69-74:
```typescript
function handleIntensityChange(index: number, value: number) {
    const point = editorState.points[index];
    if (!point) return;
    descriptor.setIntensity(point, value);
    editorState.updatePoint(index, point);
}
```

- [ ] **Step 3: Remove intensity slider block from template**

Delete the entire intensity slider block per-point (lines ~177-194), which contains:
- The `<label>` with `descriptor.intensityLabel`
- The `<input type="range">` with `descriptor.intensityRange`, `descriptor.intensityStep`, `descriptor.getIntensity(point)`
- The `<span>` showing `descriptor.getIntensity(point).toFixed(1)`

- [ ] **Step 4: Remove "Copy From" UI block**

Delete the `{#if copySourceProviders.length > 0}` block (lines ~254-280) containing the copy-from button and dropdown menu.

- [ ] **Step 5: Update import placeholder**

At line ~288, replace the import placeholder that references `descriptor.intensityLabel` and `descriptor.intensityDefault`:
```
placeholder={'{"points": [{"dx": 0, "dy": 0}]}'}
```

- [ ] **Step 6: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/effects-lab/components/EffectPointListPanel.svelte
git commit -m "refactor: remove per-point intensity sliders and copy-from UI"
```

---

### Task 10: Update EffectPointSvgCanvas (remove intensity references)

**Files:**
- Modify: `src/lib/features/effects-lab/components/EffectPointSvgCanvas.svelte`

This file uses `descriptor.getIntensity()` for circle radius sizing and `descriptor.intensityLabel` in aria-labels. Both must be replaced since the `EffectDescriptor` interface no longer has these methods.

- [ ] **Step 1: Update `pointRadius` function**

At line ~315, replace:
```typescript
function pointRadius(point: { dx: number; dy: number }): number {
    return Math.max(POINT_MIN_RADIUS, Math.min(POINT_MAX_RADIUS, descriptor.getIntensity(point as any) * 12));
}
```
With:
```typescript
function pointRadius(_point: { dx: number; dy: number }): number {
    return (POINT_MIN_RADIUS + POINT_MAX_RADIUS) / 2;
}
```

All points are now equal size since there's no per-point intensity.

- [ ] **Step 2: Update aria-label**

At line ~387, replace:
```svelte
aria-label="Point {i + 1}: dx={point.dx}, dy={point.dy}, {descriptor.intensityLabel}={descriptor.getIntensity(point)}"
```
With:
```svelte
aria-label="Point {i + 1}: dx={point.dx}, dy={point.dy}"
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/effects-lab/components/EffectPointSvgCanvas.svelte
git commit -m "refactor: remove intensity references from EffectPointSvgCanvas"
```

---

## Chunk 3: Cleanup + Delete Old Files

### Task 11: Delete old provider files (renumbered from 10)

**Files:**
- Delete: `src/lib/features/effects-lab/services/implementations/FirePointOverrideProvider.ts`
- Delete: `src/lib/features/effects-lab/services/implementations/LedPointOverrideProvider.ts`
- Delete: `src/lib/features/effects-lab/services/implementations/TrailPointOverrideProvider.ts`

- [ ] **Step 1: Delete the three old provider files**

```bash
git rm src/lib/features/effects-lab/services/implementations/FirePointOverrideProvider.ts
git rm src/lib/features/effects-lab/services/implementations/LedPointOverrideProvider.ts
git rm src/lib/features/effects-lab/services/implementations/TrailPointOverrideProvider.ts
```

- [ ] **Step 2: Verify no remaining imports**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Fix any remaining imports that reference these deleted files.

- [ ] **Step 3: Commit**

```bash
git commit -m "cleanup: delete old per-effect override providers"
```

---

### Task 12: Delete old tip point definition files

**Files:**
- Delete: `src/lib/shared/animation-engine/domain/types/PropFirePoints.ts`
- Delete: `src/lib/shared/animation-engine/domain/types/PropLedPoints.ts`
- Delete: `src/lib/shared/animation-engine/domain/types/PropTrailPoints.ts`

- [ ] **Step 1: Search for remaining imports**

Run: `grep -r "PropFirePoints\|PropLedPoints\|PropTrailPoints" src/ --include="*.ts" --include="*.svelte" -l`

Fix any files that still import from these (the `FireDefaultsLoader`, `FireDefaultsPublisher`, and their contracts reference `PropFirePointConfig` / `FirePoint` types — these need updating).

- [ ] **Step 2: Update FireDefaultsLoader**

In `FireDefaultsLoader.ts`, update the type imports:
- Replace `import type { PropFirePointConfig, FirePoint } from "../../domain/types/PropFirePoints"` with `import type { PropTipConfig, TipPoint } from "../../domain/types/PropTipPoints"`
- Update internal type references: `PropFirePointConfig` → `PropTipConfig`, `FirePoint` → `TipPoint`
- The `parseFirePointConfig` and `isValidFirePoint` methods still parse Firestore data that has `flameScale` — keep parsing it but strip it when returning. The returned type changes to `PropTipConfig`.
- Note: `getAllFirePoints()` return type changes to `Record<string, PropTipConfig>`. Update the contract `IFireDefaultsLoader` to match.

- [ ] **Step 3: Update FireDefaultsPublisher**

In `FireDefaultsPublisher.ts`, update:
- Replace `import type { PropFirePointConfig } from "../../domain/types/PropFirePoints"` with `import type { PropTipConfig } from "../../domain/types/PropTipPoints"`
- Update `publish()` parameter type
- Update contract `IFireDefaultsPublisher` to match

- [ ] **Step 4: Update IFireDefaultsLoader and IFireDefaultsPublisher contracts**

Update the import paths and type references in:
- `src/lib/shared/animation-engine/services/contracts/IFireDefaultsLoader.ts`
- `src/lib/shared/animation-engine/services/contracts/IFireDefaultsPublisher.ts`

- [ ] **Step 5: Delete the three old definition files**

```bash
git rm src/lib/shared/animation-engine/domain/types/PropFirePoints.ts
git rm src/lib/shared/animation-engine/domain/types/PropLedPoints.ts
git rm src/lib/shared/animation-engine/domain/types/PropTrailPoints.ts
```

- [ ] **Step 6: Verify full compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -40`
Expected: Clean compilation

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "cleanup: delete old per-effect tip point definitions, update defaults loader/publisher"
```

---

### Task 13: Final verification

- [ ] **Step 1: Full TypeScript check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 2: Build check**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All existing tests pass (none of the test files directly test tip point definitions)

- [ ] **Step 4: Commit any remaining fixes**

If any errors surfaced, fix and commit.
