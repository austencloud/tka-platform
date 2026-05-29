# Ocean Flora Hi-Fidelity Variant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve a 1024-baseColor flora build to discrete-desktop GPUs (`ultra` tier) while phones/integrated GPUs keep the existing 512 build, with a right-rail dev switch to flip tiers live.

**Architecture:** Parameterize the existing 5-pass `optimize-ocean-glb.mjs` to emit a `_hi` build (baseColor 1024, other maps 512 via slot-scoped resize). A `floraVariant` field on each quality preset selects the URL in `FloraInstances`. A small `$state` rune store lets an admin Dev Tools pill group override the auto-detected tier at runtime, which doubles as the visual test harness.

**Tech Stack:** Node + `@gltf-transform/{core,functions,extensions,cli}` 4.3.0 + `sharp` + KTX-Software; Svelte 5 runes; Threlte; Three.js; Vitest.

**Spec:** `docs/superpowers/specs/2026-05-29-ocean-flora-hi-variant-design.md`

**Commit discipline:** This repo's index is shared across parallel agents. Every commit MUST use an explicit pathspec (`git commit -m "..." -- <paths>`). Never bare-commit.

---

## File Structure

- `scripts/optimize-ocean-glb.mjs` — **modify**: `--profile` arg → texture size + output name + per-slot resize.
- `src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality.ts` — **modify**: add `floraVariant` to config + presets.
- `tests/unit/ocean-quality.test.ts` — **create**: assert variant-per-tier mapping.
- `src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality-override.svelte.ts` — **create**: runtime tier-override rune store.
- `src/lib/shared/3d/environments/scenes/ocean/OceanScene.svelte` — **modify**: apply override to `qualityTier`.
- `src/lib/shared/3d/environments/scenes/ocean/authored/FloraInstances.svelte` — **modify**: variant URL + base fallback on load error.
- `src/lib/shared/3d/components/controls/DevToolsPopover.svelte` — **modify**: tier pill group writing the store.
- `static/models/ocean/ocean_flora_scene_hi.glb` — **build artifact** (~60MB, committed).

---

## Task 1: Parameterize the optimize script

**Files:**
- Modify: `scripts/optimize-ocean-glb.mjs`

- [ ] **Step 1: Add profile parsing + derived output/size after the `OUTPUT` constant**

Replace the existing `OUTPUT` line (currently `const OUTPUT = resolve("static/models/ocean/ocean_flora_scene.glb");`) with:

```js
// Profile: "base" (default, 512 all slots — byte-identical to prior builds) or
// "hi" (baseColor/emissive 1024, normal/MR/occlusion 512). Pass `--profile hi`.
const argIdx = process.argv.indexOf("--profile");
const PROFILE = argIdx !== -1 ? process.argv[argIdx + 1] : "base";
if (PROFILE !== "base" && PROFILE !== "hi") {
  console.error(`Unknown --profile "${PROFILE}" (expected "base" or "hi").`);
  process.exit(1);
}
const IS_HI = PROFILE === "hi";
const OUTPUT = resolve(
  `static/models/ocean/ocean_flora_scene${IS_HI ? "_hi" : ""}.glb`,
);
// Pass-1 resize cap. hi resizes to 1024 (color stays 1024; non-color shrunk to
// 512 in pass 2). base keeps the historical 512-everything build.
const TEXTURE_SIZE = IS_HI ? 1024 : 512;
```

- [ ] **Step 2: Use `TEXTURE_SIZE` in pass 1**

In the pass-1 `run(...)` flag array, change `"--texture-size 512",` to:

```js
    `--texture-size ${TEXTURE_SIZE}`,
```

Also update the pass-1 label string from `"Geometry simplify/instance/flatten + resize→512 (uncompressed geometry)"` to:

```js
    `Geometry simplify/instance/flatten + resize→${TEXTURE_SIZE} (uncompressed geometry)`,
```

- [ ] **Step 3: Make pass 2 slot-aware**

Replace the pass-2 block (the `// 2. Normalize ALL textures → PNG …` block, currently a single `doc.transform(textureCompress({ encoder: sharp, targetFormat: "png" }))`) with:

```js
// 2. Normalize textures → PNG so KTX-Software can read them (it rejects WebP).
//    hi: baseColor/emissive keep their 1024 size; normal/MR/occlusion are
//    resized down to 512 (surface-detail maps don't need the extra res, and it
//    keeps VRAM in budget). base: everything is already 512 from pass 1.
console.log("\n── Normalize textures → PNG (sharp, KTX-readable) ──");
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(TMP_SLIM);
  if (IS_HI) {
    await doc.transform(
      textureCompress({
        encoder: sharp,
        targetFormat: "png",
        slots: /(normalTexture|metallicRoughnessTexture|occlusionTexture)/,
        resize: [512, 512],
      }),
    );
    await doc.transform(
      textureCompress({
        encoder: sharp,
        targetFormat: "png",
        slots: /(baseColorTexture|emissiveTexture)/,
      }),
    );
  } else {
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: "png" }),
    );
  }
  await io.write(TMP_PNG, doc);
  console.log(`  wrote ${TMP_PNG} (${fileSize(TMP_PNG)} MB)`);
}
```

