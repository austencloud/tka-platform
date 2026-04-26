# Realm & 3D Consolidation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all scattered 3D code into a unified Realm module and a single `shared/3d/` infrastructure directory.

**Architecture:** Merge `shared/3d-animation/` (~120 files) and `shared/3d-core/` (~19 files) into `shared/3d/`. Move museum, stage, and gallery features into `features/realm/destinations/`. Graduate Realm from lab tab to top-level module. Remove 3 lab tabs.

**Tech Stack:** Svelte 5, TypeScript, ITI DI, Three.js/Threlte

---

## Summary of Changes

| Before | After |
|--------|-------|
| `shared/3d-animation/` (120 files) | `shared/3d/` (merged, ~139 files) |
| `shared/3d-core/` (19 files) | _(merged into shared/3d/)_ |
| `features/museum/` (18 files) | `features/realm/destinations/museum/` |
| `features/stage/` (1 file) | `features/realm/destinations/stage/` |
| `features/gallery/` (~28 files) | `features/realm/destinations/gallery/` |
| Lab tab: `3d-controls` | `features/realm/tools/3d-controls/` |
| Lab tab: `level8` → RealmModule | Top-level "Realm" module |
| Lab tab: `museum` | _(accessed via Realm destination picker)_ |

Import path replacements (bulk sed):
- `$lib/shared/3d-animation/` → `$lib/shared/3d/`
- `$lib/shared/3d-core/` → `$lib/shared/3d/`
- `$lib/features/museum/` → `$lib/features/realm/destinations/museum/`
- `$lib/features/stage/` → `$lib/features/realm/destinations/stage/`
- `$lib/features/gallery/` → `$lib/features/realm/destinations/gallery/`

---

### Task 1: Merge shared/3d-core into shared/3d-animation

No subdirectory collisions — 3d-core has: `camera/`, `physics/`, `destinations/`, `rendering/`, `layers/`, `scale/`, `debug/`. None of these exist in 3d-animation.

**Files:**
- Move: all files from `src/lib/shared/3d-core/` into `src/lib/shared/3d-animation/`

- [ ] **Step 1: Move 3d-core subdirectories into 3d-animation**

```bash
cd F:/tka-platform
git mv src/lib/shared/3d-core/camera src/lib/shared/3d-animation/camera
git mv src/lib/shared/3d-core/physics src/lib/shared/3d-animation/physics
git mv src/lib/shared/3d-core/destinations src/lib/shared/3d-animation/destinations
git mv src/lib/shared/3d-core/rendering src/lib/shared/3d-animation/rendering
git mv src/lib/shared/3d-core/layers src/lib/shared/3d-animation/layers
git mv src/lib/shared/3d-core/scale src/lib/shared/3d-animation/scale
git mv src/lib/shared/3d-core/debug src/lib/shared/3d-animation/debug
```

- [ ] **Step 2: Remove empty 3d-core directory**

```bash
rmdir src/lib/shared/3d-core
```

- [ ] **Step 3: Bulk replace 3d-core import paths**

Replace `$lib/shared/3d-core/` with `$lib/shared/3d-animation/` across all files (20 files, 55 occurrences):

```bash
grep -rl '\$lib/shared/3d-core/' src/ tests/ --include='*.ts' --include='*.svelte' | xargs sed -i 's|\$lib/shared/3d-core/|\$lib/shared/3d-animation/|g'
```

- [ ] **Step 4: Verify**

```bash
npm run check
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor(3d): merge 3d-core into 3d-animation"
```

---

### Task 2: Rename shared/3d-animation to shared/3d

**Files:**
- Rename: `src/lib/shared/3d-animation/` → `src/lib/shared/3d/`

- [ ] **Step 1: Rename the directory**

```bash
git mv src/lib/shared/3d-animation src/lib/shared/3d
```

- [ ] **Step 2: Bulk replace import paths**

Replace `$lib/shared/3d-animation/` with `$lib/shared/3d/` across all files (13 external + 8 internal cross-refs = ~21 files, ~61 occurrences):

