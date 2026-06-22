# Enchanted Autumn Dusk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy procedural Autumn 3D scene with a luminous "Enchanted Autumn Dusk" environment built the Ocean way — Meshy-authored hero GLBs + instanced CC0 kit fill + runtime particle/wisp/pond/interaction systems.

**Architecture:** Mirror `scenes/ocean/`: an `AutumnScene.svelte` orchestrator loads a Meshy-authored hero GLB (meshopt + KTX2), mounts `authored/` (instanced kit flora) and `runtime/` (atmosphere, wisps, pond, lighting, interaction), reports readiness through the scene-feature context, and selects detail via a `quality/` tier config cloned from Ocean.

**Tech Stack:** Svelte 5 (runes), Threlte (`@threlte/core`, `@threlte/extras`), three.js, Meshy text-to-3D API, gltf-transform, Vitest.

**Spec:** `docs/superpowers/specs/active/2026-06-21-enchanted-autumn-dusk-design.md`

**Conventions for every task:**
- No branches/worktrees — work on `main` (project rule).
- Commit ONLY the files the task touches, with an explicit pathspec: `git commit -m "…" -- <paths>`. The shared index holds other agents' work.
- Inner loop uses `npm run check:watch` (background) + HMR on :5173. Run ONE full `npm run check` before a commit. Never `npm run dev`.
- Visual verification = the test page at `http://localhost:5173/test/autumn-scene` (built in Task 3), not screenshots unless Austen asks.

---

## Phase 0 — Meshy hero-asset pipeline (scripts now; generation gated on Austen)

### Task 1: Clone the Meshy generate/optimize scripts for autumn

**Files:**
- Create: `scripts/generate-autumn-meshy.mjs`
- Create: `scripts/optimize-autumn-meshy.mjs`
- Create: `scripts/autumn-meshy-assets.json` (prompt manifest)

- [ ] **Step 1: Write the asset prompt manifest**

`scripts/autumn-meshy-assets.json` — one entry per hero asset. Shared `stylePrefix` keeps the set coherent (spec §11 risk mitigation).

```json
{
  "stylePrefix": "stylized painterly low-poly fantasy, cohesive art direction, dusk lighting,",
  "polycount": 30000,
  "assets": [
    {
      "id": "hero-tree-a",
      "prompt": "ancient gnarled fantasy oak tree, thick twisting trunk, exposed roots, sprawling canopy of crimson and gold autumn leaves, hollow knots",
      "texturePrompt": "weathered dark bark, crimson-gold autumn foliage with softly glowing emissive leaf edges, dusk ambiance",
      "textureSize": 2048
    },
    {
      "id": "hero-tree-b",
      "prompt": "ancient twisted fantasy maple, leaning trunk, knotted bark, broad canopy of amber and red leaves, moss patches",
      "texturePrompt": "mossy dark bark, amber-red glowing-edge autumn foliage, dusk ambiance",
      "textureSize": 2048
    },
    {
      "id": "mushroom-grove",
      "prompt": "cluster of oversized fantasy glowing mushrooms, fat caps, clustered stems, forest floor base with moss and fallen leaves",
      "texturePrompt": "bioluminescent teal and violet mushroom caps with vein-lit glowing gills, emissive, mossy base, dusk",
      "textureSize": 2048
    },
    {
      "id": "terrain-shell",
      "prompt": "circular fantasy forest floor terrain, gentle mounds, a shallow pond depression on one side, leaf litter, exposed roots and rocks, low rim",
      "texturePrompt": "autumn forest floor, fallen crimson-gold leaves, damp moss, dark soil, dusk",
      "textureSize": 1024
    }
  ]
}
```

- [ ] **Step 2: Write `scripts/generate-autumn-meshy.mjs`**

Clone of `scripts/generate-stage-meshy.mjs` (read it first), driven by the manifest. Iterates assets, runs preview→refine per asset, writes `static/models/autumn/<id>_raw.glb`. Reuse the exact `post`/`waitTask` helpers and the `MESHY_API_KEY` guard from the stage script.