- [ ] **Step 4: Echo the profile in the startup banner**

Change the existing `console.log(\`Input: ${INPUT} (${fileSize(INPUT)} MB)\`);` line to:

```js
console.log(`Input: ${INPUT} (${fileSize(INPUT)} MB)  profile=${PROFILE} → ${OUTPUT}`);
```

- [ ] **Step 5: Lint-check the script parses**

Run: `node --check scripts/optimize-ocean-glb.mjs`
Expected: no output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/optimize-ocean-glb.mjs
git commit -m "feat(ocean): --profile hi for 1024-baseColor flora build" -- scripts/optimize-ocean-glb.mjs
```

---

## Task 2: Add `floraVariant` to the quality config

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality.ts`
- Test: `tests/unit/ocean-quality.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ocean-quality.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getOceanQualityConfig } from "../../src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality";

describe("ocean quality flora variant", () => {
  it("serves the hi flora build only to the ultra tier", () => {
    expect(getOceanQualityConfig("ultra").floraVariant).toBe("hi");
    expect(getOceanQualityConfig("medium").floraVariant).toBe("base");
    expect(getOceanQualityConfig("low").floraVariant).toBe("base");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/unit/ocean-quality.test.ts`
Expected: FAIL — `floraVariant` is `undefined` (type error or `toBe` mismatch).

- [ ] **Step 3: Add the field to the interface**

In `ocean-quality.ts`, inside `interface OceanQualityConfig`, after the `tier: OceanQualityTier;` line add:

```ts
  // Which flora GLB to load: "hi" = 1024-baseColor build (discrete desktop GPUs),
  // "base" = 512 build (phones / integrated GPUs).
  floraVariant: "hi" | "base";
```

- [ ] **Step 4: Set the field on each preset**

In `TIER_PRESETS`, add `floraVariant: "hi",` to the `ultra` preset object, and `floraVariant: "base",` to both the `medium` and `low` preset objects (place each right after its `tier:` line).

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run tests/unit/ocean-quality.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality.ts tests/unit/ocean-quality.test.ts
git commit -m "feat(ocean): floraVariant tier flag (ultra=hi, else base)" -- src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality.ts tests/unit/ocean-quality.test.ts
```

---

## Task 3: Create the runtime tier-override rune store

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality-override.svelte.ts`

- [ ] **Step 1: Write the store**

Mirror the existing `godrays-light-store.svelte.ts` pattern (module-level `$state` + exported getter/setter object):

```ts
import type { OceanQualityTier } from "./ocean-quality";

// Dev-only manual override of the auto-detected ocean quality tier. "auto"
// defers to detectOceanQuality(); any concrete tier forces that tier. Written
// by the right-rail Dev Tools pill group, read by OceanScene. In-memory only —
// resets to "auto" on reload.
let _tierOverride = $state<OceanQualityTier | "auto">("auto");

export const oceanQualityOverride = {
  get tier() {
    return _tierOverride;
  },
  set tier(v: OceanQualityTier | "auto") {
    _tierOverride = v;
  },
};
```

- [ ] **Step 2: Type-check the new file compiles**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -i "ocean-quality-override" || echo "no errors in override store"`
Expected: `no errors in override store`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality-override.svelte.ts
git commit -m "feat(ocean): tier-override rune store (dev)" -- src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality-override.svelte.ts
```

---

## Task 4: Apply the override in OceanScene

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/OceanScene.svelte`

- [ ] **Step 1: Import the override store**

In the `<script>` block, add to the quality imports (the line currently importing `detectOceanQuality, getOceanQualityConfig`), a new import below it:

```ts
  import { oceanQualityOverride } from "./quality/ocean-quality-override.svelte";
```

- [ ] **Step 2: Fold the override into the derived tier**

Replace the existing line:

```ts
  const qualityTier = $derived(detectOceanQuality(renderer.current ?? null));
```

with:

```ts
  const qualityTier = $derived(
    oceanQualityOverride.tier !== "auto"
      ? oceanQualityOverride.tier
      : detectOceanQuality(renderer.current ?? null),
  );
