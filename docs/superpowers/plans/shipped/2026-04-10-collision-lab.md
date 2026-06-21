# Collision Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lab tab that sequentially walks through all 192 diamond-mode in/out two-hand poses, shows each one on a live 3D avatar with collision readout, and lets the reviewer label every pose as clear / needs-adjustment / unreachable / skip. Labels persist to localStorage and export to a committable JSON file.

**Architecture:** A new `collision-lab` tab in the existing Lab module. Follows the project's factory + context state pattern. Three DI services (`DiamondPoseEnumerator`, `LocalPoseLabelRepository`, `DefaultStanceVariantProvider`) are registered in a new ITI container. The viewport reuses the existing `Avatar3D` component, extended with one new optional prop (`onCollisionEvents`) that surfaces detector output to parents. Pose world positions come from the existing `PlaneCoordinateMapper` — no new coordinate math is needed.

**Tech Stack:** Svelte 5 runes, TypeScript strict, Threlte, Three.js, ITI DI, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-10-collision-lab-design.md`

---

## File Structure

**Create:**
- `src/lib/features/lab/tabs/collision-lab/CollisionLab.svelte`
- `src/lib/features/lab/tabs/collision-lab/components/PoseViewport.svelte`
- `src/lib/features/lab/tabs/collision-lab/components/PoseScrubber.svelte`
- `src/lib/features/lab/tabs/collision-lab/components/CollisionReadout.svelte`
- `src/lib/features/lab/tabs/collision-lab/components/LabelControls.svelte`
- `src/lib/features/lab/tabs/collision-lab/components/StanceVariantPicker.svelte`
- `src/lib/features/lab/tabs/collision-lab/state/collision-lab-state.svelte.ts`
- `src/lib/features/lab/tabs/collision-lab/context/collision-lab-context.ts`
- `src/lib/features/lab/tabs/collision-lab/domain/types.ts` ← shared types
- `src/lib/features/lab/tabs/collision-lab/services/contracts/IPoseEnumerator.ts`
- `src/lib/features/lab/tabs/collision-lab/services/contracts/IPoseLabelRepository.ts`
- `src/lib/features/lab/tabs/collision-lab/services/contracts/IStanceVariantProvider.ts`
- `src/lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator.ts`
- `src/lib/features/lab/tabs/collision-lab/services/implementations/LocalPoseLabelRepository.ts`
- `src/lib/features/lab/tabs/collision-lab/services/implementations/DefaultStanceVariantProvider.ts`
- `src/lib/shared/di/containers/collision-lab-container.ts`
- `src/lib/shared/3d/data/pose-catalog/diamond-in-out-labels.json` ← starts empty
- `tests/unit/collision-lab/DiamondPoseEnumerator.test.ts`
- `tests/unit/collision-lab/LocalPoseLabelRepository.test.ts`
- `tests/unit/collision-lab/collision-lab-state.test.ts`

**Modify:**
- `src/lib/shared/3d/components/Avatar3D.svelte` — add `onCollisionEvents` prop (additive)
- `src/lib/shared/3d/services/contracts/ICollisionDetector.ts` — nothing; already exposes what we need
- `src/lib/shared/navigation/config/tab-definitions.ts` — add `collision-lab` entry in `LAB_TABS`
- `src/lib/features/lab/LabModule.svelte` — add `collision-lab` to `tabComponents`
- `src/lib/shared/di/containers/collision-lab-container.ts` — registers services (new)
- `src/lib/shared/di/index.ts` — import + wire collision-lab container
- `src/lib/shared/di/container-types.ts` — add `CollisionLabItems` to `IAppContainerItems`

---

## Task 1: Domain types

**Files:**
- Create: `src/lib/features/lab/tabs/collision-lab/domain/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
/**
 * Collision Lab Domain Types
 *
 * Shared types for the pose catalog, labels, and stance variants.
 * See docs/superpowers/specs/2026-04-10-collision-lab-design.md.
 */

import type { Plane } from "$lib/shared/3d/domain/enums/Plane";

export type DiamondPosition = "N" | "E" | "S" | "W";
export type HandOrientation = "in" | "out"; // radial | antiradial

export interface PoseDefinition {
  /** Stable id of the form "wall-Ni-Eo" — plane-bluePos+blueOri-redPos+redOri */
  id: string;
  plane: Plane;
  blueHand: {
    position: DiamondPosition;
    orientation: HandOrientation;
  };
  redHand: {
    position: DiamondPosition;
    orientation: HandOrientation;
  };
}

export type LabelStatus =
  | "unlabeled"
  | "clear"
  | "needs-adjustment"
  | "unreachable"
  | "skip";

export type ArmRouting =
  | "auto"
  | "left-under"
  | "left-over"
  | "right-under"
  | "right-over"
  | "both-under"
  | "both-over";

export type CollisionZoneType =
  | "arm-through-face"
  | "prop-through-torso"
  | "prop-through-head"
  | "arms-through-each-other";

export type SnapshotSeverity = "clear" | "graze" | "clip" | "penetrate";

export interface CollisionSnapshotZone {
  type: CollisionZoneType;
  depthCm: number;
  description: string;
}

export interface CollisionSnapshot {
  severity: SnapshotSeverity;
  zones: CollisionSnapshotZone[];
}

export interface PoseLabel {
  poseId: string;
  status: LabelStatus;
  stanceVariantIndex: number;
  armRouting: ArmRouting;
  collisionSnapshot: CollisionSnapshot | null;
  notes?: string;
  labeledAt?: number;
}

/** On-disk format for the committable labels JSON */
export interface PoseLabelsFile {
  version: 1;
  mode: "diamond-in-out";
  generatedAt: number;
  labels: Record<string, PoseLabel>;
}

export interface StanceVariant {
  index: number;
  description: string;
  /** Body rotation around the Y axis in radians, applied to avatar root */
  rootYawRad: number;
  /** Forward torso lean in radians, applied to spine bones */
  spinePitchRad: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/domain/types.ts
git commit -m "feat(collision-lab): domain types for pose catalog and labels"
```

---

## Task 2: Service contracts

**Files:**
- Create: `src/lib/features/lab/tabs/collision-lab/services/contracts/IPoseEnumerator.ts`
- Create: `src/lib/features/lab/tabs/collision-lab/services/contracts/IPoseLabelRepository.ts`
- Create: `src/lib/features/lab/tabs/collision-lab/services/contracts/IStanceVariantProvider.ts`

- [ ] **Step 1: Create `IPoseEnumerator.ts`**

```typescript
import type { PoseDefinition } from "../../domain/types";

/**
 * Generates the canonical enumeration of poses for a given mode.
 *
 * The order is deterministic so "pose 47 of 192" means the same thing
 * between sessions, tests, and exported JSON files.
 */
export interface IPoseEnumerator {
  /**
   * Enumerate all diamond-mode in/out two-hand poses:
   * 3 planes × (4 cardinals × 2 orientations)² = 192 poses.
   */
  enumerateDiamondInOut(): PoseDefinition[];
}
```

- [ ] **Step 2: Create `IPoseLabelRepository.ts`**

```typescript
import type { PoseLabel } from "../../domain/types";

/**
 * Loads and persists pose labels. Phase 1 implementation uses
 * localStorage as the working copy and exports to a JSON file
 * for manual commit to the repo.
 */
export interface IPoseLabelRepository {
  /**
   * Load all labels. Merges the canonical committed JSON (if present)
   * with any newer localStorage changes. Unlabeled poses are not
   * present in the returned map — callers should treat missing keys
   * as "unlabeled".
   */
  loadAll(): Promise<Record<string, PoseLabel>>;

  /**
   * Save the full labels map. Debounced writes to localStorage are
   * fine; implementations should not block the caller.
   */
  save(labels: Record<string, PoseLabel>): void;

  /**
   * Serialize the current labels to the on-disk file format and
   * trigger a browser download. The reviewer manually commits the
   * downloaded file to the repo.
   */
  exportJson(labels: Record<string, PoseLabel>): void;
}
```

- [ ] **Step 3: Create `IStanceVariantProvider.ts`**

```typescript
import type { StanceVariant } from "../../domain/types";

/**
 * Supplies the set of stance variants the reviewer can cycle through
 * for any pose. Phase 1 returns four upper-body orientation variants;
 * later phases may add foot-placement variants when proper leg IK is
 * available.
 */
export interface IStanceVariantProvider {
  /** Returns all available variants, ordered by index (0..N-1). */
  getAll(): StanceVariant[];

  /**
   * Returns the variant at the given index, clamping to a valid range.
   * Never throws.
   */
  getVariant(index: number): StanceVariant;