```js
#!/usr/bin/env node
/**
 * Generate autumn hero GLBs via Meshy text-to-3D (preview -> refine).
 * Driven by scripts/autumn-meshy-assets.json. Key in .env as MESHY_API_KEY.
 *
 * Usage:
 *   node scripts/generate-autumn-meshy.mjs              # all assets
 *   node scripts/generate-autumn-meshy.mjs --only hero-tree-a
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";
const KEY = process.env.MESHY_API_KEY;
if (!KEY) { console.error("MESHY_API_KEY not set."); process.exit(1); }
const AUTH = { Authorization: `Bearer ${KEY}` };
const JSON_HDR = { ...AUTH, "Content-Type": "application/json" };

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const manifest = JSON.parse(await readFile(resolve("scripts/autumn-meshy-assets.json"), "utf8"));
const outDir = "static/models/autumn";

async function post(body) {
  const res = await fetch(BASE, { method: "POST", headers: JSON_HDR, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${res.status}: ${JSON.stringify(json)}`);
  return json.result;
}
async function waitTask(id, label, { interval = 5000, timeout = 900000 } = {}) {
  const start = Date.now();
  for (;;) {
    const res = await fetch(`${BASE}/${id}`, { headers: AUTH });
    const json = await res.json();
    process.stdout.write(`  ${label}: ${json.status} ${json.progress ?? 0}%\r`);
    if (json.status === "SUCCEEDED") { console.log(`\n  ${label}: SUCCEEDED`); return json; }
    if (json.status === "FAILED" || json.status === "CANCELED")
      throw new Error(`${label} ${json.status}: ${JSON.stringify(json.task_error ?? json)}`);
    if (Date.now() - start > timeout) throw new Error(`${label} timed out.`);
    await new Promise((r) => setTimeout(r, interval));
  }
}

for (const a of manifest.assets) {
  if (only && a.id !== only) continue;
  console.log(`\n=== ${a.id} ===`);
  const prompt = `${manifest.stylePrefix} ${a.prompt}`;
  const previewId = await post({
    mode: "preview", prompt, ai_model: "meshy-6", art_style: "realistic",
    topology: "triangle", target_polycount: manifest.polycount, should_remesh: true,
  });
  console.log(`Preview: ${previewId}`);
  await waitTask(previewId, "preview");
  const refineId = await post({
    mode: "refine", preview_task_id: previewId, enable_pbr: true, texture_prompt: a.texturePrompt,
  });
  console.log(`Refine: ${refineId}`);
  const done = await waitTask(refineId, "refine");
  const glbUrl = done.model_urls?.glb;
  if (!glbUrl) throw new Error(`No GLB for ${a.id}: ${JSON.stringify(done.model_urls)}`);
  const out = resolve(`${outDir}/${a.id}_raw.glb`);
  await mkdir(dirname(out), { recursive: true });
  const bin = Buffer.from(await (await fetch(glbUrl)).arrayBuffer());
  await writeFile(out, bin);
  console.log(`-> ${out} (${(bin.length / 1024).toFixed(1)} KB)`);
}
console.log("\nNext: node scripts/optimize-autumn-meshy.mjs");
```

- [ ] **Step 3: Write `scripts/optimize-autumn-meshy.mjs`**

Clone of `scripts/optimize-stage-meshy.mjs`. Optimizes every `*_raw.glb` in `static/models/autumn/` → `<id>.glb`. Keeps `--simplify true` (Meshy output is dense). Per-asset texture size read from the manifest.

```js
#!/usr/bin/env node
/**
 * Optimize autumn Meshy GLBs for mobile WebGL. Simplify stays ON (dense input).
 * Glow lives in the baked PBR textures; runtime adds emissive override on top.
 */
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifest = JSON.parse(await readFile(resolve("scripts/autumn-meshy-assets.json"), "utf8"));
const kb = (p) => (statSync(p).size / 1024).toFixed(1);