```

`quality` already derives from `qualityTier`, and `FloraInstances` receives `quality` — so an override change re-derives `quality.floraVariant` and (Task 5) re-triggers the flora load.

- [ ] **Step 3: Type-check the scene file**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -i "OceanScene.svelte" || echo "no errors in OceanScene"`
Expected: `no errors in OceanScene`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/OceanScene.svelte
git commit -m "feat(ocean): honor dev tier override in OceanScene" -- src/lib/shared/3d/environments/scenes/ocean/OceanScene.svelte
```

---

## Task 5: Variant URL + fallback in FloraInstances

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/authored/FloraInstances.svelte`

- [ ] **Step 1: Replace the load `$effect` with a variant-aware, fallback-capable version**

Replace the entire `$effect(() => { … })` block (currently lines ~43–80, the one that calls `gltfLoader.load("/models/ocean/ocean_flora_scene.glb", …)`) with:

```ts
  const BASE_URL = "/models/ocean/ocean_flora_scene.glb";
  const HI_URL = "/models/ocean/ocean_flora_scene_hi.glb";

  $effect(() => {
    let cancelled = false;
    // Read the reactive variant so a runtime tier change re-runs this effect.
    const url = quality.floraVariant === "hi" ? HI_URL : BASE_URL;

    function load(target: string, allowFallback: boolean) {
      gltfLoader.load(
        target,
        (gltf) => {
          if (cancelled) return;
          enhanceMaterials(gltf.scene);
          floraScene = gltf.scene;
          onProgress?.(1.0);
          onReady?.();
        },
        (progress) => {
          if (cancelled || !progress.total) return;
          onProgress?.(progress.loaded / progress.total);
        },
        (err) => {
          if (cancelled) return;
          // hi build missing (404 / not generated / deploy lag) → fall back to
          // the base build once so an ultra user never gets an empty scene.
          if (allowFallback && target !== BASE_URL) {
            console.warn(
              `[FloraInstances] ${target} failed; falling back to base build.`,
              err,
            );
            load(BASE_URL, false);
            return;
          }
          console.error("[FloraInstances] Failed to load ocean flora scene:", err);
          onReady?.();
        },
      );
    }

    load(url, true);

    return () => {
      cancelled = true;
      if (floraScene) {
        floraScene.traverse((child) => {
          const m = child as Mesh;
          if (m.isMesh) {
            m.geometry?.dispose();
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            mats.forEach((mat: Material) => mat.dispose());
          }
        });
        floraScene = null;
      }
    };
  });
```

- [ ] **Step 2: Type-check the loader file**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -i "FloraInstances.svelte" || echo "no errors in FloraInstances"`
Expected: `no errors in FloraInstances`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/authored/FloraInstances.svelte
git commit -m "feat(ocean): load tier-selected flora variant with base fallback" -- src/lib/shared/3d/environments/scenes/ocean/authored/FloraInstances.svelte
```

---

## Task 6: Dev Tools tier pill group

**Files:**
- Modify: `src/lib/shared/3d/components/controls/DevToolsPopover.svelte`

- [ ] **Step 1: Import the override store + tier type**

In the `<script>` block, after the existing imports add:

```ts
  import { oceanQualityOverride } from "$lib/shared/3d/environments/scenes/ocean/quality/ocean-quality-override.svelte";
  import type { OceanQualityTier } from "$lib/shared/3d/environments/scenes/ocean/quality/ocean-quality";

  const TIER_OPTIONS: Array<{ value: OceanQualityTier | "auto"; label: string }> = [
    { value: "auto", label: "Auto" },
    { value: "ultra", label: "Ultra" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];
  const activeTier = $derived(oceanQualityOverride.tier);
  function setTier(v: OceanQualityTier | "auto") {
    oceanQualityOverride.tier = v;
  }
```

- [ ] **Step 2: Add the pill group to the markup**

Inside the `<div class="dev-tools">`, after the existing `<button class="dev-action" …>Copy Camera State</button>`, add:

```svelte
  <div class="tier-group" role="group" aria-label="Ocean quality tier">
    <span class="tier-label">Ocean tier</span>
    <div class="tier-pills">
      {#each TIER_OPTIONS as opt (opt.value)}
        <button
          type="button"
          class="tier-pill"
          class:active={activeTier === opt.value}
          aria-pressed={activeTier === opt.value}
          onclick={() => setTier(opt.value)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>
```

- [ ] **Step 3: Add styles**

Inside the `<style>` block, after the existing `.dev-action i { … }` rule, add:

```css
  .tier-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 4px;
  }
  .tier-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.45);
  }
  .tier-pills {
    display: flex;
    gap: 4px;
  }
  .tier-pill {
    flex: 1;
    padding: 6px 4px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 140ms;
  }
  .tier-pill:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  .tier-pill.active {
    background: rgba(99, 179, 237, 0.22);
    border-color: rgba(99, 179, 237, 0.55);
    color: white;
  }
```

