# Formation Presets Expansion — Design Spec

## Goal

Expand the formation preset system from 12 to 15 presets, fix facing/orientation bugs in existing presets, and capture two future phases (per-performer elevation, 2D formation builder) as backlog.

## Scope — Phase 1 (This Spec)

Changes to `@austencloud/scene-3d` package + platform consumers.

### Remove

- **`side-by-side`** — near-duplicate of `line` (1.8m vs 2.0m spacing). "Line" is standard formation terminology across dance/cheer catalogs. Merge into `line`.

### Add Four New Presets

#### Arc (Semi-circle)

- **Valid counts:** 3–8
- **Shape:** Concave crescent opening toward audience. Wings downstage at edges, center sweeps upstage. No performer blocks another from the audience's perspective.
- **Facing:** All face audience (facingAngle = 0).
- **Algorithm:**
  ```
  spread = SPACING * 1.1
  depth = spread * 0.4
  for i in 0..count:
    angle = (i / (count - 1)) * π
    x = -cos(angle) * spread    // left to right
    z = -sin(angle) * depth + WALL_OFFSET  // center upstage, edges downstage
  ```
- **Distinct from circle:** Arc performers all face audience in a crescent. Circle arranges radially with outward facing.
- **Icon:** `bridge-water` (crescent shape)

#### Triangle (Pyramid)

- **Valid counts:** 3–8
- **Shape:** Filled pyramid. Front row narrow, back row wide. Leader at apex.
- **Facing:** All face audience.
- **Row distributions (hardcoded per count for aesthetic balance):**

  | Count | Rows |
  |-------|------|
  | 3 | [1, 2] |
  | 4 | [1, 3] |
  | 5 | [2, 3] |
  | 6 | [1, 2, 3] |
  | 7 | [1, 2, 4] |
  | 8 | [1, 3, 4] |

- **Spacing:** Rows spaced `SPACING * 0.7` on Z, columns spaced `SPACING * 0.65` on X. Each row centered on x=0.
- **Distinct from v-shape:** V-shape is hollow (pairs fan out from apex). Triangle is filled (rows contain multiple performers).
- **Icon:** `caret-up`

#### Diamond

- **Valid counts:** 3–8
- **Shape:** 4 cardinal points (front, left, right, back) as the core. Extras fill gaps.
- **Facing:** All face audience.
- **Layouts by count:**

  | Count | Layout |
  |-------|--------|
  | 3 | Front + back-left + back-right |
  | 4 | Classic cardinal — front, left, right, back |
  | 5 | Cardinal + center |
  | 6 | Cardinal + 2 upper flanks |
  | 7 | Cardinal + center + 2 upper flanks |
  | 8 | Cardinal + center + 2 upper flanks + lower fill |

- **Spacing:** `SPACING * 0.8` between cardinal points.
- **Distinct from grid-2x2:** Grid is axis-aligned rows/columns. Diamond is rotated 45°.
- **Icon:** `diamond`

#### Staggered (Checkerboard)

- **Valid counts:** 4–8
- **Shape:** Two offset rows. Front row and back row, back row shifted by half a column spacing.
- **Facing:** All face audience.
- **Algorithm:**
  ```
  front_count = ceil(count / 2)
  back_count = floor(count / 2)
  colSpacing = 1.8m
  rowDepth = 1.5m
  Front row at z = WALL_OFFSET, centered on x=0
  Back row at z = WALL_OFFSET - rowDepth, shifted right by colSpacing/2
  ```
- **Distinct from grid-2x2:** Grid aligns columns vertically. Staggered offsets the back row by half a spacing — classic cheerleading checkerboard.
- **Icon:** `border-all`

### Fix Existing Presets

#### Circle — Facing Direction

- **Bug:** Circle performers face inward (toward center).
- **Fix:** Face outward (away from center). Change `facingAngle = angle + π/2` to `facingAngle = angle - π/2`.
- **Rationale:** In performance, circle formations have performers projecting outward to the audience on all sides.

#### Circle — Count=2 Facing (No Change)

- Count=2 already faces outward (left performer faces left, right faces right). No change needed.

### Net Preset List (15 total)