for (const a of manifest.assets) {
  const input = resolve(`static/models/autumn/${a.id}_raw.glb`);
  const output = resolve(`static/models/autumn/${a.id}.glb`);
  if (!existsSync(input)) { console.warn(`skip ${a.id}: ${input} missing`); continue; }
  console.log(`\n${a.id}: ${kb(input)} KB`);
  execSync([
    "npx gltf-transform optimize", `"${input}" "${output}"`,
    "--texture-compress webp", `--texture-size ${a.textureSize ?? 1024}`,
    "--compress draco", "--simplify true", "--simplify-error 0.001",
    "--instance true", "--flatten true",
  ].join(" "), { stdio: "inherit" });
  console.log(`-> ${output} (${kb(output)} KB)`);
}
```

- [ ] **Step 4: Verify scripts parse (no generation yet)**

Run: `node --check scripts/generate-autumn-meshy.mjs && node --check scripts/optimize-autumn-meshy.mjs`
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-autumn-meshy.mjs scripts/optimize-autumn-meshy.mjs scripts/autumn-meshy-assets.json
git commit -m "feat(autumn-scene): Meshy generate/optimize scripts + asset manifest" -- scripts/generate-autumn-meshy.mjs scripts/optimize-autumn-meshy.mjs scripts/autumn-meshy-assets.json
```

### Task 2: Generate hero assets (GATED — Austen runs this)

> **Physical blocker.** Meshy runs against Austen's account/credits (minutes per asset). Implementation of later component tasks proceeds against placeholder loading (components must tolerate a not-yet-present GLB — `useGltf` returns null until loaded). When Austen confirms, run:

- [ ] `node scripts/generate-autumn-meshy.mjs` (≈5–15 min)
- [ ] `node scripts/optimize-autumn-meshy.mjs`
- [ ] Confirm `static/models/autumn/{hero-tree-a,hero-tree-b,mushroom-grove,terrain-shell}.glb` exist and inspect output sizes.
- [ ] Commit the optimized `.glb` files only (not `_raw`): add `static/models/autumn/*_raw.glb` to `.gitignore` first.

```bash
echo "static/models/autumn/*_raw.glb" >> .gitignore
git add .gitignore static/models/autumn/hero-tree-a.glb static/models/autumn/hero-tree-b.glb static/models/autumn/mushroom-grove.glb static/models/autumn/terrain-shell.glb
git commit -m "feat(autumn-scene): Meshy-authored hero GLBs" -- .gitignore static/models/autumn/hero-tree-a.glb static/models/autumn/hero-tree-b.glb static/models/autumn/mushroom-grove.glb static/models/autumn/terrain-shell.glb
```

---

## Phase 1 — Pure logic + quality (unit-testable, no GLB dependency)

### Task 3: Test-page route for live visual verification

**Files:**
- Create: `src/routes/test/autumn-scene/+page.svelte`

Find an existing 3D test route to copy the canvas/scene-feature harness from first:

- [ ] **Step 1: Locate the harness pattern**

Run: `ls src/routes/test/ | grep -iE "ocean|scene|3d|viewer"` and read the closest match (e.g. an ocean/viewer test page). Copy its Threlte `<Canvas>` + scene-feature context provider + `Environment3D`/scene mount structure.

- [ ] **Step 2: Write the page** mounting `AutumnScene` directly (or `Environment3D` with `backgroundType={BackgroundType.AUTUMN}`) with an orbit camera, so HMR shows the scene as it's built. Use the same scene-feature context wrapper the real viewer uses.

- [ ] **Step 3: Verify it serves**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test/autumn-scene`
Expected: `200`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/test/autumn-scene/+page.svelte
git commit -m "test(autumn-scene): live verification route" -- src/routes/test/autumn-scene/+page.svelte
```

### Task 4: Seeded placement helper (`placements.ts`)

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/autumn/authored/placements.ts`
- Test: `src/lib/shared/3d/environments/scenes/autumn/authored/placements.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ringPlacements, type Placement } from "./placements";