```bash
grep -rl '\$lib/shared/3d-animation/' src/ tests/ --include='*.ts' --include='*.svelte' | xargs sed -i 's|\$lib/shared/3d-animation/|\$lib/shared/3d/|g'
```

- [ ] **Step 3: Update DI container filename**

```bash
git mv src/lib/shared/di/containers/animation-3d-container.ts src/lib/shared/di/containers/3d-container.ts
```

Update references in `src/lib/shared/di/index.ts` and `src/lib/shared/di/container-types.ts`:
- `./containers/animation-3d-container` → `./containers/3d-container`
- Rename export if needed: `createAnimation3DContainer` → `create3DContainer` (optional, follow existing pattern)

- [ ] **Step 4: Verify**

```bash
npm run check
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor(3d): rename 3d-animation → 3d"
```

---

### Task 3: Move museum, stage, gallery into realm/destinations

**Files:**
- Move: `src/lib/features/museum/` → `src/lib/features/realm/destinations/museum/`
- Move: `src/lib/features/stage/` → `src/lib/features/realm/destinations/stage/`
- Move: `src/lib/features/gallery/` → `src/lib/features/realm/destinations/gallery/`

- [ ] **Step 1: Create destinations directory**

```bash
mkdir -p src/lib/features/realm/destinations
```

- [ ] **Step 2: Move feature directories**

```bash
git mv src/lib/features/museum src/lib/features/realm/destinations/museum
git mv src/lib/features/stage src/lib/features/realm/destinations/stage
git mv src/lib/features/gallery src/lib/features/realm/destinations/gallery
```

- [ ] **Step 3: Bulk replace import paths**

```bash
# Museum (4 files)
grep -rl '\$lib/features/museum/' src/ tests/ --include='*.ts' --include='*.svelte' | xargs sed -i 's|\$lib/features/museum/|\$lib/features/realm/destinations/museum/|g'

# Stage (0 external files, but check anyway)
grep -rl '\$lib/features/stage/' src/ tests/ --include='*.ts' --include='*.svelte' | xargs sed -i 's|\$lib/features/stage/|\$lib/features/realm/destinations/stage/|g'

# Gallery (4 files)
grep -rl '\$lib/features/gallery/' src/ tests/ --include='*.ts' --include='*.svelte' | xargs sed -i 's|\$lib/features/gallery/|\$lib/features/realm/destinations/gallery/|g'
```

- [ ] **Step 4: Update DI containers**

In `src/lib/shared/di/containers/museum-container.ts` and `gallery-container.ts`, update any imports that reference the old feature paths.

- [ ] **Step 5: Verify**

```bash
npm run check
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor(3d): move museum/stage/gallery into realm/destinations"
```

---

### Task 4: Move 3d-controls lab tab into realm/tools

**Files:**
- Move: `src/lib/features/lab/tabs/3d-controls-lab/` → `src/lib/features/realm/tools/3d-controls/`

- [ ] **Step 1: Create tools directory and move**

```bash
mkdir -p src/lib/features/realm/tools
git mv src/lib/features/lab/tabs/3d-controls-lab src/lib/features/realm/tools/3d-controls
```

- [ ] **Step 2: Update the import in LabModule.svelte**

The `tabComponents` map in `src/lib/features/lab/LabModule.svelte` currently has:
```ts
"3d-controls": () => import("./tabs/3d-controls-lab/ThreeDControlsLab.svelte"),
```

This entry will be removed in Task 5. No import update needed here since the lab tab is being removed entirely.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "refactor(3d): move 3d-controls into realm/tools"
```

---

### Task 5: Graduate Realm as top-level module, remove lab tabs

**Files:**
- Modify: `src/lib/shared/navigation/config/module-definitions.ts`
- Modify: `src/lib/shared/modules/ModuleRenderer.svelte`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/features/lab/LabModule.svelte`

- [ ] **Step 1: Update module-definitions.ts**

Remove the `realm: "lab"` ID migration (line 38). Add Realm to MODULE_DEFINITIONS array:

```ts
{
  id: "realm",
  label: "Realm",
  icon: '<i class="fas fa-vr-cardboard" style="color: #06b6d4;" aria-hidden="true"></i>',
  color: "#06b6d4",
  description: "3D destinations: museum, stage, gallery, procedural worlds",
  isMain: true,
  sections: [],
}
```

- [ ] **Step 2: Update ModuleRenderer.svelte**

Change the realm entry in `moduleLoaders` from pointing at LabModule to pointing at RealmModule:

```ts
// Before:
realm: () => import("../../features/lab/LabModule.svelte"),

// After:
realm: () => import("../../features/realm/RealmModule.svelte"),
```

- [ ] **Step 3: Remove 3 lab tabs from LAB_TABS in tab-definitions.ts**

Remove entries with IDs: `3d-controls`, `level8`, `museum`

- [ ] **Step 4: Remove 3 lab tab entries from LabModule.svelte tabComponents**

Remove entries: `"3d-controls"`, `level8`, `museum`

- [ ] **Step 5: Verify**

```bash
npm run check
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(realm): graduate to top-level module, remove 3 lab tabs"
```

---

### Task 6: Final verification and cleanup

- [ ] **Step 1: Verify no stale references remain**

```bash
grep -r '3d-core' src/ --include='*.ts' --include='*.svelte' -l
grep -r '3d-animation' src/ --include='*.ts' --include='*.svelte' -l
grep -r 'features/museum/' src/ --include='*.ts' --include='*.svelte' -l
grep -r 'features/stage/' src/ --include='*.ts' --include='*.svelte' -l
grep -r 'features/gallery/' src/ --include='*.ts' --include='*.svelte' -l
```

All should return empty. If any hits remain, update them.

- [ ] **Step 2: Full build verification**

```bash
npm run check
npm run build
```

- [ ] **Step 3: Run existing tests**

```bash
npm test
```

The museum layout-calculator test at `tests/unit/museum/layout-calculator.test.ts` needs its import updated (handled by Task 3's sed).

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A && git commit -m "chore(3d): cleanup stale references after consolidation"
```

---

## Post-Consolidation Structure

```
src/lib/shared/3d/                    ← unified 3D infrastructure
  camera/                              ← was 3d-core
  physics/                             ← was 3d-core
  destinations/                        ← was 3d-core
  rendering/                           ← was 3d-core
  layers/                              ← was 3d-core
  scale/                               ← was 3d-core
  debug/                               ← was 3d-core
  components/                          ← was 3d-animation
  domain/                              ← was 3d-animation
  services/                            ← was 3d-animation
  state/                               ← was 3d-animation
  effects/                             ← was 3d-animation
  environments/                        ← was 3d-animation
  config/                              ← was 3d-animation
  keyboard/                            ← was 3d-animation
  viewmodel/                           ← was 3d-animation
  docs/                                ← was 3d-animation
  Viewer3DModule.svelte                ← was 3d-animation
  StageWorld.svelte                    ← was 3d-animation

src/lib/features/realm/                ← all 3D features
  RealmModule.svelte                   ← entry point (destination picker)
  destinations/
    museum/                            ← was features/museum/
    stage/                             ← was features/stage/
    gallery/                           ← was features/gallery/
    realm-world/                       ← (future: extract from realm root)
  tools/
    3d-controls/                       ← was lab/tabs/3d-controls-lab/
  components/                          ← existing realm components
  core/                                ← existing realm core (ECS, chunks)
  generation/                          ← existing terrain generation
  rendering/                           ← existing realm rendering
  vegetation/                          ← existing vegetation system
  ...
```

## Risk Notes

- **No logic changes.** Every change is a file move + import path update.
- **Bulk sed is the riskiest operation.** Verify with `npm run check` after each task.
- **Gallery has ~28 files** with many internal relative imports. These won't break since the directory moves as a unit.
- **DI containers stay in `src/lib/shared/di/containers/`** — only their internal imports change.