| # | Preset | Valid Counts | Facing |
|---|--------|-------------|--------|
| 1 | `grid-2x2` | 1–4 | Audience |
| 2 | `line` | 1–8 | Audience |
| 3 | `circle` | 1–8 | Outward (fixed) |
| 4 | `v-shape` | 1–8 | Audience |
| 5 | `arc` | 3–8 | Audience |
| 6 | `triangle` | 3–8 | Audience |
| 7 | `diamond` | 3–8 | Audience |
| 8 | `staggered` | 4–8 | Audience |
| 9 | `diagonal` | 1–8 | Audience |
| 10 | `tunnel-stack` | 2–8 | Audience |
| 11 | `back-to-back` | 2 | Opposite |
| 12 | `facing-each-other` | 2 | Inward |
| 13 | `stage-lr` | 2 | Audience |
| 14 | `solo` | 1 | Audience |
| 15 | `custom` | 1–8 | Per-slot |

## Files Changed

### `@austencloud/scene-3d` package (bump → 0.1.3)

| File | Change |
|------|--------|
| `src/lib/domain/formation.ts` | Add `"arc" \| "triangle" \| "diamond" \| "staggered"` to `FormationPreset` union. Remove `"side-by-side"`. |
| `src/lib/config/formation-presets.ts` | Add `generateArcSlots()`, `generateTriangleSlots()`, `generateDiamondSlots()`, `generateStaggeredSlots()`. Remove `generateSideBySideSlots()`. Update `getSlotsForPreset()` switch, `FORMATION_PRESETS`, `FORMATION_PRESET_INFO`, `PRESET_VALID_COUNTS`, `presetNames`. Fix circle facing: `angle - π/2`. |
| `src/lib/index.ts` | Re-export new types (if needed). |
| `package.json` | Bump version to `0.1.3`. |

### Platform (`tka-platform`)

| File | Change |
|------|--------|
| `pnpm-lock.yaml` / `package.json` | Update `@austencloud/scene-3d` dependency. |
| `tests/unit/3d-viewer/formation-presets.test.ts` | Add test suites for arc, triangle, diamond, staggered. Remove side-by-side tests. Add circle outward-facing test. |
| `static/formation-playground.html` | Already updated with new generators. Remove side-by-side generator. |
| Any file importing `"side-by-side"` literal | Grep and replace with `"line"`. |

### No Changes Needed

- `FormationManager.ts` — generic over presets, no preset-specific logic.
- `performer-manager.svelte.ts` — delegates to FormationManager.
- `FormationSelector.svelte` — reads from `FORMATION_PRESET_INFO` dynamically.
- `Viewer3DScene.svelte` — no preset-specific logic.

## Testing

- All new presets: slots finite, within ±10m bounds, correct count per valid count.
- Arc: center slot has lowest Z (most upstage), edge slots have highest Z.
- Triangle: row distributions match hardcoded table.
- Diamond: 4-count layout produces cardinal positions.
- Staggered: back row offset by half-spacing from front row.
- Circle facing: verify `facingAngle` points radially outward for counts 3–8.
- Side-by-side removal: no remaining references in codebase.
- Playground visual verification at counts 3, 4, 6, 8.

## Future Phases (Backlog)

### Phase 2 — Per-Performer Elevation

Add optional `elevation?: number` to `FormationSlot`. When set, the 3D scene renders a small platform mesh beneath that performer and offsets their rig root upward. Use case: diamond's top point on a raised platform, pyramid leader elevated, tiered choreography.

### Phase 3 — 2D Formation Builder

Interactive visual editor panel in the 3D viewer controls:
- Drag performers to custom positions on a 2D stage overhead view
- Rotation handle per performer for facing direction
- Bulk operations: face outward, face center, face audience, equidistant spacing
- Formation rotation (orbit positions, facings stay fixed)
- Facing rotation (rotate facings, positions stay fixed)
- Save custom formations as named presets in `FormationSelector`

Builds on existing `preset: "custom"` + `captureCurrentAsFormation()` in FormationManager. Reference implementations: OpenMarch (TypeScript drill writer), DanceForm (Android stage editor), CodeSquirl FormationsTool (visual editor → JSON export).