describe("ringPlacements", () => {
  it("returns one placement per count", () => {
    const out = ringPlacements({ count: 12, radius: 10, radiusJitter: 1, scaleBase: 1, scaleVariation: 0.3, seed: 0 });
    expect(out).toHaveLength(12);
  });
  it("is deterministic for the same seed", () => {
    const cfg = { count: 8, radius: 9, radiusJitter: 1.5, scaleBase: 1, scaleVariation: 0.4, seed: 7 };
    expect(ringPlacements(cfg)).toEqual(ringPlacements(cfg));
  });
  it("keeps placements within radius +/- jitter", () => {
    const out = ringPlacements({ count: 20, radius: 10, radiusJitter: 2, scaleBase: 1, scaleVariation: 0, seed: 3 });
    for (const p of out) {
      const r = Math.hypot(p.x, p.z);
      expect(r).toBeGreaterThanOrEqual(8 - 1e-6);
      expect(r).toBeLessThanOrEqual(12 + 1e-6);
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/shared/3d/environments/scenes/autumn/authored/placements.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (the deterministic-hash ring pattern already used by Forest/Winter, extracted to a pure helper)

```ts
export interface RingConfig {
  count: number;
  radius: number;
  radiusJitter: number;
  scaleBase: number;
  scaleVariation: number;
  seed: number;
}

export interface Placement {
  x: number;
  z: number;
  scale: number;
  rotationY: number;
}

export function ringPlacements(cfg: RingConfig): Placement[] {
  return Array.from({ length: cfg.count }, (_, i) => {
    const angle = (i / cfg.count) * Math.PI * 2 + cfg.seed * 0.4;
    const s = cfg.seed * 100 + i;
    const r = cfg.radius + Math.sin(s * 3.7) * cfg.radiusJitter;
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      scale: cfg.scaleBase + Math.abs(Math.sin(s * 2.3) * cfg.scaleVariation),
      rotationY: angle + Math.PI + Math.sin(s * 1.7) * 0.3,
    };
  });
}
```

- [ ] **Step 4: Run test to confirm pass**

Run: `npx vitest run src/lib/shared/3d/environments/scenes/autumn/authored/placements.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/autumn/authored/placements.ts src/lib/shared/3d/environments/scenes/autumn/authored/placements.test.ts
git commit -m "feat(autumn-scene): seeded ring placement helper" -- src/lib/shared/3d/environments/scenes/autumn/authored/placements.ts src/lib/shared/3d/environments/scenes/autumn/authored/placements.test.ts
```

### Task 5: Quality tiers (`autumn-quality.ts` + override)

**Files:**
- Read first: `src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality.ts` and `ocean-quality-override.svelte.ts`
- Create: `src/lib/shared/3d/environments/scenes/autumn/quality/autumn-quality.ts`
- Create: `src/lib/shared/3d/environments/scenes/autumn/quality/autumn-quality-override.svelte.ts`
- Test: `src/lib/shared/3d/environments/scenes/autumn/quality/autumn-quality.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { getAutumnQualityConfig } from "./autumn-quality";

describe("getAutumnQualityConfig", () => {
  it("scales detail down with tier", () => {
    const high = getAutumnQualityConfig("high");
    const low = getAutumnQualityConfig("low");
    expect(low.fillTreeCount).toBeLessThan(high.fillTreeCount);
    expect(low.leafCount).toBeLessThan(high.leafCount);
    expect(low.pondReflector).toBe(false);
    expect(high.pondReflector).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

Run: `npx vitest run src/lib/shared/3d/environments/scenes/autumn/quality/autumn-quality.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** the tier type + config (mirror `ocean-quality.ts` structure; read it to match the `detectOceanQuality` signature so `AutumnScene` can call `detectAutumnQuality(renderer)` the same way).

```ts
export type AutumnQualityTier = "low" | "medium" | "high";

export interface AutumnQualityConfig {
  fillTreeCount: number;
  mushroomCount: number;
  leafCount: number;
  sporeCount: number;
  fireflyCount: number;
  wispCount: number;
  pondReflector: boolean;
  godRays: boolean;
  shadows: boolean;
}

const CONFIGS: Record<AutumnQualityTier, AutumnQualityConfig> = {
  high:   { fillTreeCount: 60, mushroomCount: 40, leafCount: 220, sporeCount: 120, fireflyCount: 80, wispCount: 9, pondReflector: true,  godRays: true,  shadows: true  },
  medium: { fillTreeCount: 38, mushroomCount: 24, leafCount: 140, sporeCount: 70,  fireflyCount: 50, wispCount: 6, pondReflector: true,  godRays: true,  shadows: false },
  low:    { fillTreeCount: 20, mushroomCount: 12, leafCount: 70,  sporeCount: 30,  fireflyCount: 24, wispCount: 4, pondReflector: false, godRays: false, shadows: false },
};

export function getAutumnQualityConfig(tier: AutumnQualityTier): AutumnQualityConfig {
  return CONFIGS[tier];
}

// Mirror ocean's detection: gate on renderer capabilities / device. Read
// ocean-quality.ts detectOceanQuality and replicate its heuristic verbatim,
// returning AutumnQualityTier.
export function detectAutumnQuality(renderer: import("three").WebGLRenderer | null): AutumnQualityTier {
  if (!renderer) return "medium";
  // Replicate ocean's tier heuristic (max texture size / device pixel ratio /
  // mobile UA) — see ocean-quality.ts:detectOceanQuality.
  const maxTex = renderer.capabilities.maxTextureSize;
  if (maxTex < 8192) return "low";
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return mobile ? "medium" : "high";
}
```

`autumn-quality-override.svelte.ts` — clone `ocean-quality-override.svelte.ts` (a `$state` rune holding `tier: AutumnQualityTier | "auto"`), renamed.

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run src/lib/shared/3d/environments/scenes/autumn/quality/autumn-quality.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/autumn/quality/
git commit -m "feat(autumn-scene): quality tiers + override" -- src/lib/shared/3d/environments/scenes/autumn/quality/
```

---

## Phase 2 — Authored flora (instanced kit)

### Task 6: `AutumnFlora.svelte` — instanced CC0 kit placement + glowing mushrooms

**Files:**
- Read first: `scenes/ocean/authored/FloraInstances.svelte` (instancing + onProgress/onReady pattern), `WinterScene.svelte` (the `tintSnowy`/`snowyClone` material-override pattern).
- Create: `src/lib/shared/3d/environments/scenes/autumn/authored/AutumnFlora.svelte`

- [ ] **Step 1: Implement** following `FloraInstances.svelte`:
  - `useGltf` each kit model from `static/models/vegetation/`: fill trees (`tree_oak_fall`, `tree_fat_fall`, `tree_detailed_fall`, `tree_tall_fall`, `tree_default_fall`, `tree_cone_fall`), mushrooms (`mushroom_red`, `mushroom_redGroup`, `mushroom_redTall`, `mushroom_tanGroup`), detail (`stump_old`, `log`, `grass_large`, `flower_redA`, `rock_largeA`, `rock_tallC`).
  - Build placements via `ringPlacements` (Task 4), counts from the `AutumnQualityConfig` prop.
  - Render each model as an InstancedMesh / cloned-`<T is>` per placement (match how FloraInstances does instancing).
  - **Glowing mushrooms:** clone the mushroom material and set `emissive` + `emissiveIntensity` (teal `#00c8b4` / violet) using the clone-and-mutate pattern from `WinterScene.tintSnowy`. Expose the emissive material refs so `AutumnInteraction` (Task 11) can pulse them.
  - Props: `{ quality: AutumnQualityConfig, groundY: number, onProgress?: (f:number)=>void, onReady?: ()=>void }`. Report per-GLB load progress like FloraInstances.
  - `onDestroy`: dispose clones via `../utils/dispose-scene` `disposeSceneGraph`.

- [ ] **Step 2: Wire into the test page** (Task 3) temporarily to see flora render. Verify in HMR at `http://localhost:5173/test/autumn-scene` — kit trees/mushrooms appear in rings, mushrooms glow.

- [ ] **Step 3: Typecheck**

Run: `npm run check 2>&1 | tee /tmp/check.log; grep -iE "autumn" /tmp/check.log`
Expected: no autumn errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/autumn/authored/AutumnFlora.svelte
git commit -m "feat(autumn-scene): instanced kit flora + glowing mushrooms" -- src/lib/shared/3d/environments/scenes/autumn/authored/AutumnFlora.svelte
```

---

## Phase 3 — Runtime systems

### Task 7: `AutumnLighting.svelte` — warm/cool dusk split

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/autumn/runtime/lighting/AutumnLighting.svelte`

- [ ] **Step 1: Implement** a `<T.DirectionalLight>` warm low sun (`#ffb060`, from one side, casts shadows when `quality.shadows`), a cool fill `<T.DirectionalLight>` (`#3a6a8a`, opposite/shadow side), and a `<T.HemisphereLight>` (sky `#4a2a50`, ground `#1a0f14`). Prop: `{ quality: AutumnQualityConfig, groundY: number }`. No state — pure declarative.

- [ ] **Step 2: HMR check** — scene gains the warm/cool rake. **Commit.**

```bash
git add src/lib/shared/3d/environments/scenes/autumn/runtime/lighting/AutumnLighting.svelte
git commit -m "feat(autumn-scene): warm/cool dusk lighting" -- src/lib/shared/3d/environments/scenes/autumn/runtime/lighting/AutumnLighting.svelte
```

### Task 8: `AutumnParticles.svelte` — leaves + spores + fireflies

**Files:**
- Read first: `scenes/../primitives/FallingParticles.svelte` (the shared particle primitive — props: `type`, `count`, `area`, `speed`, `colors`, `sizeRange`, `spin`).
- Create: `src/lib/shared/3d/environments/scenes/autumn/runtime/atmosphere/AutumnParticles.svelte`

- [ ] **Step 1: Implement** three `FallingParticles` instances driven by `quality`:
  - leaves: `type="leaves"`, `count={quality.leafCount}`, colors `["#b5571a","#d98324","#8a2e16","#e0a040"]`, `spin`.
  - spores: `type="dust"` (or `bubbles`), `count={quality.sporeCount}`, colors `["#9af9e0","#00c8b4"]`, slow rise.
  - fireflies: `type="fireflies"`, `count={quality.fireflyCount}`, colors `["#ffe9a0","#ffcf66"]`, clustered near the pond (offset area).
  - Use `{#key count}` remount guard like Forest/Winter (GPU buffers size at mount).

- [ ] **Step 2: HMR check. Commit.**

```bash
git add src/lib/shared/3d/environments/scenes/autumn/runtime/atmosphere/AutumnParticles.svelte
git commit -m "feat(autumn-scene): leaf/spore/firefly particles" -- src/lib/shared/3d/environments/scenes/autumn/runtime/atmosphere/AutumnParticles.svelte
```

### Task 9: `WillOWisps.svelte` — drifting glowing orbs

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/autumn/runtime/wisps/WillOWisps.svelte`

- [ ] **Step 1: Implement** `quality.wispCount` wisps. Each = an emissive sphere (`MeshStandardMaterial`, emissive `#ffd8a0`, shared unit `SphereGeometry`, scaled per-wisp) + a `<T.PointLight>` child (warm, low distance). Animate drift in `useTask` (sinusoidal x/z/y bob, per-wisp phase) — pattern from `RainbowScene` prismatic orbs (read its `useTask` orb loop). Expose orb material refs for the interaction pulse (Task 11). Dispose shared geo/materials in `onDestroy`.

- [ ] **Step 2: HMR check. Commit.**

```bash
git add src/lib/shared/3d/environments/scenes/autumn/runtime/wisps/WillOWisps.svelte
git commit -m "feat(autumn-scene): will-o-wisps" -- src/lib/shared/3d/environments/scenes/autumn/runtime/wisps/WillOWisps.svelte
```

### Task 10: `AutumnPond.svelte` + `GodRayShafts` reuse

**Files:**
- Read first: `WinterScene.svelte` (the `Reflector` organic-pond block) and `scenes/ocean/runtime/atmosphere/GodRayShafts.svelte`.
- Create: `src/lib/shared/3d/environments/scenes/autumn/runtime/water/AutumnPond.svelte`

- [ ] **Step 1: Implement `AutumnPond`** by extracting Winter's `createOrganicPondShape` + `Reflector` setup into this component. Tint the reflector color toward dusk rose-gold (`#c98a5a`). Gate the whole Reflector behind `quality.pondReflector` — when false, render a static `MeshStandardMaterial` plane tinted to the dusk sky instead (spec §11). Prop: `{ quality, groundY, position }`.

- [ ] **Step 2: God rays** — reuse `ocean/.../GodRayShafts.svelte` directly if scene-agnostic; otherwise clone to `autumn/runtime/atmosphere/GodRayShafts.svelte` with warm dusk color. Gate behind `quality.godRays`. (Read it first; prefer direct reuse — note which in the commit.)

- [ ] **Step 3: HMR check. Commit.**

```bash
git add src/lib/shared/3d/environments/scenes/autumn/runtime/water/AutumnPond.svelte src/lib/shared/3d/environments/scenes/autumn/runtime/atmosphere/
git commit -m "feat(autumn-scene): mirror pond + god-ray shafts" -- src/lib/shared/3d/environments/scenes/autumn/runtime/water/AutumnPond.svelte src/lib/shared/3d/environments/scenes/autumn/runtime/atmosphere/
```

### Task 11: `AutumnInteraction.svelte` — motion pulses glow

**Files:**
- Read first: `scenes/ocean/runtime/interaction/OceanInteraction.svelte` (cursor-ray + audio pattern) and `fish-scatter.ts`.
- Create: `src/lib/shared/3d/environments/scenes/autumn/runtime/interaction/AutumnInteraction.svelte`

- [ ] **Step 1: Implement** the cursor-ray tracking from `OceanInteraction` (pointer → NDC → ray). In `useTask`, for each wisp/mushroom emissive material (passed in or via shared refs from Tasks 6 & 9), raise `emissiveIntensity` by proximity of the ray/pointer to the object, decaying back to baseline. Optional: trigger the soft chime on the existing audio path (reuse `createOceanAudio` analog — gate behind `sceneAudioState`). Prop: `{ cursorRay?, targets }`.

- [ ] **Step 2: Verbal-permission gate** — interactive verification (moving the cursor in the canvas) requires Austen's OK per project rules. Verify logic via HMR yourself (console-log intensity changes), then ask Austen to confirm the pulse feels right.

- [ ] **Step 3: Typecheck + Commit.**

```bash
git add src/lib/shared/3d/environments/scenes/autumn/runtime/interaction/AutumnInteraction.svelte
git commit -m "feat(autumn-scene): performer/pointer pulses wisp+mushroom glow" -- src/lib/shared/3d/environments/scenes/autumn/runtime/interaction/AutumnInteraction.svelte
```

### Task 12: `AutumnRuntimeSystems.svelte` — compose the runtime children

**Files:**
- Read first: `scenes/ocean/runtime/OceanRuntimeSystems.svelte`.
- Create: `src/lib/shared/3d/environments/scenes/autumn/runtime/AutumnRuntimeSystems.svelte`

- [ ] **Step 1: Implement** mounting `AutumnLighting`, `AutumnParticles`, `WillOWisps`, `AutumnPond`, `GodRayShafts`, `AutumnInteraction`, threading `{ quality, performerCount, stageWidth, stageDepth, stageZOffset, groundY }`. Mirror OceanRuntimeSystems prop fan-out.

- [ ] **Step 2: Typecheck + Commit.**

```bash
git add src/lib/shared/3d/environments/scenes/autumn/runtime/AutumnRuntimeSystems.svelte
git commit -m "feat(autumn-scene): runtime systems composer" -- src/lib/shared/3d/environments/scenes/autumn/runtime/AutumnRuntimeSystems.svelte
```

---

## Phase 4 — Orchestrator + integration

### Task 13: New `AutumnScene.svelte` orchestrator

**Files:**
- Read first: `scenes/ocean/OceanScene.svelte`.
- Modify (replace contents): `src/lib/shared/3d/environments/scenes/AutumnScene.svelte`

- [ ] **Step 1: Implement** mirroring `OceanScene.svelte`:
  - Quality: `detectAutumnQuality(renderer.current)` with `autumnQualityOverride.tier` escape hatch; `getAutumnQualityConfig`.
  - Hero GLBs: `useGltf("/models/autumn/terrain-shell.glb", { meshoptDecoder: useMeshopt(), ktx2Loader: useKtx2("/basis/") })`, plus `hero-tree-a/b`, `mushroom-grove`. Mount `<T is={$glb.scene}>` with placements for the trees (instanced/positioned).
  - Combined progress: fold hero-GLB load + `AutumnFlora` flora fraction into one `reportProgress("environment", …)`; `reportReady("environment")` when both land. Mirror Ocean's weights.
  - Fog: `FogExp2("#2a1838", 0.02)` + `scene.background` dusk color, cleaned up on destroy.
  - Mount `<AutumnFlora>` + `<AutumnRuntimeSystems>`.
  - Tolerate missing GLBs (Phase 0 Task 2 may not have run): `{#if $glb}` guards so the scene renders flora+runtime even before hero assets exist.
  - Props: `{ performerCount, stageWidth, stageDepth, stageZOffset }` (unchanged from current `AutumnScene` signature — `Environment3D` already passes these).

- [ ] **Step 2: Full typecheck**

Run: `npm run check 2>&1 | tee /tmp/check.log; grep -ciE "error" /tmp/check.log`
Expected: `0` (or only pre-existing unrelated errors — diff against a clean baseline).

- [ ] **Step 3: Visual verify** at `http://localhost:5173/test/autumn-scene` and in the real viewer (set background to Autumn). Confirm: dusk mood, glowing flora, leaves/wisps/fireflies, pond, loading curtain fills smoothly. Report to Austen with the test-page link.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/AutumnScene.svelte
git commit -m "feat(autumn-scene): Enchanted Autumn Dusk orchestrator" -- src/lib/shared/3d/environments/scenes/AutumnScene.svelte
```

### Task 14: Retire legacy procedural Autumn components

**Files:**
- Delete: `scenes/autumn/AutumnForest.svelte`, `AutumnGround.svelte`, `WoodlandStream.svelte`, `MushroomCluster.svelte`, `GroundMist.svelte`
- Verify: no remaining imports of these or of `Stage3D` from the autumn path.

- [ ] **Step 1: Grep for references** before deleting

Run: `grep -rilE "AutumnForest|AutumnGround|WoodlandStream|MushroomCluster|GroundMist" src/ | grep -v "scenes/autumn/"`
Expected: empty (only the legacy files reference each other). If the new `AutumnScene` no longer imports them and nothing else does, safe to delete. **If anything else references them, STOP and report** (per verify-before-deleting rule).

- [ ] **Step 2: Delete** the five legacy files.

- [ ] **Step 3: Full check + build**

Run: `npm run check 2>&1 | tee /tmp/check.log; grep -ciE "error" /tmp/check.log` → expect `0`.
Run: `npm run build:fast 2>&1 | tail -20` → expect success.

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/shared/3d/environments/scenes/autumn/
git commit -m "refactor(autumn-scene): retire legacy procedural autumn components" -- src/lib/shared/3d/environments/scenes/autumn/AutumnForest.svelte src/lib/shared/3d/environments/scenes/autumn/AutumnGround.svelte src/lib/shared/3d/environments/scenes/autumn/WoodlandStream.svelte src/lib/shared/3d/environments/scenes/autumn/MushroomCluster.svelte src/lib/shared/3d/environments/scenes/autumn/GroundMist.svelte
```

### Task 15: Final verification + sign-off

- [ ] **Step 1:** Full `npm run check` → 0 new errors.
- [ ] **Step 2:** Full `npm run build` (with asset trim) → success.
- [ ] **Step 3:** `npx vitest run src/lib/shared/3d/environments/scenes/autumn/` → all green.
- [ ] **Step 4:** Visual sign-off in the real sequence viewer (Autumn background) + test page. Capture the test-page link for Austen.
- [ ] **Step 5:** If Meshy hero assets weren't generated yet (Task 2 gated), confirm the scene degrades gracefully (flora + runtime only) and flag the remaining generation step to Austen.

---

## Self-review notes

- **Spec coverage:** look (T7/T8/T13 fog) · build strategy A (Meshy T1–2 + kit T6) · architecture mirror (T6/T12/T13) · assets bespoke+kit (T1/T2/T6) · Meshy pipeline (T1/T2) · runtime effects (T8/T9/T10) · interaction (T11) · performance/quality (T5, gates in T6–T10) · integration (T13, Environment3D unchanged) · migration/retire (T14) · out-of-scope respected (no registry, no toggles). All spec sections mapped.
- **Gated dependency:** Task 2 (Meshy generation) is a physical blocker on Austen's account; all component tasks tolerate absent hero GLBs so work proceeds in parallel.
- **Type consistency:** `AutumnQualityConfig` fields (`fillTreeCount`, `leafCount`, `wispCount`, `pondReflector`, `godRays`, `shadows`) defined in T5 and consumed verbatim in T6–T10/T13. `ringPlacements`/`Placement` defined T4, consumed T6. `detectAutumnQuality`/`getAutumnQualityConfig` defined T5, consumed T13.