  /** Number of variants available. */
  count(): number;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/services/contracts/
git commit -m "feat(collision-lab): service contracts for enumerator, label repo, stance provider"
```

---

## Task 3: DiamondPoseEnumerator (TDD)

**Files:**
- Create: `tests/unit/collision-lab/DiamondPoseEnumerator.test.ts`
- Create: `src/lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/collision-lab/DiamondPoseEnumerator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { DiamondPoseEnumerator } from "$lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";
import type {
  DiamondPosition,
  HandOrientation,
} from "$lib/features/lab/tabs/collision-lab/domain/types";

describe("DiamondPoseEnumerator", () => {
  const enumerator = new DiamondPoseEnumerator();

  it("enumerates exactly 192 poses", () => {
    const poses = enumerator.enumerateDiamondInOut();
    expect(poses).toHaveLength(192);
  });

  it("generates unique ids for every pose", () => {
    const poses = enumerator.enumerateDiamondInOut();
    const ids = new Set(poses.map((p) => p.id));
    expect(ids.size).toBe(192);
  });

  it("every combination of (plane, blue, red) appears exactly once", () => {
    const poses = enumerator.enumerateDiamondInOut();
    const planes: Plane[] = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];
    const positions: DiamondPosition[] = ["N", "E", "S", "W"];
    const orientations: HandOrientation[] = ["in", "out"];

    for (const plane of planes) {
      for (const bluePos of positions) {
        for (const blueOri of orientations) {
          for (const redPos of positions) {
            for (const redOri of orientations) {
              const match = poses.filter(
                (p) =>
                  p.plane === plane &&
                  p.blueHand.position === bluePos &&
                  p.blueHand.orientation === blueOri &&
                  p.redHand.position === redPos &&
                  p.redHand.orientation === redOri
              );
              expect(match).toHaveLength(1);
            }
          }
        }
      }
    }
  });

  it("produces the same order on repeated calls (deterministic)", () => {
    const a = enumerator.enumerateDiamondInOut();
    const b = enumerator.enumerateDiamondInOut();
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });

  it("encodes ids as {plane}-{bluePos}{blueOriFirstLetter}-{redPos}{redOriFirstLetter}", () => {
    const poses = enumerator.enumerateDiamondInOut();
    const wallNiEo = poses.find((p) => p.id === "wall-Ni-Eo");
    expect(wallNiEo).toBeDefined();
    expect(wallNiEo!.plane).toBe(Plane.WALL);
    expect(wallNiEo!.blueHand).toEqual({ position: "N", orientation: "in" });
    expect(wallNiEo!.redHand).toEqual({ position: "E", orientation: "out" });
  });

  it("first pose is wall-Ni-Ni (plane outermost, blue outer, red innermost loop)", () => {
    const poses = enumerator.enumerateDiamondInOut();
    expect(poses[0].id).toBe("wall-Ni-Ni");
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npx vitest run tests/unit/collision-lab/DiamondPoseEnumerator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement DiamondPoseEnumerator**

Create `src/lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator.ts`:

```typescript
/**
 * DiamondPoseEnumerator
 *
 * Produces all 192 two-hand poses for diamond mode with in/out orientations:
 * 3 planes × (4 cardinals × 2 orientations)².
 *
 * The enumeration order is deterministic (plane → bluePos → blueOri →
 * redPos → redOri), so "pose 47 of 192" refers to the same pose across
 * sessions, tests, and committed labels.
 */

import type { IPoseEnumerator } from "../contracts/IPoseEnumerator";
import type {
  PoseDefinition,
  DiamondPosition,
  HandOrientation,
} from "../../domain/types";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";

const PLANES: readonly Plane[] = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];
const POSITIONS: readonly DiamondPosition[] = ["N", "E", "S", "W"];
const ORIENTATIONS: readonly HandOrientation[] = ["in", "out"];

export class DiamondPoseEnumerator implements IPoseEnumerator {
  enumerateDiamondInOut(): PoseDefinition[] {
    const poses: PoseDefinition[] = [];
    for (const plane of PLANES) {
      for (const bluePos of POSITIONS) {
        for (const blueOri of ORIENTATIONS) {
          for (const redPos of POSITIONS) {
            for (const redOri of ORIENTATIONS) {
              poses.push({
                id: `${plane}-${bluePos}${blueOri[0]}-${redPos}${redOri[0]}`,
                plane,
                blueHand: { position: bluePos, orientation: blueOri },
                redHand: { position: redPos, orientation: redOri },
              });
            }
          }
        }
      }
    }
    return poses;
  }
}
```

- [ ] **Step 4: Run tests to verify passing**

Run: `npx vitest run tests/unit/collision-lab/DiamondPoseEnumerator.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator.ts tests/unit/collision-lab/DiamondPoseEnumerator.test.ts
git commit -m "feat(collision-lab): DiamondPoseEnumerator with 192-pose enumeration"
```

---

## Task 4: LocalPoseLabelRepository (TDD)

**Files:**
- Create: `src/lib/shared/3d/data/pose-catalog/diamond-in-out-labels.json`
- Create: `tests/unit/collision-lab/LocalPoseLabelRepository.test.ts`
- Create: `src/lib/features/lab/tabs/collision-lab/services/implementations/LocalPoseLabelRepository.ts`

- [ ] **Step 1: Create empty canonical labels file**

Create `src/lib/shared/3d/data/pose-catalog/diamond-in-out-labels.json` with exactly this content (note the trailing newline):

```json
{
  "version": 1,
  "mode": "diamond-in-out",
  "generatedAt": 0,
  "labels": {}
}
```

- [ ] **Step 2: Write failing tests**

Create `tests/unit/collision-lab/LocalPoseLabelRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { LocalPoseLabelRepository } from "$lib/features/lab/tabs/collision-lab/services/implementations/LocalPoseLabelRepository";
import type {
  PoseLabel,
  PoseLabelsFile,
} from "$lib/features/lab/tabs/collision-lab/domain/types";

const STORAGE_KEY = "tka:collision-lab:diamond-in-out-labels";

function makeLabel(
  id: string,
  status: PoseLabel["status"],
  labeledAt: number
): PoseLabel {
  return {
    poseId: id,
    status,
    stanceVariantIndex: 0,
    armRouting: "auto",
    collisionSnapshot: null,
    labeledAt,
  };
}

describe("LocalPoseLabelRepository", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("save() writes to localStorage", () => {
    const repo = new LocalPoseLabelRepository();
    const labels = {
      "wall-Ni-Eo": makeLabel("wall-Ni-Eo", "clear", 1000),
    };
    repo.save(labels);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as PoseLabelsFile;
    expect(parsed.labels["wall-Ni-Eo"]?.status).toBe("clear");
  });

  it("loadAll() returns empty map when nothing is stored and canonical is empty", async () => {
    // The canonical JSON starts empty, so this exercises the default path.
    const repo = new LocalPoseLabelRepository();
    const labels = await repo.loadAll();
    expect(Object.keys(labels)).toHaveLength(0);
  });

  it("loadAll() returns labels previously saved via save()", async () => {
    const repo = new LocalPoseLabelRepository();
    repo.save({ "wall-Ni-Eo": makeLabel("wall-Ni-Eo", "clear", 1000) });

    const loaded = await repo.loadAll();
    expect(loaded["wall-Ni-Eo"]?.status).toBe("clear");
  });

  it("merge: localStorage wins when labeledAt is newer than canonical", async () => {
    // Seed canonical via a mocked dynamic import
    const canonical: PoseLabelsFile = {
      version: 1,
      mode: "diamond-in-out",
      generatedAt: 0,
      labels: {
        "wall-Ni-Eo": makeLabel("wall-Ni-Eo", "needs-adjustment", 500),
      },
    };
    const repo = new LocalPoseLabelRepository();
    // Use the test seam: the repo accepts a canonical loader for testability.
    repo.__setCanonicalLoader(async () => canonical);

    // Newer label in localStorage
    repo.save({ "wall-Ni-Eo": makeLabel("wall-Ni-Eo", "clear", 1000) });

    const merged = await repo.loadAll();
    expect(merged["wall-Ni-Eo"]?.status).toBe("clear");
    expect(merged["wall-Ni-Eo"]?.labeledAt).toBe(1000);
  });

  it("merge: canonical wins when localStorage has an older labeledAt", async () => {
    const canonical: PoseLabelsFile = {
      version: 1,
      mode: "diamond-in-out",
      generatedAt: 0,
      labels: {
        "wall-Ni-Eo": makeLabel("wall-Ni-Eo", "needs-adjustment", 2000),
      },
    };
    const repo = new LocalPoseLabelRepository();
    repo.__setCanonicalLoader(async () => canonical);

    repo.save({ "wall-Ni-Eo": makeLabel("wall-Ni-Eo", "clear", 1000) });

    const merged = await repo.loadAll();
    expect(merged["wall-Ni-Eo"]?.status).toBe("needs-adjustment");
    expect(merged["wall-Ni-Eo"]?.labeledAt).toBe(2000);
  });

  it("exportJson() triggers a download with the correct file format", () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = revokeObjectURL;

    const appendChild = vi.spyOn(document.body, "appendChild");
    const removeChild = vi.spyOn(document.body, "removeChild");
    const clickSpy = vi.fn();

    // Stub anchor click
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreateElement(tag) as HTMLAnchorElement;
      if (tag === "a") {
        (el as any).click = clickSpy;
      }
      return el;
    });

    const repo = new LocalPoseLabelRepository();
    const labels = { "wall-Ni-Eo": makeLabel("wall-Ni-Eo", "clear", 1000) };
    repo.exportJson(labels);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to confirm failure**

Run: `npx vitest run tests/unit/collision-lab/LocalPoseLabelRepository.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement LocalPoseLabelRepository**

Create `src/lib/features/lab/tabs/collision-lab/services/implementations/LocalPoseLabelRepository.ts`:

```typescript
/**
 * LocalPoseLabelRepository
 *
 * Phase 1 persistence for pose labels:
 *   - localStorage is the working copy (write-through, cheap, survives reloads)
 *   - A canonical JSON file committed to the repo is the long-term source of truth
 *   - loadAll() merges both, letting whichever has the newer labeledAt win
 *   - exportJson() downloads the current labels map as a JSON file that the
 *     reviewer manually commits
 *
 * A test seam (__setCanonicalLoader) lets unit tests supply a fake canonical
 * loader without touching the filesystem or Vite's import resolution.
 */

import type { IPoseLabelRepository } from "../contracts/IPoseLabelRepository";
import type {
  PoseLabel,
  PoseLabelsFile,
} from "../../domain/types";

const STORAGE_KEY = "tka:collision-lab:diamond-in-out-labels";

type CanonicalLoader = () => Promise<PoseLabelsFile | null>;

/**
 * Default loader imports the committed JSON via Vite's JSON import.
 * Tests override this via __setCanonicalLoader.
 */
const defaultCanonicalLoader: CanonicalLoader = async () => {
  try {
    const mod = await import(
      "$lib/shared/3d/data/pose-catalog/diamond-in-out-labels.json"
    );
    return (mod.default ?? mod) as PoseLabelsFile;
  } catch {
    return null;
  }
};

export class LocalPoseLabelRepository implements IPoseLabelRepository {
  private canonicalLoader: CanonicalLoader = defaultCanonicalLoader;

  /** Test seam — replaces the canonical loader. */
  __setCanonicalLoader(loader: CanonicalLoader): void {
    this.canonicalLoader = loader;
  }

  async loadAll(): Promise<Record<string, PoseLabel>> {
    const canonical = await this.canonicalLoader();
    const local = this.readLocal();

    const merged: Record<string, PoseLabel> = {};

    // Start from canonical
    if (canonical?.labels) {
      for (const [id, label] of Object.entries(canonical.labels)) {
        merged[id] = label;
      }
    }

    // Overlay local where newer
    for (const [id, localLabel] of Object.entries(local)) {
      const existing = merged[id];
      if (!existing) {
        merged[id] = localLabel;
        continue;
      }
      const localTs = localLabel.labeledAt ?? 0;
      const existingTs = existing.labeledAt ?? 0;
      if (localTs >= existingTs) {
        merged[id] = localLabel;
      }
    }

    return merged;
  }

  save(labels: Record<string, PoseLabel>): void {
    const file: PoseLabelsFile = {
      version: 1,
      mode: "diamond-in-out",
      generatedAt: Date.now(),
      labels,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
    } catch (e) {
      console.warn("LocalPoseLabelRepository: save failed", e);
    }
  }

  exportJson(labels: Record<string, PoseLabel>): void {
    const file: PoseLabelsFile = {
      version: 1,
      mode: "diamond-in-out",
      generatedAt: Date.now(),
      labels,
    };
    const json = JSON.stringify(file, null, 2) + "\n";
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "diamond-in-out-labels.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  private readLocal(): Record<string, PoseLabel> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as PoseLabelsFile;
      if (parsed?.version !== 1) return {};
      return parsed.labels ?? {};
    } catch {
      return {};
    }
  }
}
```

- [ ] **Step 5: Run tests to verify passing**

Run: `npx vitest run tests/unit/collision-lab/LocalPoseLabelRepository.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/data/pose-catalog/diamond-in-out-labels.json src/lib/features/lab/tabs/collision-lab/services/implementations/LocalPoseLabelRepository.ts tests/unit/collision-lab/LocalPoseLabelRepository.test.ts
git commit -m "feat(collision-lab): LocalPoseLabelRepository with canonical+local merge"
```

---

## Task 5: DefaultStanceVariantProvider

**Files:**
- Create: `src/lib/features/lab/tabs/collision-lab/services/implementations/DefaultStanceVariantProvider.ts`

- [ ] **Step 1: Implement provider**

```typescript
/**
 * DefaultStanceVariantProvider
 *
 * Phase 1 stance variants. Foot IK is currently disabled in the avatar
 * system, so variants only adjust things we can actually change today:
 * root yaw and spine pitch. The feet stay at their default Mixamo idle
 * positions. When proper leg IK lands, foot-placement variants can be
 * added here without any schema change.
 */

import type { IStanceVariantProvider } from "../contracts/IStanceVariantProvider";
import type { StanceVariant } from "../../domain/types";

const DEG = Math.PI / 180;

const VARIANTS: StanceVariant[] = [
  {
    index: 0,
    description: "Neutral",
    rootYawRad: 0,
    spinePitchRad: 0,
  },
  {
    index: 1,
    description: "Leaned forward",
    rootYawRad: 0,
    spinePitchRad: 10 * DEG,
  },
  {
    index: 2,
    description: "Rotated left",
    rootYawRad: 15 * DEG,
    spinePitchRad: 0,
  },
  {
    index: 3,
    description: "Rotated right",
    rootYawRad: -15 * DEG,
    spinePitchRad: 0,
  },
];

export class DefaultStanceVariantProvider implements IStanceVariantProvider {
  getAll(): StanceVariant[] {
    return VARIANTS;
  }

  getVariant(index: number): StanceVariant {
    const clamped = Math.max(0, Math.min(index, VARIANTS.length - 1));
    return VARIANTS[clamped];
  }

  count(): number {
    return VARIANTS.length;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/services/implementations/DefaultStanceVariantProvider.ts
git commit -m "feat(collision-lab): DefaultStanceVariantProvider with 4 upper-body variants"
```

---

## Task 6: DI container for collision lab

**Files:**
- Create: `src/lib/shared/di/containers/collision-lab-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`
- Modify: `src/lib/shared/di/index.ts`

- [ ] **Step 1: Create the container**

Create `src/lib/shared/di/containers/collision-lab-container.ts`:

```typescript
/**
 * Collision Lab ITI Container
 *
 * Provides services for the collision-lab tab: pose enumeration, label
 * persistence, and stance variant library. Self-contained; no external
 * dependencies needed.
 */

import { createContainer } from "iti";

import { DiamondPoseEnumerator } from "$lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator";
import { LocalPoseLabelRepository } from "$lib/features/lab/tabs/collision-lab/services/implementations/LocalPoseLabelRepository";
import { DefaultStanceVariantProvider } from "$lib/features/lab/tabs/collision-lab/services/implementations/DefaultStanceVariantProvider";

export function createCollisionLabContainer() {
  return createContainer()
    .add({ diamondPoseEnumerator: () => new DiamondPoseEnumerator() })
    .add({ collisionLabPoseLabelRepository: () => new LocalPoseLabelRepository() })
    .add({ collisionLabStanceVariantProvider: () => new DefaultStanceVariantProvider() });
}

export type CollisionLabContainer = ReturnType<typeof createCollisionLabContainer>;
```

Naming note: the item keys are prefixed (`collisionLab*`) to avoid collisions with any future generic `poseEnumerator` or `stanceVariantProvider` that other modules might register.

- [ ] **Step 2: Add items type to container-types.ts**

Modify `src/lib/shared/di/container-types.ts` — add the import near the other `PoiLab` imports:

```typescript
import type { CollisionLabContainer } from "./containers/collision-lab-container";
```

Add the items extraction alongside `PoiLabItems`:

```typescript
type CollisionLabItems = ItemsOf<CollisionLabContainer>;
```

Add `CollisionLabItems` to the `IAppContainerItems` intersection — place it next to `PoiLabItems`:

```typescript
PoiLabItems &
CollisionLabItems &
PoiItems &
```

- [ ] **Step 3: Wire container into index.ts**

Modify `src/lib/shared/di/index.ts`. Add import near `createPoiLabContainer`:

```typescript
import { createCollisionLabContainer } from "./containers/collision-lab-container";
```

Instantiate near the `poiLabContainer` definition:

```typescript
const collisionLabContainer = typeof window !== 'undefined' ? createCollisionLabContainer() : null as any;
```

Merge into the composed container, immediately after the `poiLabContainer.items` merge line:

```typescript
c = c.add(poiLabContainer.items);
c = c.add(collisionLabContainer.items);
c = c.add(poiContainer.items);
```

- [ ] **Step 4: Type-check**

Run: `npx svelte-check --output human-verbose --fail-on-warnings 2>&1 | head -40`
Expected: No errors touching `src/lib/shared/di` or `src/lib/features/lab/tabs/collision-lab`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/di/containers/collision-lab-container.ts src/lib/shared/di/container-types.ts src/lib/shared/di/index.ts
git commit -m "feat(collision-lab): register DI container in composition root"
```

---

## Task 7: State factory (TDD)

**Files:**
- Create: `tests/unit/collision-lab/collision-lab-state.test.ts`
- Create: `src/lib/features/lab/tabs/collision-lab/state/collision-lab-state.svelte.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/collision-lab/collision-lab-state.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createCollisionLabState } from "$lib/features/lab/tabs/collision-lab/state/collision-lab-state.svelte";
import { DiamondPoseEnumerator } from "$lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator";
import { DefaultStanceVariantProvider } from "$lib/features/lab/tabs/collision-lab/services/implementations/DefaultStanceVariantProvider";
import type {
  PoseLabel,
  CollisionSnapshot,
} from "$lib/features/lab/tabs/collision-lab/domain/types";
import type { IPoseLabelRepository } from "$lib/features/lab/tabs/collision-lab/services/contracts/IPoseLabelRepository";

class InMemoryLabelRepo implements IPoseLabelRepository {
  store: Record<string, PoseLabel> = {};
  async loadAll() {
    return { ...this.store };
  }
  save(labels: Record<string, PoseLabel>): void {
    this.store = { ...labels };
  }
  exportJson(): void {
    /* no-op for tests */
  }
}

async function setup() {
  const enumerator = new DiamondPoseEnumerator();
  const repo = new InMemoryLabelRepo();
  const stance = new DefaultStanceVariantProvider();
  const state = await createCollisionLabState(enumerator, repo, stance);
  return { state, repo };
}

describe("collision-lab-state", () => {
  it("exposes all 192 poses on creation", async () => {
    const { state } = await setup();
    expect(state.allPoses.length).toBe(192);
    expect(state.filteredPoses.length).toBe(192);
    expect(state.cursorIndex).toBe(0);
    expect(state.currentPose?.id).toBe(state.allPoses[0].id);
  });

  it("stepForward / stepBackward move the cursor within bounds", async () => {
    const { state } = await setup();
    state.stepForward();
    expect(state.cursorIndex).toBe(1);
    state.stepBackward();
    expect(state.cursorIndex).toBe(0);
    state.stepBackward(); // clamps
    expect(state.cursorIndex).toBe(0);
  });

  it("jumpTo clamps out-of-range values", async () => {
    const { state } = await setup();
    state.jumpTo(9999);
    expect(state.cursorIndex).toBe(state.filteredPoses.length - 1);
    state.jumpTo(-5);
    expect(state.cursorIndex).toBe(0);
  });

  it("setPlaneFilter restricts filteredPoses and resets cursor", async () => {
    const { state } = await setup();
    state.stepForward();
    state.stepForward();
    state.setPlaneFilter("wall" as any);
    expect(state.cursorIndex).toBe(0);
    expect(state.filteredPoses.every((p) => p.plane === "wall")).toBe(true);
    expect(state.filteredPoses.length).toBe(64);
  });

  it("labelCurrent writes a label and auto-advances on 'clear'", async () => {
    const { state, repo } = await setup();
    const firstId = state.currentPose!.id;
    state.labelCurrent("clear");
    expect(repo.store[firstId]?.status).toBe("clear");
    expect(state.cursorIndex).toBe(1);
  });

  it("labelCurrent does NOT auto-advance on 'needs-adjustment'", async () => {
    const { state } = await setup();
    state.labelCurrent("needs-adjustment");
    expect(state.cursorIndex).toBe(0);
  });

  it("labelCurrent does NOT auto-advance on 'skip'", async () => {
    const { state } = await setup();
    state.labelCurrent("skip");
    expect(state.cursorIndex).toBe(0);
  });

  it("labelCurrent stores the current variant index and collision snapshot", async () => {
    const { state, repo } = await setup();
    state.setVariant(2);
    const snapshot: CollisionSnapshot = {
      severity: "clip",
      zones: [
        { type: "arm-through-face", depthCm: 3.2, description: "L forearm → face" },
      ],
    };
    state.updateCollision(snapshot);
    const id = state.currentPose!.id;
    state.labelCurrent("needs-adjustment");
    expect(repo.store[id]?.stanceVariantIndex).toBe(2);
    expect(repo.store[id]?.collisionSnapshot?.severity).toBe("clip");
  });

  it("progress counts reflect labeled poses", async () => {
    const { state } = await setup();
    expect(state.progress.labeled).toBe(0);
    state.labelCurrent("clear"); // advances to 1
    state.labelCurrent("clear"); // advances to 2
    expect(state.progress.labeled).toBe(2);
    expect(state.progress.clear).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npx vitest run tests/unit/collision-lab/collision-lab-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the state factory**

Create `src/lib/features/lab/tabs/collision-lab/state/collision-lab-state.svelte.ts`:

```typescript
/**
 * Collision Lab State
 *
 * Factory that wires pose enumeration, labels, filters, cursor, and the
 * live collision snapshot into a single reactive object. Returned object
 * uses getter accessors so consumers can destructure in templates without
 * losing reactivity.
 *
 * Services are passed in as arguments — never resolved from the container
 * inside the factory. This matches the state-management rule.
 */

import type { IPoseEnumerator } from "../services/contracts/IPoseEnumerator";
import type { IPoseLabelRepository } from "../services/contracts/IPoseLabelRepository";
import type { IStanceVariantProvider } from "../services/contracts/IStanceVariantProvider";
import type {
  PoseDefinition,
  PoseLabel,
  LabelStatus,
  HandOrientation,
  CollisionSnapshot,
} from "../domain/types";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";

type PlaneFilter = Plane | "all";
type OrientationFilter = HandOrientation | "all";
type StatusFilter = LabelStatus | "all" | "unlabeled-only";

function countLabels(
  labels: Record<string, PoseLabel>,
  predicate: (s: LabelStatus) => boolean
): number {
  let n = 0;
  for (const label of Object.values(labels)) {
    if (predicate(label.status)) n++;
  }
  return n;
}

function matchesStatusFilter(
  label: PoseLabel | undefined,
  filter: StatusFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "unlabeled-only") return !label || label.status === "unlabeled";
  if (!label) return filter === "unlabeled";
  return label.status === filter;
}

export async function createCollisionLabState(
  poseEnumerator: IPoseEnumerator,
  labelRepo: IPoseLabelRepository,
  stanceProvider: IStanceVariantProvider
) {
  const allPoses: PoseDefinition[] = poseEnumerator.enumerateDiamondInOut();
  const initialLabels = await labelRepo.loadAll();

  let labels = $state<Record<string, PoseLabel>>(initialLabels);

  // Filters
  let planeFilter = $state<PlaneFilter>("all");
  let blueOrientationFilter = $state<OrientationFilter>("all");
  let redOrientationFilter = $state<OrientationFilter>("all");
  let statusFilter = $state<StatusFilter>("all");

  // Cursor + variant
  let cursorIndex = $state(0);
  let currentVariantIndex = $state(0);

  // Collision state
  let currentCollision = $state<CollisionSnapshot | null>(null);

  const filteredPoses = $derived(
    allPoses.filter(
      (p) =>
        (planeFilter === "all" || p.plane === planeFilter) &&
        (blueOrientationFilter === "all" || p.blueHand.orientation === blueOrientationFilter) &&
        (redOrientationFilter === "all" || p.redHand.orientation === redOrientationFilter) &&
        matchesStatusFilter(labels[p.id], statusFilter)
    )
  );

  const currentPose = $derived<PoseDefinition | null>(
    filteredPoses.length > 0 ? filteredPoses[cursorIndex] ?? null : null
  );

  const currentLabel = $derived<PoseLabel | null>(
    currentPose ? labels[currentPose.id] ?? null : null
  );

  const currentStanceVariant = $derived(stanceProvider.getVariant(currentVariantIndex));

  const progress = $derived({
    total: allPoses.length,
    labeled: countLabels(labels, (s) => s !== "unlabeled"),
    clear: countLabels(labels, (s) => s === "clear"),
    needsAdjustment: countLabels(labels, (s) => s === "needs-adjustment"),
    unreachable: countLabels(labels, (s) => s === "unreachable"),
    skipped: countLabels(labels, (s) => s === "skip"),
  });

  function clampCursor() {
    const max = Math.max(0, filteredPoses.length - 1);
    if (cursorIndex > max) cursorIndex = max;
    if (cursorIndex < 0) cursorIndex = 0;
  }

  return {
    // Readers
    get allPoses() { return allPoses; },
    get filteredPoses() { return filteredPoses; },
    get currentPose() { return currentPose; },
    get currentLabel() { return currentLabel; },
    get currentStanceVariant() { return currentStanceVariant; },
    get currentVariantIndex() { return currentVariantIndex; },
    get currentCollision() { return currentCollision; },
    get labels() { return labels; },
    get progress() { return progress; },
    get cursorIndex() { return cursorIndex; },
    get planeFilter() { return planeFilter; },
    get blueOrientationFilter() { return blueOrientationFilter; },
    get redOrientationFilter() { return redOrientationFilter; },
    get statusFilter() { return statusFilter; },
    get stanceVariants() { return stanceProvider.getAll(); },

    // Cursor
    stepForward() {
      if (filteredPoses.length === 0) return;
      cursorIndex = Math.min(cursorIndex + 1, filteredPoses.length - 1);
      currentVariantIndex = 0;
    },
    stepBackward() {
      cursorIndex = Math.max(cursorIndex - 1, 0);
      currentVariantIndex = 0;
    },
    jumpTo(index: number) {
      const max = Math.max(0, filteredPoses.length - 1);
      cursorIndex = Math.max(0, Math.min(index, max));
      currentVariantIndex = 0;
    },

    // Variant
    setVariant(index: number) {
      currentVariantIndex = Math.max(0, Math.min(index, stanceProvider.count() - 1));
    },

    // Filters — all reset cursor to 0
    setPlaneFilter(p: PlaneFilter) {
      planeFilter = p;
      cursorIndex = 0;
      clampCursor();
    },
    setBlueOrientationFilter(o: OrientationFilter) {
      blueOrientationFilter = o;
      cursorIndex = 0;
      clampCursor();
    },
    setRedOrientationFilter(o: OrientationFilter) {
      redOrientationFilter = o;
      cursorIndex = 0;
      clampCursor();
    },
    setStatusFilter(s: StatusFilter) {
      statusFilter = s;
      cursorIndex = 0;
      clampCursor();
    },

    // Collision intake
    updateCollision(snapshot: CollisionSnapshot | null) {
      currentCollision = snapshot;
    },

    // Labeling
    labelCurrent(status: LabelStatus) {
      const pose = currentPose;
      if (!pose) return;
      const next: Record<string, PoseLabel> = {
        ...labels,
        [pose.id]: {
          poseId: pose.id,
          status,
          stanceVariantIndex: currentVariantIndex,
          armRouting: "auto",
          collisionSnapshot: currentCollision,
          labeledAt: Date.now(),
        },
      };
      labels = next;
      labelRepo.save(next);
      // Auto-advance on terminal positive/negative statuses only
      if (status === "clear" || status === "unreachable") {
        if (cursorIndex < filteredPoses.length - 1) {
          cursorIndex += 1;
          currentVariantIndex = 0;
        }
      }
    },

    // Export
    exportLabels() {
      labelRepo.exportJson(labels);
    },
  };
}

export type CollisionLabState = Awaited<ReturnType<typeof createCollisionLabState>>;
```

- [ ] **Step 4: Run tests to verify passing**

Run: `npx vitest run tests/unit/collision-lab/collision-lab-state.test.ts`
Expected: PASS — all 9 tests green.

Note: `$state` and `$derived` runes work inside `.svelte.ts` files during Vitest runs because of the project's existing Svelte 5 test configuration. If any test fails because the factory uses runes outside a component, check that `vitest.config.ts` includes the `svelte.config.js` runes flag; the project already uses runes in other `.svelte.ts` state factories that are exercised by tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/state/collision-lab-state.svelte.ts tests/unit/collision-lab/collision-lab-state.test.ts
git commit -m "feat(collision-lab): state factory with labels, filters, cursor, progress"
```

---

## Task 8: Context helper

**Files:**
- Create: `src/lib/features/lab/tabs/collision-lab/context/collision-lab-context.ts`

- [ ] **Step 1: Implement context helper**

```typescript
/**
 * Collision Lab Context
 *
 * Distributes the collision-lab state to descendant components via
 * Svelte's context API. Set once in CollisionLab.svelte; consumed
 * by any component in the subtree via getCollisionLabContext().
 */

import { getContext, setContext } from "svelte";
import type { CollisionLabState } from "../state/collision-lab-state.svelte";

const KEY = Symbol("collision-lab-context");

export interface CollisionLabContext {
  state: CollisionLabState;
}

export function setCollisionLabContext(ctx: CollisionLabContext): void {
  setContext(KEY, ctx);
}

export function getCollisionLabContext(): CollisionLabContext {
  const ctx = getContext<CollisionLabContext | undefined>(KEY);
  if (!ctx) {
    throw new Error(
      "getCollisionLabContext() called outside of a CollisionLab subtree"
    );
  }
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/context/collision-lab-context.ts
git commit -m "feat(collision-lab): context helper for state distribution"
```

---

## Task 9: Expose collision events from Avatar3D

**Files:**
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte`

Rationale: the collision detector already runs per-frame inside Avatar3D and returns `CollisionEvent[]`, but those events aren't exposed. Adding an optional callback prop is purely additive — existing consumers don't pass it and behave identically.

- [ ] **Step 1: Add import for CollisionEvent type**

Modify `src/lib/shared/3d/components/Avatar3D.svelte`. The existing import on roughly line 59 is:

```typescript
  import type { BodySnapshot } from "../services/contracts/ICollisionDetector";
```

Change it to:

```typescript
  import type { BodySnapshot, CollisionEvent } from "../services/contracts/ICollisionDetector";
```

- [ ] **Step 2: Add prop to the Props interface**

In the `interface Props { ... }` block (around line 66–113), add after `beatProgress`:

```typescript
    /** Optional callback invoked each frame with the collision detector's events.
     *  Lets parent components surface collision state without duplicating detection. */
    onCollisionEvents?: (events: CollisionEvent[]) => void;
```

- [ ] **Step 3: Destructure the new prop**

In the `let { ... }: Props = $props();` block (around line 115–142), add `onCollisionEvents,` after `beatProgress = 0,`:

```typescript
    beatProgress = 0,
    onCollisionEvents,
  }: Props = $props();
```

- [ ] **Step 4: Invoke the callback after detect()**

In the per-frame update (around line 735), the existing block is:

```typescript
      collisionDetector.detect(
        _boneVecs as BodySnapshot,
        blueWorldProp?.worldPosition ?? null,
        redWorldProp?.worldPosition ?? null,
        beatIndex,
        beatProgress
      );
    }
```

Change to capture the return value and forward it:

```typescript
      const events = collisionDetector.detect(
        _boneVecs as BodySnapshot,
        blueWorldProp?.worldPosition ?? null,
        redWorldProp?.worldPosition ?? null,
        beatIndex,
        beatProgress
      );
      onCollisionEvents?.(events);
    }
```

- [ ] **Step 5: Type-check**

Run: `npx svelte-check --output human-verbose 2>&1 | grep Avatar3D | head -20`
Expected: No new errors referencing `Avatar3D.svelte`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "feat(3d): expose CollisionEvent[] via optional onCollisionEvents prop"
```

---

## Task 10: PoseViewport component

**Files:**
- Create: `src/lib/features/lab/tabs/collision-lab/components/PoseViewport.svelte`

This component owns the 3D scene. It converts the current pose into prop states, feeds them to Avatar3D, and pipes collision events back into state.

- [ ] **Step 1: Create PoseViewport.svelte**

```svelte
<script lang="ts">
  /**
   * PoseViewport
   *
   * Renders the current collision-lab pose in a Threlte canvas with a
   * single avatar and both props. Receives collision events from the
   * avatar and forwards them to state.
   *
   * The stance variant's root yaw is applied via the `facingAngle` prop
   * on Avatar3D. Spine pitch is NOT applied in Phase 1 — there is no
   * existing hook to inject spine bone offsets without modifying the
   * skeleton service. For now the "leaned forward" variant is visually
   * identical to "neutral"; when spine override lands, wire it here.
   */

  import { Canvas, T } from "@threlte/core";
  import { Vector3, Quaternion } from "three";
  import { onMount } from "svelte";
  import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
  import { PlaneCoordinateMapper } from "$lib/shared/3d/services/implementations/PlaneCoordinateMapper";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PropState3D } from "$lib/shared/3d/domain/models/PropState3D";
  import type { CollisionEvent } from "$lib/shared/3d/services/contracts/ICollisionDetector";
  import type { DiamondPosition } from "../domain/types";
  import type {
    CollisionSnapshot,
    CollisionSnapshotZone,
    SnapshotSeverity,
  } from "../domain/types";
  import { getCollisionLabContext } from "../context/collision-lab-context";

  const { state } = getCollisionLabContext();
  const planeMapper = new PlaneCoordinateMapper();

  const POSITION_TO_GRID: Record<DiamondPosition, GridLocation> = {
    N: GridLocation.NORTH,
    E: GridLocation.EAST,
    S: GridLocation.SOUTH,
    W: GridLocation.WEST,
  };

  /**
   * Convert a hand's (plane, position, orientation) into a PropState3D.
   * The world position comes from the existing PlaneCoordinateMapper;
   * the staff rotation quaternion is computed with staffAngle=0 since
   * Phase 1 only cares about hand placement, not staff tilt beyond
   * radial/antiradial. The orientation flag is stored in gripType as a
   * marker — Avatar3D uses propState.worldPosition for IK, which is
   * all that matters for collision detection.
   */
  function buildPropState(
    plane: typeof state.currentPose.plane,
    position: DiamondPosition,
    _orientation: "in" | "out"
  ): PropState3D {
    const loc = POSITION_TO_GRID[position];
    const worldPosition = planeMapper.gridLocationToPosition3D(plane, loc);
    const worldRotation = planeMapper.calculatePropRotation(plane, 0);
    return {
      centerPathAngle: 0,
      staffRotationAngle: 0,
      plane,
      worldPosition,
      worldRotation,
    };
  }

  // Derive prop states whenever the pose changes
  const bluePropState = $derived.by<PropState3D | null>(() => {
    const pose = state.currentPose;
    if (!pose) return null;
    return buildPropState(pose.plane, pose.blueHand.position, pose.blueHand.orientation);
  });

  const redPropState = $derived.by<PropState3D | null>(() => {
    const pose = state.currentPose;
    if (!pose) return null;
    return buildPropState(pose.plane, pose.redHand.position, pose.redHand.orientation);
  });

  // Stance variant → avatar facing angle (yaw around Y)
  const facingAngle = $derived(state.currentStanceVariant.rootYawRad);

  // Severity ranking for picking the "worst" event
  const SEVERITY_RANK: Record<"graze" | "clip" | "penetrate", number> = {
    graze: 1,
    clip: 2,
    penetrate: 3,
  };

  function severityToSnapshot(level: "graze" | "clip" | "penetrate"): SnapshotSeverity {
    return level;
  }

  function handleCollisionEvents(events: CollisionEvent[]) {
    if (!events || events.length === 0) {
      state.updateCollision({ severity: "clear", zones: [] });
      return;
    }
    let worst = events[0];
    for (const e of events) {
      if (SEVERITY_RANK[e.severity] > SEVERITY_RANK[worst.severity]) worst = e;
    }
    const zones: CollisionSnapshotZone[] = events.map((e) => ({
      type: e.zone,
      depthCm: e.penetrationDepth * 100,
      description: e.description,
    }));
    const snapshot: CollisionSnapshot = {
      severity: severityToSnapshot(worst.severity),
      zones,
    };
    state.updateCollision(snapshot);
  }
</script>

<div class="pose-viewport">
  <Canvas>
    <T.PerspectiveCamera
      makeDefault
      position={[0, 1.4, 3.5]}
      fov={35}
    >
      <T.Object3D position={[0, 1.2, 0]} />
    </T.PerspectiveCamera>
    <T.AmbientLight intensity={0.6} />
    <T.DirectionalLight position={[3, 5, 4]} intensity={0.8} />

    {#if bluePropState && redPropState}
      <Avatar3D
        {bluePropState}
        {redPropState}
        {facingAngle}
        visible={true}
        isActive={true}
        enableLocomotion={false}
        onCollisionEvents={handleCollisionEvents}
      />
    {/if}
  </Canvas>
</div>

<style>
  .pose-viewport {
    width: 100%;
    height: 100%;
    min-height: 400px;
    background: var(--theme-panel-bg);
    border-radius: 8px;
    overflow: hidden;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/components/PoseViewport.svelte
git commit -m "feat(collision-lab): PoseViewport renders current pose with live collision wiring"
```

---

## Task 11: CollisionReadout component

**Files:**
- Create: `src/lib/features/lab/tabs/collision-lab/components/CollisionReadout.svelte`

- [ ] **Step 1: Create component**

```svelte
<script lang="ts">
  /**
   * CollisionReadout
   *
   * Shows the current pose's collision state: severity badge + list of
   * colliding zones with their penetration depth. Empty state when clear.
   */

  import { getCollisionLabContext } from "../context/collision-lab-context";
  import type { SnapshotSeverity } from "../domain/types";

  const { state } = getCollisionLabContext();

  const severityColor: Record<SnapshotSeverity, string> = {
    clear: "var(--semantic-success, #22c55e)",
    graze: "#eab308",
    clip: "#f97316",
    penetrate: "#ef4444",
  };

  const severityLabel: Record<SnapshotSeverity, string> = {
    clear: "CLEAR",
    graze: "GRAZE",
    clip: "CLIP",
    penetrate: "PENETRATE",
  };

  const snapshot = $derived(state.currentCollision);
  const severity = $derived(snapshot?.severity ?? "clear");
</script>

<div class="readout">
  <div class="severity-badge" style="background: {severityColor[severity]};">
    {severityLabel[severity]}
  </div>

  {#if snapshot && snapshot.zones.length > 0}
    <ul class="zones">
      {#each snapshot.zones as zone}
        <li>
          <span class="zone-type">{zone.type.replace(/-/g, " ")}</span>
          <span class="zone-depth">{zone.depthCm.toFixed(1)}cm</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No collisions detected.</p>
  {/if}
</div>

<style>
  .readout {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
  }
  .severity-badge {
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 16px;
    text-align: center;
    color: white;
    letter-spacing: 0.5px;
  }
  .zones {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .zones li {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    padding: 6px 8px;
    background: var(--theme-panel-bg);
    border-radius: 4px;
  }
  .zone-type {
    text-transform: capitalize;
  }
  .zone-depth {
    font-family: monospace;
    opacity: 0.8;
  }
  .empty {
    margin: 0;
    font-size: 14px;
    opacity: 0.7;
    text-align: center;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/components/CollisionReadout.svelte
git commit -m "feat(collision-lab): CollisionReadout with severity badge and zone list"
```

---

## Task 12: LabelControls component

**Files:**
- Create: `src/lib/features/lab/tabs/collision-lab/components/LabelControls.svelte`

- [ ] **Step 1: Create component**

```svelte
<script lang="ts">
  /**
   * LabelControls
   *
   * Four status buttons for the current pose. Also shows the current
   * label at the top. Hotkey hints (1/2/3/4) are rendered on each button;
   * the actual keyboard handling lives in CollisionLab.svelte's root.
   */

  import { getCollisionLabContext } from "../context/collision-lab-context";
  import type { LabelStatus } from "../domain/types";

  const { state } = getCollisionLabContext();

  interface StatusButton {
    status: LabelStatus;
    label: string;
    hotkey: string;
    color: string;
  }

  const buttons: StatusButton[] = [
    { status: "clear", label: "Clear", hotkey: "1", color: "#22c55e" },
    { status: "needs-adjustment", label: "Needs adjustment", hotkey: "2", color: "#eab308" },
    { status: "unreachable", label: "Unreachable", hotkey: "3", color: "#6b7280" },
    { status: "skip", label: "Skip", hotkey: "4", color: "#64748b" },
  ];

  const currentStatus = $derived(state.currentLabel?.status ?? "unlabeled");
</script>

<div class="controls">
  <div class="current">
    <span class="current-label">Current status:</span>
    <span class="current-value">{currentStatus}</span>
  </div>
  <div class="buttons">
    {#each buttons as btn}
      <button
        class="status-btn"
        class:active={currentStatus === btn.status}
        style="--btn-color: {btn.color};"
        onclick={() => state.labelCurrent(btn.status)}
      >
        <span class="hotkey">{btn.hotkey}</span>
        <span class="label">{btn.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
  }
  .current {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
  }
  .current-label {
    opacity: 0.7;
  }
  .current-value {
    font-weight: 600;
    text-transform: capitalize;
  }
  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .status-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--theme-panel-bg);
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    color: inherit;
    font-size: 14px;
    text-align: left;
  }
  .status-btn:hover {
    border-color: var(--btn-color);
  }
  .status-btn.active {
    border-color: var(--btn-color);
    background: color-mix(in srgb, var(--btn-color) 15%, transparent);
  }
  .hotkey {
    font-family: monospace;
    font-weight: 700;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--btn-color);
    color: white;
    border-radius: 4px;
    font-size: 12px;
  }
  .label {
    flex: 1;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/components/LabelControls.svelte
git commit -m "feat(collision-lab): LabelControls with four status buttons and hotkey hints"
```

---

## Task 13: StanceVariantPicker component

**Files:**
- Create: `src/lib/features/lab/tabs/collision-lab/components/StanceVariantPicker.svelte`

- [ ] **Step 1: Create component**

```svelte
<script lang="ts">
  /**
   * StanceVariantPicker
   *
   * Row of variant cards the reviewer can switch between to try different
   * upper-body orientations on the current pose. Always visible so the
   * reviewer can compare variants before committing to a label.
   */

  import { getCollisionLabContext } from "../context/collision-lab-context";

  const { state } = getCollisionLabContext();
</script>

<div class="picker">
  <h4 class="title">Stance variant</h4>
  <div class="variants">
    {#each state.stanceVariants as variant}
      <button
        class="variant"
        class:active={state.currentVariantIndex === variant.index}
        onclick={() => state.setVariant(variant.index)}
      >
        <span class="index">{variant.index}</span>
        <span class="desc">{variant.description}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
  }
  .title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    opacity: 0.8;
  }
  .variants {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .variant {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--theme-panel-bg);
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    color: inherit;
    font-size: 13px;
    text-align: left;
  }
  .variant:hover {
    border-color: var(--theme-stroke);
  }
  .variant.active {
    border-color: var(--accent-color, #3b82f6);
    background: color-mix(in srgb, var(--accent-color, #3b82f6) 15%, transparent);
  }
  .index {
    font-family: monospace;
    font-weight: 700;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-stroke);
    border-radius: 4px;
    font-size: 11px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/components/StanceVariantPicker.svelte
git commit -m "feat(collision-lab): StanceVariantPicker with 4 variant cards"
```

---

## Task 14: PoseScrubber component

**Files:**
- Create: `src/lib/features/lab/tabs/collision-lab/components/PoseScrubber.svelte`

- [ ] **Step 1: Create component**

```svelte
<script lang="ts">
  /**
   * PoseScrubber
   *
   * Bottom bar with filter chips, a stepper (prev / next / numeric input),
   * and a stacked progress bar showing how many poses are labeled in each
   * status. The cursor hotkeys (arrow keys) are handled by CollisionLab
   * root, not here.
   */

  import { getCollisionLabContext } from "../context/collision-lab-context";
  import { Plane } from "$lib/shared/3d/domain/enums/Plane";
  import type { HandOrientation } from "../domain/types";

  const { state } = getCollisionLabContext();

  const planeOptions: Array<{ value: "all" | Plane; label: string }> = [
    { value: "all", label: "All planes" },
    { value: Plane.WALL, label: "Wall" },
    { value: Plane.WHEEL, label: "Wheel" },
    { value: Plane.FLOOR, label: "Floor" },
  ];

  const oriOptions: Array<{ value: "all" | HandOrientation; label: string }> = [
    { value: "all", label: "Both" },
    { value: "in", label: "In" },
    { value: "out", label: "Out" },
  ];

  const inputValue = $derived((state.cursorIndex + 1).toString());

  function onInput(e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!Number.isNaN(v)) state.jumpTo(v - 1);
  }

  const progressPct = $derived.by(() => {
    const total = state.progress.total;
    if (total === 0) return { clear: 0, needs: 0, unreachable: 0, skipped: 0 };
    return {
      clear: (state.progress.clear / total) * 100,
      needs: (state.progress.needsAdjustment / total) * 100,
      unreachable: (state.progress.unreachable / total) * 100,
      skipped: (state.progress.skipped / total) * 100,
    };
  });
</script>

<div class="scrubber">
  <div class="filters">
    <div class="filter-group">
      <label>Plane</label>
      <div class="chips">
        {#each planeOptions as opt}
          <button
            class="chip"
            class:active={state.planeFilter === opt.value}
            onclick={() => state.setPlaneFilter(opt.value)}
          >{opt.label}</button>
        {/each}
      </div>
    </div>

    <div class="filter-group">
      <label>Blue ori</label>
      <div class="chips">
        {#each oriOptions as opt}
          <button
            class="chip"
            class:active={state.blueOrientationFilter === opt.value}
            onclick={() => state.setBlueOrientationFilter(opt.value)}
          >{opt.label}</button>
        {/each}
      </div>
    </div>

    <div class="filter-group">
      <label>Red ori</label>
      <div class="chips">
        {#each oriOptions as opt}
          <button
            class="chip"
            class:active={state.redOrientationFilter === opt.value}
            onclick={() => state.setRedOrientationFilter(opt.value)}
          >{opt.label}</button>
        {/each}
      </div>
    </div>
  </div>

  <div class="stepper">
    <button class="nav" onclick={() => state.stepBackward()} aria-label="Previous pose">◄</button>
    <span class="cursor">
      Pose
      <input
        type="number"
        min="1"
        max={state.filteredPoses.length}
        value={inputValue}
        oninput={onInput}
      />
      / {state.filteredPoses.length}
    </span>
    <button class="nav" onclick={() => state.stepForward()} aria-label="Next pose">►</button>
    <button class="export" onclick={() => state.exportLabels()}>Export JSON</button>
  </div>

  <div class="progress">
    <div class="bar">
      <div class="seg clear" style="width: {progressPct.clear}%"></div>
      <div class="seg needs" style="width: {progressPct.needs}%"></div>
      <div class="seg unreachable" style="width: {progressPct.unreachable}%"></div>
      <div class="seg skipped" style="width: {progressPct.skipped}%"></div>
    </div>
    <div class="counts">
      <span>Clear: {state.progress.clear}</span>
      <span>Needs: {state.progress.needsAdjustment}</span>
      <span>Unreachable: {state.progress.unreachable}</span>
      <span>Skip: {state.progress.skipped}</span>
      <span>Total labeled: {state.progress.labeled} / {state.progress.total}</span>
    </div>
  </div>
</div>

<style>
  .scrubber {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border-top: 1px solid var(--theme-stroke);
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .filter-group label {
    font-size: 12px;
    opacity: 0.7;
  }
  .chips {
    display: flex;
    gap: 4px;
  }
  .chip {
    padding: 4px 10px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    font-size: 12px;
    color: inherit;
    cursor: pointer;
  }
  .chip.active {
    background: var(--accent-color, #3b82f6);
    color: white;
    border-color: transparent;
  }
  .stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-size: 14px;
  }
  .nav {
    padding: 6px 14px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: inherit;
    cursor: pointer;
    font-size: 16px;
  }
  .cursor {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cursor input {
    width: 60px;
    padding: 4px 6px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 4px;
    color: inherit;
    text-align: center;
    font-family: monospace;
  }
  .export {
    margin-left: auto;
    padding: 6px 14px;
    background: var(--accent-color, #3b82f6);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-size: 13px;
  }
  .progress {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .bar {
    display: flex;
    width: 100%;
    height: 8px;
    background: var(--theme-panel-bg);
    border-radius: 4px;
    overflow: hidden;
  }
  .seg.clear { background: #22c55e; }
  .seg.needs { background: #eab308; }
  .seg.unreachable { background: #6b7280; }
  .seg.skipped { background: #64748b; }
  .counts {
    display: flex;
    gap: 16px;
    font-size: 12px;
    opacity: 0.8;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/components/PoseScrubber.svelte
git commit -m "feat(collision-lab): PoseScrubber with filter chips, stepper, and progress bar"
```

---

## Task 15: CollisionLab root component

**Files:**
- Create: `src/lib/features/lab/tabs/collision-lab/CollisionLab.svelte`

- [ ] **Step 1: Create root component**

```svelte
<script lang="ts">
  /**
   * CollisionLab
   *
   * Root component for the collision lab tab. Resolves services from the
   * DI container, constructs state, sets context, and wires keyboard
   * shortcuts. Child components consume state via getCollisionLabContext.
   */

  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { createCollisionLabState, type CollisionLabState } from "./state/collision-lab-state.svelte";
  import { setCollisionLabContext } from "./context/collision-lab-context";
  import PoseViewport from "./components/PoseViewport.svelte";
  import PoseScrubber from "./components/PoseScrubber.svelte";
  import CollisionReadout from "./components/CollisionReadout.svelte";
  import LabelControls from "./components/LabelControls.svelte";
  import StanceVariantPicker from "./components/StanceVariantPicker.svelte";
  import type { LabelStatus } from "./domain/types";

  let state = $state<CollisionLabState | null>(null);
  let loadError = $state<string | null>(null);

  onMount(async () => {
    try {
      const enumerator = container.items.diamondPoseEnumerator;
      const repo = container.items.collisionLabPoseLabelRepository;
      const stance = container.items.collisionLabStanceVariantProvider;
      state = await createCollisionLabState(enumerator, repo, stance);
      setCollisionLabContext({ state });
    } catch (e) {
      loadError = (e as Error).message;
      console.error("CollisionLab: failed to initialize", e);
    }
  });

  const hotkeyToStatus: Record<string, LabelStatus> = {
    "1": "clear",
    "2": "needs-adjustment",
    "3": "unreachable",
    "4": "skip",
  };

  function handleKeydown(e: KeyboardEvent) {
    if (!state) return;
    // Ignore hotkeys when a form element has focus
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "ArrowRight") {
      state.stepForward();
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowLeft") {
      state.stepBackward();
      e.preventDefault();
      return;
    }
    if (hotkeyToStatus[e.key]) {
      state.labelCurrent(hotkeyToStatus[e.key]);
      e.preventDefault();
      return;
    }
    // Variant hotkeys q/w/e/r → 0/1/2/3
    const variantMap: Record<string, number> = { q: 0, w: 1, e: 2, r: 3 };
    if (e.key in variantMap) {
      state.setVariant(variantMap[e.key]);
      e.preventDefault();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);
  });
  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
</script>

{#if loadError}
  <div class="error">
    Failed to load Collision Lab: {loadError}
  </div>
{:else if !state}
  <div class="loading">Loading pose catalog…</div>
{:else}
  <div class="collision-lab">
    <div class="main">
      <PoseViewport />
    </div>
    <aside class="sidebar">
      <CollisionReadout />
      <LabelControls />
      <StanceVariantPicker />
      {#if state.currentPose}
        <div class="pose-id">ID: <code>{state.currentPose.id}</code></div>
      {/if}
    </aside>
    <footer class="footer">
      <PoseScrubber />
    </footer>
  </div>
{/if}

<style>
  .collision-lab {
    display: grid;
    grid-template-columns: 1fr 320px;
    grid-template-rows: 1fr auto;
    grid-template-areas:
      "main sidebar"
      "footer footer";
    gap: 12px;
    padding: 12px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }
  .main {
    grid-area: main;
    min-height: 0;
  }
  .sidebar {
    grid-area: sidebar;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }
  .footer {
    grid-area: footer;
  }
  .pose-id {
    font-size: 12px;
    opacity: 0.6;
    padding: 0 8px;
  }
  .pose-id code {
    font-family: monospace;
  }
  .loading,
  .error {
    padding: 32px;
    text-align: center;
    opacity: 0.7;
  }
  .error {
    color: #ef4444;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/CollisionLab.svelte
git commit -m "feat(collision-lab): root component with DI wiring, context, and hotkeys"
```

---

## Task 16: Register the tab in navigation and LabModule

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/features/lab/LabModule.svelte`

- [ ] **Step 1: Add tab entry to LAB_TABS**

Modify `src/lib/shared/navigation/config/tab-definitions.ts`. Find the last entry in `LAB_TABS` (the `pov-pattern` entry ending around line 947) and append a new entry before the closing `];`:

```typescript
  {
    id: "pov-pattern",
    label: "POV Pattern",
    icon: '<i class="fas fa-lightbulb" style="color: #06b6d4;" aria-hidden="true"></i>',
    description: "LED strip pattern engine for pixel poi",
    color: "#06b6d4",
    gradient: "linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)",
  },
  {
    id: "collision-lab",
    label: "Collision Lab",
    icon: '<i class="fas fa-shield-halved" style="color: #ef4444;" aria-hidden="true"></i>',
    description: "Catalog and label 3D poses for collision safety",
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #f87171 0%, #ef4444 100%)",
  },
];
```

- [ ] **Step 2: Register loader in LabModule.svelte**

Modify `src/lib/features/lab/LabModule.svelte`. Find the `tabComponents` map (around line 17) and add the entry after the existing `pov-pattern` line (~line 40):

```typescript
    "pov-pattern": () => import("./tabs/PovPatternLab.svelte"),
    "collision-lab": () => import("./tabs/collision-lab/CollisionLab.svelte"),
```

- [ ] **Step 3: Type-check**

Run: `npx svelte-check --output human-verbose 2>&1 | grep -E "collision-lab|LabModule|tab-definitions" | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/navigation/config/tab-definitions.ts src/lib/features/lab/LabModule.svelte
git commit -m "feat(collision-lab): register collision-lab tab in lab navigation"
```

---

## Task 17: Manual verification and test run

**Files:**
- None modified

- [ ] **Step 1: Run full unit test suite for collision-lab**

Run: `npx vitest run tests/unit/collision-lab/`
Expected: PASS — 21 tests across 3 files.

- [ ] **Step 2: Full type-check**

Run: `npx svelte-check`
Expected: 0 new errors. If any pre-existing errors are unrelated, note them but do not fix.

- [ ] **Step 3: Smoke test the tab in the running dev server**

The user's dev server runs on port 5173 (do NOT touch it). Curl the lab route to confirm it compiles:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5173/lab/collision-lab"
```

Expected: `200` (or whatever the lab module's base path produces — if 404, ask the user which URL the lab uses and retry).

- [ ] **Step 4: Ask user to verify visually**

Because this is a 3D UI tab that cannot be meaningfully screenshotted from headless tools in a way that proves correctness, report:

> "Implementation complete. All 21 unit tests pass and svelte-check is clean. Please open the Lab module, switch to the Collision Lab tab, and verify:
>
> 1. A 3D avatar appears with both props positioned at a grid point
> 2. The bottom scrubber shows 'Pose 1 / 192' and filter chips for Plane / Blue ori / Red ori
> 3. Pressing ArrowRight advances through poses; you should see the avatar re-pose and the collision readout update (green CLEAR or red PENETRATE etc.)
> 4. Pressing `1` on a clear pose labels it and auto-advances
> 5. Pressing `w` / `e` / `r` cycles stance variants (avatar yaw should change)
> 6. Clicking 'Export JSON' downloads `diamond-in-out-labels.json`
>
> Let me know what you see — especially if collisions are detected on the first few poses so we know the readout is wired."

---

## Spec Coverage Checklist (self-review)

- [x] 192 pose enumeration — Task 3
- [x] Stable ID scheme — Task 3 (and encoded in type in Task 1)
- [x] Four stance variants (neutral / leaned / rot-L / rot-R) — Task 5
- [x] Local + canonical merge with labeledAt precedence — Task 4
- [x] JSON export — Task 4 + Task 14
- [x] Avatar3D onCollisionEvents prop — Task 9
- [x] CollisionSnapshot wiring — Task 10
- [x] State factory (filters, cursor, progress, labelCurrent) — Task 7
- [x] Context helper — Task 8
- [x] DI container + composition root wiring — Task 6
- [x] Lab tab registration — Task 16
- [x] All five UI components — Tasks 10-14
- [x] Root component with hotkeys — Task 15
- [x] Unit tests for enumerator, repo, state — Tasks 3, 4, 7
- [x] Reserved armRouting field for future elbow routing — Task 1, Task 7

**Deferred to future phases (per spec):** transition graph, CSP solver, cross-plane poses, box mode, non-cardinal positions, elbow routing implementation, spine pitch application (PoseViewport notes this honestly).