- [ ] **Step 4: Type-check the popover**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -i "DevToolsPopover.svelte" || echo "no errors in DevToolsPopover"`
Expected: `no errors in DevToolsPopover`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/components/controls/DevToolsPopover.svelte
git commit -m "feat(ocean): right-rail dev tier pill group" -- src/lib/shared/3d/components/controls/DevToolsPopover.svelte
```

---

## Task 7: Regenerate + verify the hi GLB

**Files:**
- Build artifact: `static/models/ocean/ocean_flora_scene_hi.glb`

- [ ] **Step 1: Confirm the raw source is present**

Run: `ls -lh static/models/ocean/ocean_scene_raw.glb`
Expected: a ~1GB file. If absent, STOP — the raw must be re-exported from Blender (`blender-export-ocean-full.py`) first.

- [ ] **Step 2: Run the hi build (~10 min)**

Run: `NODE_OPTIONS=--max-old-space-size=8192 node scripts/optimize-ocean-glb.mjs --profile hi`
Expected: ends with `Output: …/ocean_flora_scene_hi.glb (≈55–65 MB)` and an inspect dump.

- [ ] **Step 3: Verify baseColor = 1024, non-color = 512**

Run:
```bash
npx gltf-transform inspect static/models/ocean/ocean_flora_scene_hi.glb 2>&1 \
  | sed 's/\x1b\[[0-9;]*m//g' | awk '/TEXTURES/{f=1} f' | grep "image/" \
  | grep -oE "(baseColorTexture|emissiveTexture|normalTexture|metallicRoughnessTexture|occlusionTexture) +\| [0-9]+ +\| [0-9]+x[0-9]+" \
  | sort | uniq -c
```
Expected: every `baseColorTexture` / `emissiveTexture` row reads `1024x1024`; every `normalTexture` / `metallicRoughnessTexture` / `occlusionTexture` row reads `512x512`. If any baseColor reads 512, the slot regex missed it — fix Task 1 Step 3 and rebuild.

- [ ] **Step 4: Confirm meshopt + KTX2 survived**

Run: `npx gltf-transform inspect static/models/ocean/ocean_flora_scene_hi.glb 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "extensionsUsed|webp rows"`
Expected: `extensionsUsed` lists `EXT_meshopt_compression` and `KHR_texture_basisu`; zero webp textures.

- [ ] **Step 5: Confirm the base build is unchanged**

Run: `git status --short static/models/ocean/ocean_flora_scene.glb`
Expected: no output (the 512 build was not touched — we only created `_hi`).

- [ ] **Step 6: Commit the artifact**

```bash
git add static/models/ocean/ocean_flora_scene_hi.glb
git commit -m "build(ocean): 1024-baseColor flora hi build" -- static/models/ocean/ocean_flora_scene_hi.glb
```

---

## Task 8: Full gate + manual verification

- [ ] **Step 1: One cold full check**

Run: `npm run check > /tmp/flora-check.log 2>&1; grep -niE "error" /tmp/flora-check.log | head -40 || echo "no errors"`
Expected: no new errors in the six touched files. Fix any, re-grep the log (don't re-run check to re-filter).

- [ ] **Step 2: Full unit run for the new test**

Run: `npx vitest run tests/unit/ocean-quality.test.ts`
Expected: PASS.

- [ ] **Step 3: Manual runtime verification (author, on localhost)**

This is the visual proof — Claude cannot verify sharpness. Hand off:
> On `localhost:5173`, open the sequence viewer in 3D with the ocean scene + a sequence loaded (admin account). Open right-rail **Dev Tools** → tap **Ultra**: flora disposes and reloads `_hi.glb` (coral sharpens). Tap **Low**: reloads the base build (softens). Confirm both load (no empty scene) and the swap is visible.

- [ ] **Step 4: Confirm no unrelated files were swept into commits**

Run: `git log --oneline -8 --stat | grep -vE "ocean|flora|DevToolsPopover|quality|optimize-ocean|\.md|^[0-9a-f]{7,} " | head` (sanity scan)
Expected: nothing outside the planned paths. If another agent's file appears in any of your commits, STOP and report the SHA (do not rewrite history).

---

## Self-Review

- **Spec coverage:** §1 pipeline → Task 1 + Task 7. §2 tier config → Task 2. §3 loader+fallback → Task 5. §4 dev override → Tasks 3, 4, 6. Verification section → Tasks 7, 8. All covered.
- **Placeholder scan:** no TBD/TODO; every code step shows full code.
- **Type consistency:** `floraVariant: "hi" | "base"` (Task 2) is read in OceanScene via `quality.floraVariant` (implicit) and in FloraInstances `quality.floraVariant === "hi"` (Task 5). `OceanQualityTier | "auto"` is identical in the store (Task 3), OceanScene (Task 4), and DevToolsPopover (Task 6). `oceanQualityOverride.tier` getter/setter name matches across Tasks 3/4/6.
