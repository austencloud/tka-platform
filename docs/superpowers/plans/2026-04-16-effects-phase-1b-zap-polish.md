# Effects Phase 1b — Zap Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Zap effect that landed in Phase 1a — fix two correctness regressions, switch to per-hand color, and modernize the Customize UI to match the rest of the effects panel.

**Architecture:** Three groups of fixes (A: correctness; B: per-hand color data model; C: UX modernization). Group B bumps `EFFECTS_CONFIG_VERSION` 2→3 with a migration; Group C inlines the existing `TrailsCategory` chip/slider/color-picker pattern into `ZapCustomize` rather than introducing a new shared component.

**Tech Stack:** Svelte 5 (runes), TypeScript strict, Threlte (3D), Canvas2D (effects layer), Vitest.

**Spec:** `docs/superpowers/specs/2026-04-15-effects-phase-1b-zap-polish-design.md`
**Resumes from:** tag `phase-1a-zap-complete`
**Project guardrails:** project CLAUDE.md bans worktrees and branches — work on `main`. Never run `npm run dev` (port 5173 is the user's dev server). Verification = `curl localhost:5173`, `npm run build`, or `npm run check`.

---

## Reference patterns to copy (audit done up-front)

Phase 1b spec asks the implementer to audit color-picker/slider patterns. Done — here are the canonical sources to copy from:

- **Circular color picker (32px):** `src/lib/shared/animation-engine/components/animation-settings-modal/categories/TrailsCategory.svelte:299-323` — native `<input type="color">` styled as a 32px circular swatch with accent border.
- **Slider row:** `TrailsCategory.svelte:246-270` — `.slider-row` flex layout, native `<input type="range">` with `accent-color: var(--theme-accent)`, value readout in monospace.
- **Chip row (radiogroup):** `TrailsCategory.svelte:198-244` — `.chip-group` with `role="radiogroup"`, `.chip.active` highlighted via `color-mix(in srgb, var(--theme-accent) 15%, transparent)`.
- **No shared `<ColorPicker>` component exists** — every Customize/Category panel does its own native-input styling. Don't extract one (YAGNI — only Trail and Zap need it; LED uses MotionColor selectors and Fire delegates to FireCategory's curve editor).

`TrailCustomize.svelte` / `FireCustomize.svelte` / `CharcoalCustomize.svelte` all delegate to a `*Category` sibling that lives under `animation-settings-modal/categories/`. **ZapCustomize stays inline** — the unified intent state for Zap lives in `effects-config-context`, not the legacy `animation-settings-state`, and a `ZapCategory.svelte` would either fork that state or break the unified intent layer.

---

## Scope discipline notes (from Session 1 retro)

Phase 1a Task 5 (vm-shim) and Task 9 (CLS fix) were correct fixes but landed in the wrong commits because the implementer scope-crept. For this plan:

- **Each task commits ONLY its named change.** If you find an unrelated bug while implementing, file it as a deferred item in `docs/superpowers/specs/effects-unification-deferred-items.md` and keep moving.
- **Do not** "while I'm here" refactor other Customize panels, other renderers, or unrelated state.
- **Do not** clobber the in-flight LED ribbon work (`src/lib/shared/3d/effects/led/`) or the Gear Popover (`Viewer3DGearPopover.svelte`).

---

## Task 1: Investigate the preset bug and document root cause

**Files (read only — no commit):**
- Read: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts:2280-2310` (the `getFrameParams` zap diff cache)
- Read: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts:1744-1778` (`syncZapOverlay`)
- Read: `src/lib/shared/animation-engine/components/effects-panel/presets/zap-presets.ts` (preset apply path)
- Read: `src/lib/shared/effects/state/effects-config-state.svelte.ts:70-73, 94-97` (`updateZap`, `applyPreset`)

- [ ] **Step 1: Add diagnostic console.logs**

In `AnimationEngine.svelte.ts` around line 2296 (the `if (this.effectsConfigState)` block), add:

```ts
if (this.effectsConfigState) {
  const intent = this.effectsConfigState.zap;
  const intentJson = JSON.stringify(intent);
  if (intentJson !== this.prevZapIntentJson) {
    // eslint-disable-next-line no-console
    console.log("[ZAP DIAG]", "intent changed", intent);
    this.prevZapIntentJson = intentJson;
    this.zapConfig = resolveZap2D(intent);
  }
}
```

In `zap-presets.ts` line 8, add:

```ts
function apply(presetId: string, patch: Partial<...>): void {
  const state = getEffectsConfigContext();
  if (!state) return;
  // eslint-disable-next-line no-console
  console.log("[ZAP DIAG]", "preset apply", presetId, patch);
  state.updateZap(patch);
  ...
```

- [ ] **Step 2: Reproduce the bug**

Curl the running dev server to confirm it's up:

```bash
curl -s http://localhost:5173/ -o /dev/null -w "%{http_code}\n"
```

Expected: `200`. If not 200, ask the user to start the dev server in VS Code.

Ask the user (do not auto-pilot the browser — interactive Chrome DevTools MCP requires verbal permission per project CLAUDE.md): *"I've added two diagnostic logs. Open Effects Lab → enable Zap → click Thunder, then Tesla, then Plasma. Paste the console output back to me."*

- [ ] **Step 3: Diagnose and write findings**

Based on the console output, identify which of these is true:
1. `preset apply` fires but `intent changed` doesn't → preset isn't reaching the intent state (state mutation bug in `applyPreset` or `updateZap`)
2. Both fire but visual doesn't change → renderer isn't picking up new params (the cached `this.zapConfig` is updating but render loop isn't re-running, OR the renderer holds stale state past `dispose`)
3. Neither fires → context not wired (would mean Phase 1a wiring regressed — unlikely)

Write a 3-sentence findings note in this plan file inline below this task before continuing.

- [ ] **Step 4: Remove the diagnostic logs**

Revert both `console.log` additions. Diagnostics are not committed.

- [ ] **Step 5: NO commit**

This task produces understanding, not code. Move to Task 2 with the findings in hand.

---

## Task 2: Fix the preset application bug

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts:2280-2310` (likely)
- OR Modify: `src/lib/shared/effects/state/effects-config-state.svelte.ts:70-97` (less likely)
- OR Modify: `src/lib/shared/animation-engine/components/effects-panel/presets/zap-presets.ts` (least likely)
- Test: `src/lib/shared/effects/state/effects-config-state.test.ts` (create if it doesn't exist) — preset application regression test

The exact file depends on Task 1 findings. The three likely shapes:

**Shape 1 — Render loop not triggered when intent changes mid-pause.** Most likely. When `getFrameParams` only runs during active render frames, a paused engine won't pick up new presets. Fix: have `getFrameParams` invalidate the diff differently, OR add an observer in the engine that listens for `effectsConfigState.zap` changes and calls `renderLoopService?.triggerRender()`.

**Shape 2 — Cache stale by reference.** `prevZapIntentJson` cached against the prior intent's JSON. On re-application of the same preset (`Thunder` twice), the JSON is identical so the resolver is skipped — but if the *renderer* ever resets internal state (`Zap2DRenderer.cachedArcs`) without re-receiving params, you'd see this exact symptom. Fix: switch the cache from JSON-string to reference identity (`if (intent !== this.prevZapIntentRef)`).

**Shape 3 — Preset patch shape mismatch.** `applyPreset` in `effects-config-state.svelte.ts:94-97` does `mergeConfig(config, preset.patch)`. The current `zap-presets.ts` patch only contains `activePresets` — the actual zap intent fields are mutated separately via `updateZap` immediately before. If `applyPreset`'s `config = mergeConfig(...)` reassignment loses the in-flight `updateZap` mutation through some Svelte reactivity quirk, presets silently revert. Fix: bundle both into a single `applyPreset` call.

- [ ] **Step 1: Write the failing regression test**

Create `src/lib/shared/effects/state/effects-config-state.test.ts` (or extend if it exists):

```ts
import { describe, it, expect } from "vitest";
import { createEffectsConfigState } from "./effects-config-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "../domain/defaults";

describe("EffectsConfigState — preset application", () => {
  it("applying a zap preset patch sets intent fields AND activePresets atomically", () => {
    const state = createEffectsConfigState();
    state.updateZap({ intensity: 0.9, frequency: 8, mode: "arc", branching: 0.4 });
    state.applyPreset({
      id: "zap-thunder",
      effectType: "zap",
      patch: { activePresets: { ...state.activePresets, zap: "zap-thunder" } },
    } as any);
    expect(state.activePresets.zap).toBe("zap-thunder");
    expect(state.zap.intensity).toBe(0.9);
    expect(state.zap.frequency).toBe(8);
    expect(state.zap.mode).toBe("arc");
    expect(state.zap.branching).toBe(0.4);
  });

  it("applying preset twice in a row re-asserts the intent fields", () => {
    const state = createEffectsConfigState();
    // Apply once
    state.updateZap({ intensity: 1.0, frequency: 20 });
    state.applyPreset({ id: "zap-tesla", effectType: "zap", patch: { activePresets: { ...state.activePresets, zap: "zap-tesla" } } } as any);
    // User tweaks then re-applies
    state.updateZap({ intensity: 0.3 });
    expect(state.activePresets.zap).toBeNull(); // updateZap clears
    state.updateZap({ intensity: 1.0, frequency: 20 });
    state.applyPreset({ id: "zap-tesla", effectType: "zap", patch: { activePresets: { ...state.activePresets, zap: "zap-tesla" } } } as any);
    expect(state.activePresets.zap).toBe("zap-tesla");
    expect(state.zap.intensity).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run the test — confirm it passes (state layer is correct) OR fails (state layer is the bug)**

```bash
npx vitest run src/lib/shared/effects/state/effects-config-state.test.ts
```

If both tests pass: the state layer is correct, the bug is downstream. Skip to Step 4.
If a test fails: the state layer is the bug — proceed to Step 3.

- [ ] **Step 3: If state-layer test failed — fix `applyPreset`**

Likely fix in `effects-config-state.svelte.ts` lines 94-97 — `applyPreset` should preserve the existing intent unless the patch explicitly overrides it:

```ts
function applyPreset(preset: EffectsPreset) {
  const merged = mergeConfig(config, preset.patch as Partial<EffectsConfig>);
  merged.activePresets[preset.effectType] = preset.id;
  config = merged;
}
```

(The line `config.activePresets[preset.effectType] = preset.id` after the assignment may be the bug if Svelte's `$state` deep-proxy is treating the reassigned `config` as detached from the proxy graph until next microtask. Mutating `merged` then assigning is safer.)

Re-run the test to confirm it passes.

- [ ] **Step 4: If state layer is correct — fix the engine cache OR render trigger**

Per Task 1 Shape 1 or Shape 2, modify `AnimationEngine.svelte.ts` around line 2296. Switch the cache to reference identity AND ensure a render is triggered after intent changes:

```ts
// New field at the top of the class (replace prevZapIntentJson):
private prevZapIntentRef: ZapIntent | null = null;

// In getFrameParams, replace lines 2296-2303:
if (this.effectsConfigState) {
  const intent = this.effectsConfigState.zap;
  if (intent !== this.prevZapIntentRef) {
    this.prevZapIntentRef = intent;
    this.zapConfig = resolveZap2D(intent);
    // Force a render even when paused so preset clicks update visibly.
    if (this.renderLoopService && this.lastPropsRef) {
      this.renderLoopService.triggerRender(() =>
        this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
      );
    }
  }
}
```

NOTE: this is reentrant because `getFrameParams` calls `triggerRender` which recursively calls `getFrameParams`. Guard with a flag:

```ts
private inGetFrameParams = false;

// inside getFrameParams:
if (this.effectsConfigState && !this.inGetFrameParams) {
  this.inGetFrameParams = true;
  try {
    const intent = this.effectsConfigState.zap;
    if (intent !== this.prevZapIntentRef) {
      this.prevZapIntentRef = intent;
      this.zapConfig = resolveZap2D(intent);
      if (this.renderLoopService && this.lastPropsRef) {
        this.renderLoopService.triggerRender(() =>
          this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
        );
      }
    }
  } finally {
    this.inGetFrameParams = false;
  }
}
```

Also delete the now-unused `prevZapIntentJson` field declaration and its initializer at line 283.

- [ ] **Step 5: Verify the user can see preset switching work**

Tell the user: *"Bug fix landed. Reload Effects Lab, enable Zap, click through Thunder/Tesla/Plasma — confirm visible change each click. Tell me what you see."*

DO NOT claim the fix works without the user's confirmation. The verification protocol in `.claude/rules/verification-protocol.md` is enforced — do not write "should work now."

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/effects/state/effects-config-state.test.ts \
        src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts \
        src/lib/shared/effects/state/effects-config-state.svelte.ts
git commit -m "$(cat <<'EOF'
fix(effects): zap presets now apply visibly on click

Switch the zap intent cache from JSON-string to reference identity,
and force a render-loop trigger when the intent changes so paused
engines pick up preset clicks immediately. Adds preset-application
regression tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Make the frequency slider actually do something

**Files:**
- Modify: `src/lib/shared/effects/renderers/Zap2DRenderer.ts:17-22`
- Test: `src/lib/shared/effects/renderers/Zap2DRenderer.test.ts` (create)

The renderer currently uses a class-level `regenerateEveryFrames = 3` constant and ignores `params.frequency`. Per spec, derive the regen interval from frequency: `Math.max(1, Math.round(60 / params.frequency))`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/shared/effects/renderers/Zap2DRenderer.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { Zap2DRenderer } from "./Zap2DRenderer";
import type { Zap2DParams } from "../translators/canvas2d-types";

function makeCtx(): CanvasRenderingContext2D {
  return {
    globalCompositeOperation: "source-over",
    shadowBlur: 0,
    shadowColor: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function makeParams(overrides: Partial<Zap2DParams> = {}): Zap2DParams {
  return {
    intensity: 0.7,
    leftColor: "#88ccff",
    rightColor: "#88ccff",
    frequency: 12,
    mode: "arc",
    branching: 0.3,
    segments: 8,
    jitterAmount: 10,
    glowBlur: 12,
    lineWidth: 2,
    ...overrides,
  };
}

describe("Zap2DRenderer.frequency", () => {
  it("regenerates more often at high frequency than low", () => {
    const r = new Zap2DRenderer();
    const ctx = makeCtx();
    const tips = {
      bluePosA: { x: 0, y: 0 },
      bluePosB: null,
      redPosA: { x: 100, y: 0 },
      redPosB: null,
    };

    // At freq=30 → regen every 60/30=2 frames; over 10 frames = 5 regens
    const high = makeParams({ frequency: 30 });
    let highRegens = 0;
    const origGen = (r as any).generatePath.bind(r);
    (r as any).generatePath = (...a: any[]) => { highRegens++; return origGen(...a); };
    for (let i = 0; i < 10; i++) r.render(ctx, high, tips);

    // At freq=1 → regen every 60/1=60 frames; over 10 frames = 0 regens (after first frame)
    const r2 = new Zap2DRenderer();
    const low = makeParams({ frequency: 1 });
    let lowRegens = 0;
    const origGen2 = (r2 as any).generatePath.bind(r2);
    (r2 as any).generatePath = (...a: any[]) => { lowRegens++; return origGen2(...a); };
    for (let i = 0; i < 10; i++) r2.render(ctx, low, tips);

    expect(highRegens).toBeGreaterThan(lowRegens);
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
npx vitest run src/lib/shared/effects/renderers/Zap2DRenderer.test.ts
```

Expected: FAIL — current renderer ignores `params.frequency`, so `highRegens === lowRegens`.

- [ ] **Step 3: Implement the fix**

In `src/lib/shared/effects/renderers/Zap2DRenderer.ts`:

```ts
export class Zap2DRenderer {
  private frameCount = 0;
  private cachedArcs: Array<{ x: number; y: number }[]> = [];
  // (delete the `private readonly regenerateEveryFrames = 3` line)

  render(
    ctx: CanvasRenderingContext2D,
    params: Zap2DParams,
    tips: ZapTipInput,
  ): void {
    this.frameCount++;
    const regenerateEveryFrames = Math.max(1, Math.round(60 / params.frequency));
    const needRegen = this.frameCount % regenerateEveryFrames === 0;
    // ...rest unchanged (replace any other `this.regenerateEveryFrames` reference)
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
npx vitest run src/lib/shared/effects/renderers/Zap2DRenderer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/renderers/Zap2DRenderer.ts \
        src/lib/shared/effects/renderers/Zap2DRenderer.test.ts
git commit -m "$(cat <<'EOF'
fix(effects): zap frequency slider now controls regeneration rate

Replace hardcoded regenerateEveryFrames=3 with a per-frame computation
derived from params.frequency. At freq=30 the arc flickers every other
frame; at freq=1 it holds for a full second.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Bump EFFECTS_CONFIG_VERSION 2→3 with v2→v3 migration for per-hand color

**Files:**
- Modify: `src/lib/shared/effects/domain/EffectsConfig.ts:19, 86-97`
- Modify: `src/lib/shared/effects/domain/defaults.ts:43-49`
- Modify: `src/lib/shared/effects/domain/migrations.ts:35-38`
- Test: `src/lib/shared/effects/domain/migrations.test.ts` (create or extend)

Replace the single `color: string` field on `ZapIntent` with `leftColor: string` and `rightColor: string`. Bump version, write the migration that copies `color` to both new fields.

- [ ] **Step 1: Write the failing migration test**

Create `src/lib/shared/effects/domain/migrations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { migrateEffectsConfig } from "./migrations";
import { EFFECTS_CONFIG_VERSION } from "./EffectsConfig";

describe("migrateEffectsConfig", () => {
  it("migrates v1 → current with default zap colors", () => {
    const v1 = { version: 1 };
    const out = migrateEffectsConfig(v1);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.zap.leftColor).toBe("#88ccff");
    expect(out.zap.rightColor).toBe("#88ccff");
  });

  it("migrates v2 zap.color to v3 zap.leftColor + rightColor", () => {
    const v2 = {
      version: 2,
      zap: { intensity: 0.9, color: "#ff00ff", frequency: 10, mode: "arc", branching: 0.4 },
    };
    const out = migrateEffectsConfig(v2);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.zap.leftColor).toBe("#ff00ff");
    expect(out.zap.rightColor).toBe("#ff00ff");
    expect((out.zap as any).color).toBeUndefined();
  });

  it("leaves a current-version v3 zap untouched", () => {
    const v3 = {
      version: EFFECTS_CONFIG_VERSION,
      zap: { intensity: 0.5, leftColor: "#aaaaaa", rightColor: "#bbbbbb", frequency: 5, mode: "arc", branching: 0.2 },
    };
    const out = migrateEffectsConfig(v3);
    expect(out.zap.leftColor).toBe("#aaaaaa");
    expect(out.zap.rightColor).toBe("#bbbbbb");
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
npx vitest run src/lib/shared/effects/domain/migrations.test.ts
```

Expected: FAIL with TypeScript errors on `leftColor`/`rightColor` and runtime errors on undefined fields.

- [ ] **Step 3: Update `EffectsConfig.ts`**

```ts
// src/lib/shared/effects/domain/EffectsConfig.ts
export const EFFECTS_CONFIG_VERSION = 3;

// ...

export interface ZapIntent {
  /** 0-1 — overall arc brightness + branch count. */
  intensity: number;
  /** Hex string — color for the blue (left) hand's zap output. */
  leftColor: string;
  /** Hex string — color for the red (right) hand's zap output. */
  rightColor: string;
  /** 1-30 strikes per second. */
  frequency: number;
  /** 'arc' = tip-to-tip arc. 'crackle' = radiate from each tip. */
  mode: "arc" | "crackle";
  /** 0-1 — probability each arc segment spawns a branch. */
  branching: number;
}
```

- [ ] **Step 4: Update `defaults.ts`**

```ts
// src/lib/shared/effects/domain/defaults.ts:43-49
zap: {
  intensity: 0.7,
  leftColor: "#88ccff",
  rightColor: "#88ccff",
  frequency: 12,
  mode: "arc",
  branching: 0.3,
},
```

- [ ] **Step 5: Update `migrations.ts`**

```ts
// src/lib/shared/effects/domain/migrations.ts
import type { EffectsConfig } from "./EffectsConfig";
import { EFFECTS_CONFIG_VERSION } from "./EffectsConfig";
import { DEFAULT_EFFECTS_CONFIG } from "./defaults";

export function migrateEffectsConfig(raw: unknown): EffectsConfig {
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_EFFECTS_CONFIG);
  }
  const input = raw as Partial<EffectsConfig> & { version?: number; zap?: any };
  const version = input.version ?? 1;

  // v2 → v3: split zap.color into zap.leftColor + zap.rightColor.
  // Mutate the input shape *before* the default-merge so downstream sees v3 shape.
  if (version < 3 && input.zap && typeof input.zap.color === "string" && !input.zap.leftColor) {
    input.zap.leftColor = input.zap.color;
    input.zap.rightColor = input.zap.color;
    delete input.zap.color;
  }

  let out: EffectsConfig = {
    ...DEFAULT_EFFECTS_CONFIG,
    ...input,
    trails: { ...DEFAULT_EFFECTS_CONFIG.trails, ...(input.trails ?? {}) },
    fire: { ...DEFAULT_EFFECTS_CONFIG.fire, ...(input.fire ?? {}) },
    led: { ...DEFAULT_EFFECTS_CONFIG.led, ...(input.led ?? {}) },
    charcoal: { ...DEFAULT_EFFECTS_CONFIG.charcoal, ...(input.charcoal ?? {}) },
    zap: { ...DEFAULT_EFFECTS_CONFIG.zap, ...(input.zap ?? {}) },
    sparkles: { ...DEFAULT_EFFECTS_CONFIG.sparkles, ...(input.sparkles ?? {}) },
    motion: { ...DEFAULT_EFFECTS_CONFIG.motion, ...(input.motion ?? {}) },
    bloom: { ...DEFAULT_EFFECTS_CONFIG.bloom, ...(input.bloom ?? {}) },
    activePresets: {
      ...DEFAULT_EFFECTS_CONFIG.activePresets,
      ...(input.activePresets ?? {}),
    },
    version: EFFECTS_CONFIG_VERSION,
  };

  return out;
}
```

- [ ] **Step 6: Run the migration test — confirm it passes**

```bash
npx vitest run src/lib/shared/effects/domain/migrations.test.ts
```

Expected: PASS (all 3 cases).

- [ ] **Step 7: Run the full effects test suite to catch downstream type errors**

```bash
npx vitest run src/lib/shared/effects/
```

Expected: passing tests for any other test in the directory may now fail TypeScript compilation because they reference the old `zap.color`. **Fix only the test files, not the production code yet** — the production fixes are Tasks 5-7. If a non-test file fails compile, note it for those tasks.

- [ ] **Step 8: Run typecheck to enumerate downstream call sites**

```bash
npm run check 2>&1 | grep -i "zap" | head -40
```

Expected: TypeScript errors at every call site reading `state.zap.color` or constructing a `ZapIntent` literal. This output is your worklist for Tasks 5-9. Save it for reference (no need to fix yet — those are downstream tasks).

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/effects/domain/EffectsConfig.ts \
        src/lib/shared/effects/domain/defaults.ts \
        src/lib/shared/effects/domain/migrations.ts \
        src/lib/shared/effects/domain/migrations.test.ts
git commit -m "$(cat <<'EOF'
feat(effects)!: split zap intent into leftColor + rightColor

Bumps EFFECTS_CONFIG_VERSION 2→3. Adds v2→v3 migration that copies
the legacy zap.color to both new fields so persisted configs load
unchanged. Downstream call sites (translators, renderers, presets,
UI) are updated in subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update 2D + 3D translator types and resolvers for per-hand color

**Files:**
- Modify: `src/lib/shared/effects/translators/canvas2d-types.ts:55-64` (`Zap2DParams`)
- Modify: `src/lib/shared/effects/translators/webgl3d-types.ts:67-76` (`Zap3DParams`)
- Modify: `src/lib/shared/effects/translators/canvas2d-translator.ts:62-73` (`resolveZap2D`)
- Modify: `src/lib/shared/effects/translators/webgl3d-translator.ts:75-86` (`resolveZap3D`)
- Test: `src/lib/shared/effects/translators/canvas2d-translator.test.ts` (create or extend)

Both `Zap2DParams` and `Zap3DParams` `extends ZapIntent` — they automatically pick up `leftColor`/`rightColor` and lose `color`. The resolvers don't need changes for the new fields (they pass through via `...intent`), but verify they still typecheck after Task 4.

- [ ] **Step 1: Write the failing test**

Create or extend `src/lib/shared/effects/translators/canvas2d-translator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveZap2D } from "./canvas2d-translator";
import type { ZapIntent } from "../domain/EffectsConfig";

describe("resolveZap2D — per-hand color", () => {
  it("preserves leftColor and rightColor in the output params", () => {
    const intent: ZapIntent = {
      intensity: 0.7,
      leftColor: "#ff0000",
      rightColor: "#0000ff",
      frequency: 12,
      mode: "arc",
      branching: 0.3,
    };
    const out = resolveZap2D(intent);
    expect(out.leftColor).toBe("#ff0000");
    expect(out.rightColor).toBe("#0000ff");
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
npx vitest run src/lib/shared/effects/translators/canvas2d-translator.test.ts
```

Expected: FAIL with TypeScript errors on `leftColor`/`rightColor` (Task 4 changed the intent shape but `Zap2DParams extends ZapIntent` so the fields propagate — the failure should be that the existing `resolveZap2D` test code or other callers in the file still reference `intent.color`. If there are no such references, the new test compiles and passes immediately, in which case skip to Step 4.)

- [ ] **Step 3: Update the type files (no changes needed if step 2 passed)**

`Zap2DParams` extends `ZapIntent` — already inherits the new fields. Same for `Zap3DParams`. No code change needed unless the resolver had explicit references to `intent.color` (it doesn't, per the canvas2d-translator.ts read at lines 62-73).

If Step 2 surfaced TypeScript errors elsewhere in the translator files, fix them now. The fix shape is always: `intent.color` → use `intent.leftColor` (or `rightColor`, depending on context).

- [ ] **Step 4: Run all translator tests**

```bash
npx vitest run src/lib/shared/effects/translators/
```

Expected: PASS for all.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/translators/canvas2d-translator.test.ts \
        src/lib/shared/effects/translators/canvas2d-types.ts \
        src/lib/shared/effects/translators/canvas2d-translator.ts \
        src/lib/shared/effects/translators/webgl3d-types.ts \
        src/lib/shared/effects/translators/webgl3d-translator.ts
git commit -m "$(cat <<'EOF'
feat(effects): translator tests cover per-hand zap colors

Zap2DParams and Zap3DParams inherit leftColor/rightColor from ZapIntent
automatically. Adds a regression test on resolveZap2D to lock the
contract that translator output preserves both color fields verbatim.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Render zap with per-hand color in 2D

**Files:**
- Modify: `src/lib/shared/effects/renderers/Zap2DRenderer.ts:43-90, 119-146` (`render` and `drawArc`)
- Modify: `src/lib/shared/effects/renderers/Zap2DRenderer.test.ts` (extend)

The renderer currently uses a single `params.color` for both arc and crackle modes. After this task:
- **Arc mode:** each arc draws as a linear gradient stroke from the blue tip (using `leftColor`) to the red tip (using `rightColor`).
- **Crackle mode:** each origin's spokes use that origin's hand color (blue origins → leftColor, red origins → rightColor).

- [ ] **Step 1: Extend the test file**

Append to `src/lib/shared/effects/renderers/Zap2DRenderer.test.ts`:

```ts
describe("Zap2DRenderer — per-hand color", () => {
  it("uses leftColor for blue-origin crackle spokes and rightColor for red-origin", () => {
    const r = new Zap2DRenderer();
    const styles: string[] = [];
    const ctx = makeCtx();
    Object.defineProperty(ctx, "strokeStyle", {
      get() { return ""; },
      set(v: string) { styles.push(v); },
    });

    const params = makeParams({
      mode: "crackle",
      leftColor: "#ff0000",
      rightColor: "#0000ff",
      frequency: 60, // regenerate every frame
    });
    const tips = {
      bluePosA: { x: 0, y: 0 },
      bluePosB: null,
      redPosA: { x: 100, y: 0 },
      redPosB: null,
    };

    r.render(ctx, params, tips);

    // Glow + core passes per spoke; we assert both hand colors appear.
    expect(styles.some(s => s === "#ff0000")).toBe(true);
    expect(styles.some(s => s === "#0000ff")).toBe(true);
  });
});
```

(Update the existing `makeParams` helper if needed — Task 3 already wrote it with `leftColor`/`rightColor` so it should compile.)

- [ ] **Step 2: Run the test — confirm it fails**

```bash
npx vitest run src/lib/shared/effects/renderers/Zap2DRenderer.test.ts -t "per-hand color"
```

Expected: FAIL — current renderer uses one `params.color`.

- [ ] **Step 3: Refactor `Zap2DRenderer`**

Update the file to track per-arc color metadata. Key changes:

```ts
// src/lib/shared/effects/renderers/Zap2DRenderer.ts

import type { Zap2DParams } from "../translators/canvas2d-types";

export interface ZapTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

interface CachedArc {
  path: Array<{ x: number; y: number }>;
  /** Color for the start endpoint of this arc (linear gradient). */
  startColor: string;
  /** Color for the end endpoint. Equal to startColor in crackle mode. */
  endColor: string;
}

export class Zap2DRenderer {
  private frameCount = 0;
  private cachedArcs: CachedArc[] = [];

  render(
    ctx: CanvasRenderingContext2D,
    params: Zap2DParams,
    tips: ZapTipInput,
  ): void {
    this.frameCount++;
    const regenerateEveryFrames = Math.max(1, Math.round(60 / params.frequency));
    const needRegen = this.frameCount % regenerateEveryFrames === 0;

    const prevComposite = ctx.globalCompositeOperation;
    const prevShadowBlur = ctx.shadowBlur;
    const prevShadowColor = ctx.shadowColor;
    const prevStrokeStyle = ctx.strokeStyle;
    const prevLineWidth = ctx.lineWidth;
    const prevGlobalAlpha = ctx.globalAlpha;
    try {
      ctx.globalCompositeOperation = "lighter";

      if (params.mode === "arc") {
        // Arc mode: pair blueA↔redA and blueB↔redB. Gradient leftColor → rightColor.
        const pairs: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = [];
        if (tips.bluePosA && tips.redPosA) pairs.push({ a: tips.bluePosA, b: tips.redPosA });
        if (tips.bluePosB && tips.redPosB) pairs.push({ a: tips.bluePosB, b: tips.redPosB });

        if (needRegen || this.cachedArcs.length !== pairs.length) {
          this.cachedArcs = pairs.map(({ a, b }) => ({
            path: this.generatePath(a, b, params),
            startColor: params.leftColor,
            endColor: params.rightColor,
          }));
        }
        for (const arc of this.cachedArcs) {
          this.drawArc(ctx, arc, params);
        }
      } else {
        // Crackle mode: each origin's spokes carry its own hand color.
        const origins: Array<{ pos: { x: number; y: number }; color: string }> = [];
        if (tips.bluePosA) origins.push({ pos: tips.bluePosA, color: params.leftColor });
        if (tips.bluePosB) origins.push({ pos: tips.bluePosB, color: params.leftColor });
        if (tips.redPosA) origins.push({ pos: tips.redPosA, color: params.rightColor });
        if (tips.redPosB) origins.push({ pos: tips.redPosB, color: params.rightColor });

        const CRACKLE_SPOKES = 3;
        const expectedLength = origins.length * CRACKLE_SPOKES;
        if (needRegen || this.cachedArcs.length !== expectedLength) {
          this.cachedArcs = origins.flatMap((o) => {
            return Array.from({ length: CRACKLE_SPOKES }).map(() => {
              const angle = Math.random() * Math.PI * 2;
              const len = 40 + params.intensity * 60;
              const end = {
                x: o.pos.x + Math.cos(angle) * len,
                y: o.pos.y + Math.sin(angle) * len,
              };
              return {
                path: this.generatePath(o.pos, end, params),
                startColor: o.color,
                endColor: o.color,
              };
            });
          });
        }
        for (const arc of this.cachedArcs) {
          this.drawArc(ctx, arc, params);
        }
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.shadowBlur = prevShadowBlur;
      ctx.shadowColor = prevShadowColor;
      ctx.strokeStyle = prevStrokeStyle;
      ctx.lineWidth = prevLineWidth;
      ctx.globalAlpha = prevGlobalAlpha;
    }
  }

  private generatePath(
    a: { x: number; y: number },
    b: { x: number; y: number },
    params: Zap2DParams,
  ): Array<{ x: number; y: number }> {
    const pts: Array<{ x: number; y: number }> = [a, b];
    for (let iter = 0; iter < Math.log2(params.segments); iter++) {
      const next: typeof pts = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const cur = pts[i]!;
        const nxt = pts[i + 1]!;
        next.push(cur);
        const mx = (cur.x + nxt.x) / 2;
        const my = (cur.y + nxt.y) / 2;
        const jitter = params.jitterAmount / (iter + 1);
        next.push({
          x: mx + (Math.random() - 0.5) * jitter * 2,
          y: my + (Math.random() - 0.5) * jitter * 2,
        });
      }
      next.push(pts[pts.length - 1]!);
      pts.length = 0;
      pts.push(...next);
    }
    return pts;
  }

  private drawArc(
    ctx: CanvasRenderingContext2D,
    arc: CachedArc,
    params: Zap2DParams,
  ): void {
    const { path, startColor, endColor } = arc;
    if (path.length < 2) return;
    const first = path[0]!;
    const last = path[path.length - 1]!;

    // Build the per-arc gradient once per draw call.
    let stroke: string | CanvasGradient;
    if (startColor === endColor) {
      stroke = startColor;
    } else {
      const grad = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
      grad.addColorStop(0, startColor);
      grad.addColorStop(1, endColor);
      stroke = grad;
    }

    // Glow pass — use the gradient (or solid). shadowColor needs a string.
    ctx.strokeStyle = stroke;
    ctx.shadowColor = startColor; // gradient halo isn't supported; pick start as approximation
    ctx.shadowBlur = params.glowBlur;
    ctx.lineWidth = params.lineWidth * 2;
    ctx.globalAlpha = 0.6 * params.intensity;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y);
    ctx.stroke();

    // Core pass — bright white center for the lightning hot core.
    ctx.strokeStyle = "#ffffff";
    ctx.shadowBlur = params.glowBlur * 0.5;
    ctx.lineWidth = params.lineWidth;
    ctx.globalAlpha = params.intensity;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y);
    ctx.stroke();
  }

  dispose(): void {
    this.cachedArcs = [];
    this.frameCount = 0;
  }
}
```

NOTE: the test stub `makeCtx` doesn't implement `createLinearGradient`. Add it:

```ts
function makeCtx(): CanvasRenderingContext2D {
  return {
    globalCompositeOperation: "source-over",
    shadowBlur: 0,
    shadowColor: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;
}
```

- [ ] **Step 4: Run the renderer tests — confirm all pass**

```bash
npx vitest run src/lib/shared/effects/renderers/Zap2DRenderer.test.ts
```

Expected: PASS for both `frequency` and `per-hand color` blocks.

- [ ] **Step 5: Run typecheck to confirm consumers still compile**

```bash
npm run check 2>&1 | grep -i "Zap2DRenderer\|cachedArcs" | head -20
```

Expected: empty output (no consumer reads `cachedArcs` directly — it's private).

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/effects/renderers/Zap2DRenderer.ts \
        src/lib/shared/effects/renderers/Zap2DRenderer.test.ts
git commit -m "$(cat <<'EOF'
feat(effects): zap 2D renderer draws per-hand color

Arc mode renders each arc as a linear gradient from the blue tip's
leftColor to the red tip's rightColor. Crackle mode tags each spoke
with its origin's hand color and strokes accordingly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire per-hand color into 3D `EffectsLayer.svelte`

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectsLayer.svelte:336-355`

`ElectricityArc.svelte` keeps its single `color` prop — that's fine. `EffectsLayer.svelte` already mounts two `ElectricityArc` instances (positive↔positive pair, negative↔negative pair). Pass `leftColor` to one pair and `rightColor` to the other so the user sees two distinct colors in 3D arc mode. This is a documented compromise vs true gradient strokes in 3D — surfacing per-hand color without writing a custom shader.

For 3D crackle mode, `ElectricityArc` would need to be re-architected to mount four instances (one per origin tip). That's deferred item #1 already on the backlog. Phase 1b leaves crackle mode 3D using the same per-pair color split as arc mode.

- [ ] **Step 1: Read the current mount block**

Already read above (`EffectsLayer.svelte:336-355`). Confirms two `<ElectricityArc>` instances both receiving `color={zap3D.color}`.

- [ ] **Step 2: Update both `ElectricityArc` instances**

Change `EffectsLayer.svelte:336-355` to:

```svelte
{#if zapEnabled && zap3D && isPlaying}
  {#if bluePropState && redPropState && blueEnds && redEnds}
    <ElectricityArc
      start={blueEnds.positive}
      end={redEnds.positive}
      enabled={true}
      intensity={zap3D.intensity}
      color={zap3D.leftColor}
      mode={zap3D.mode}
    />
    <ElectricityArc
      start={blueEnds.negative}
      end={redEnds.negative}
      enabled={true}
      intensity={zap3D.intensity}
      color={zap3D.rightColor}
      mode={zap3D.mode}
    />
  {/if}
{/if}
```

(Positive-pair gets `leftColor`, negative-pair gets `rightColor`. Arbitrary but consistent.)

- [ ] **Step 3: Run typecheck**

```bash
npm run check 2>&1 | grep -iE "EffectsLayer|zap3D\." | head -10
```

Expected: empty (the `zap3D` shape is already `Zap3DParams` which inherits the new fields).

- [ ] **Step 4: Verify visually with the user**

Tell the user: *"3D zap now shows two colors. Open a 3D viewer with Zap enabled, set leftColor to red and rightColor to blue in Customize, and confirm one arc reads red and the other reads blue. Tell me what you see."*

DO NOT claim this works without confirmation.

- [ ] **Step 5: Update the deferred items doc**

Append to `docs/superpowers/specs/effects-unification-deferred-items.md` Item 1 (Crackle mode 3D parity) — add a Phase-1b note that 3D crackle mode currently uses per-pair color split (not per-origin), and that the four-instance fix from Option A would also fix true per-hand color in crackle mode.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/effects/EffectsLayer.svelte \
        docs/superpowers/specs/effects-unification-deferred-items.md
git commit -m "$(cat <<'EOF'
feat(effects-3d): zap shows per-hand color via per-arc instance split

EffectsLayer mounts two ElectricityArc instances; the positive-pair now
takes leftColor and the negative-pair takes rightColor. Crackle-mode
true per-origin coloring stays on the deferred backlog (item 1) and is
covered by the four-instance refactor noted there.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Modernize `ZapCustomize.svelte` UI (chip row, color pickers, sliders)

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/customize/ZapCustomize.svelte`

Replace the dated controls with the canonical patterns from `TrailsCategory.svelte`. Inline the styling — do not extract a shared component (audit shows nothing reusable enough yet). Per spec:
- Mode dropdown → two-chip radio row (Arc / Crackle)
- Single native color picker → two circular 32px pickers (Blue hand / Red hand)
- Plain sliders → `.slider-row` pattern with `accent-color` and monospace value readout

- [ ] **Step 1: Replace the file contents**

Rewrite `src/lib/shared/animation-engine/components/effects-panel/customize/ZapCustomize.svelte`:

```svelte
<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();
</script>

<div class="customize-view">
  <button type="button" class="back-btn" onclick={onBack}>
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    Back to presets
  </button>

  {#if state}
    <div class="zap-controls">
      <!-- Mode (chip row) -->
      <div class="option-row">
        <span class="option-label">Mode</span>
        <div class="chip-group" role="radiogroup" aria-label="Zap mode">
          <button
            class="chip"
            class:active={state.zap.mode === "arc"}
            type="button"
            role="radio"
            aria-checked={state.zap.mode === "arc"}
            onclick={() => state.updateZap({ mode: "arc" })}
          >
            <i class="fas fa-bolt" aria-hidden="true"></i>
            Arc
          </button>
          <button
            class="chip"
            class:active={state.zap.mode === "crackle"}
            type="button"
            role="radio"
            aria-checked={state.zap.mode === "crackle"}
            onclick={() => state.updateZap({ mode: "crackle" })}
          >
            <i class="fas fa-asterisk" aria-hidden="true"></i>
            Crackle
          </button>
        </div>
      </div>

      <!-- Intensity -->
      <div class="slider-row">
        <label for="zap-intensity">Intensity</label>
        <input
          id="zap-intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.zap.intensity}
          oninput={(e) => state.updateZap({ intensity: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.zap.intensity * 100)}%</span>
      </div>

      <!-- Frequency -->
      <div class="slider-row">
        <label for="zap-frequency">Frequency</label>
        <input
          id="zap-frequency"
          type="range"
          min="1"
          max="30"
          step="1"
          value={state.zap.frequency}
          oninput={(e) => state.updateZap({ frequency: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.zap.frequency}/s</span>
      </div>

      <!-- Branching -->
      <div class="slider-row">
        <label for="zap-branching">Branching</label>
        <input
          id="zap-branching"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.zap.branching}
          oninput={(e) => state.updateZap({ branching: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.zap.branching * 100)}%</span>
      </div>

      <!-- Per-hand color pickers -->
      <div class="color-row">
        <span class="color-label">Colors</span>
        <div class="color-pickers">
          <label class="color-picker">
            <input
              type="color"
              value={state.zap.leftColor}
              oninput={(e) => state.updateZap({ leftColor: (e.currentTarget as HTMLInputElement).value })}
            />
            <span class="color-hand">Blue</span>
          </label>
          <label class="color-picker">
            <input
              type="color"
              value={state.zap.rightColor}
              oninput={(e) => state.updateZap({ rightColor: (e.currentTarget as HTMLInputElement).value })}
            />
            <span class="color-hand">Red</span>
          </label>
        </div>
      </div>
    </div>
  {:else}
    <p class="empty">Effect state unavailable.</p>
  {/if}
</div>

<style>
  .customize-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    min-height: 44px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .back-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    color: var(--theme-text, white);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .back-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .back-btn i {
    font-size: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .back-btn,
    .chip {
      transition: none;
    }
  }

  /* ── Layout ── */
  .zap-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* ── Chip row (Mode) ── copied from TrailsCategory ── */
  .option-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }

  .option-label {
    min-width: 70px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
  }

  .chip-group {
    display: flex;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .chip {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .chip i {
    font-size: 14px;
  }

  /* ── Sliders ── copied from TrailsCategory ── */
  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }

  .slider-row label {
    min-width: 70px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--theme-accent, #8b5cf6);
  }

  .slider-value {
    min-width: 40px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  /* ── Color pickers ── copied from TrailsCategory ── */
  .color-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }

  .color-label {
    min-width: 70px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .color-pickers {
    display: flex;
    gap: 12px;
    flex: 1;
  }

  .color-picker {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .color-picker input[type="color"] {
    -webkit-appearance: none;
    appearance: none;
    width: 32px;
    height: 32px;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 50%;
    background: none;
    cursor: pointer;
    padding: 0;
  }

  .color-picker input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .color-picker input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 50%;
  }

  .color-picker input[type="color"]::-moz-color-swatch {
    border: none;
    border-radius: 50%;
  }

  .color-hand {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .empty {
    opacity: 0.6;
    font-size: var(--font-size-min, 14px);
    padding: 4px 0;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

```bash
npm run check 2>&1 | grep -i "ZapCustomize\|zap.color" | head -20
```

Expected: empty (no remaining `state.zap.color` reads in this file).

- [ ] **Step 3: Build to confirm Svelte compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds. If not, fix Svelte syntax errors before continuing.

- [ ] **Step 4: Visually verify with the user**

Tell the user: *"ZapCustomize is rebuilt. Open Effects Lab → Zap → Customize. You should see: a Mode chip row (Arc / Crackle), four sliders with monospace value readouts and accent-purple thumbs, and two circular color swatches labeled Blue / Red. Confirm by screenshot or describe what you see."*

DO NOT claim this works without the user's confirmation.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/customize/ZapCustomize.svelte
git commit -m "$(cat <<'EOF'
feat(effects-ui): modernize ZapCustomize with canonical patterns

Replaces the native <select> with a chip-row, the single native color
picker with two circular per-hand swatches, and aligns sliders with
TrailsCategory's accent-color/monospace pattern. Inlines the styling
rather than extracting a shared component (only Trail and Zap need
the per-hand picker — extraction is YAGNI for now).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Migrate `zap-presets.ts` to per-hand color

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/presets/zap-presets.ts`

Each preset patch currently sets `color`. Replace with `leftColor`/`rightColor`. Tesla and Plasma get a flair: Tesla stays single-color (purple), Plasma gets contrasting colors (pink + cyan) to show off the new per-hand feature.

- [ ] **Step 1: Update the preset patches**

```ts
// src/lib/shared/animation-engine/components/effects-panel/presets/zap-presets.ts

export const ZAP_PRESETS: EffectPreset[] = [
  {
    id: "zap-thunder",
    name: "Thunder",
    previewColor: "#88ccff",
    apply: (_vm) => apply("zap-thunder", {
      intensity: 0.9, leftColor: "#88ccff", rightColor: "#88ccff",
      frequency: 8, mode: "arc", branching: 0.4,
    }),
  },
  {
    id: "zap-tesla",
    name: "Tesla",
    previewColor: "#a855f7",
    apply: (_vm) => apply("zap-tesla", {
      intensity: 1.0, leftColor: "#a855f7", rightColor: "#a855f7",
      frequency: 20, mode: "arc", branching: 0.6,
    }),
  },
  {
    id: "zap-plasma",
    name: "Plasma",
    previewColor: "#ec4899",
    apply: (_vm) => apply("zap-plasma", {
      intensity: 0.7, leftColor: "#ec4899", rightColor: "#22d3ee",
      frequency: 16, mode: "crackle", branching: 0.2,
    }),
  },
  {
    id: "zap-custom",
    name: "Custom",
    previewColor: "custom",
    apply: (_vm) => {
      // "Custom" just opens the Customize panel — no-op here; the EffectsPanel
      // routes Custom → customizeOpen.
    },
  },
];
```

(Tesla intentionally same on both hands — the user can tweak it. Plasma flexes the new per-hand feature with pink/cyan crackle.)

- [ ] **Step 2: Run typecheck**

```bash
npm run check 2>&1 | grep -i "zap-presets\|color:" | head -10
```

Expected: empty.

- [ ] **Step 3: Run all effects tests**

```bash
npx vitest run src/lib/shared/effects/
```

Expected: PASS for all.

- [ ] **Step 4: Verify visually with the user**

Tell the user: *"Plasma preset now uses contrasting colors. Open Effects Lab → Zap → click Plasma. Crackle mode should show pink bolts from blue prop tips and cyan bolts from red prop tips. Confirm what you see."*

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/presets/zap-presets.ts
git commit -m "$(cat <<'EOF'
feat(effects): zap presets adopt per-hand color

Thunder and Tesla stay single-color (back-compat with v1 look).
Plasma flexes the new per-hand feature: pink crackle from blue
tips, cyan crackle from red tips.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Final verification + tag

**Files:**
- No code changes. Tag and update memory.

- [ ] **Step 1: Run the full effects test suite one last time**

```bash
npx vitest run src/lib/shared/effects/ src/lib/shared/animation-engine/
```

Expected: all PASS.

- [ ] **Step 2: Run a full typecheck**

```bash
npm run check 2>&1 | tail -10
```

Expected: 0 errors. If there are residual errors mentioning zap, ZapIntent, or color, find and fix the call site (`grep -r "zap.color" src/`).

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 4: Final user verification — all six fixes**

Tell the user: *"Phase 1b is ready for final review. Open Effects Lab → Zap and confirm:*
*1. Click Thunder, Tesla, Plasma — each visibly changes the effect (preset bug fixed)*
*2. Frequency slider — drag from 1 to 30, the flicker rate changes (frequency bug fixed)*
*3. Two color pickers labeled Blue and Red (per-hand color)*
*4. Mode is a chip row, not a dropdown*
*5. Pickers are circular swatches, not the browser's native rectangle*
*6. Sliders have accent-purple thumbs and monospace value readouts*

*Tell me what's good and what's not. If anything is off I'll fix it before tagging."*

- [ ] **Step 5: Tag the completion**

After user confirms all six fixes work:

```bash
git tag phase-1b-zap-polish-complete
```

- [ ] **Step 6: Update memory**

Update `C:\Users\Austen\.claude\projects\E--tka-platform\memory\project_effects_unification.md`:
- Move Phase 1b from "Queue" to a new "Phase 1b Status: COMPLETE" section above the Queue
- Update the "RESUME ANCHOR" to point to Phase 1c (Sparkles vertical slice — spec not yet written)
- Note the new tag `phase-1b-zap-polish-complete`

---

## Self-Review

**Spec coverage:**
1. ✅ Preset bug — Tasks 1-2
2. ✅ Per-hand color — Tasks 4-7, 9
3. ✅ Mode chip row — Task 8
4. ✅ Modern color picker — Task 8 (inlines TrailsCategory pattern)
5. ✅ Slider modernization — Task 8 (same)
6. ✅ Frequency slider no-op — Task 3

**Test plan from spec:**
- ✅ `migrations.test.ts` v2→v3 case — Task 4
- ✅ `canvas2d-translator.test.ts` per-hand color — Task 5
- ✅ Renderer test with two different colors — Task 6
- ✅ Visual verification — Tasks 2, 7, 8, 9, 10

**Non-goals confirmed deferred:**
- Crackle 3D parity (4 origins) — left as deferred item #1, with Task 7 step 5 adding a Phase-1b note
- FireTipTracker output aliasing — deferred item #2, untouched
- isAnyDarkModeEffectActive zap inclusion — deferred item #3, untouched
- Sequence viewer EffectsConfigState wiring — deferred item #4, untouched
- Math.log2 truncation — deferred item #5, untouched

**Type consistency:** `leftColor`/`rightColor` used identically across `EffectsConfig`, `defaults`, `migrations`, `Zap2DRenderer`, `EffectsLayer.svelte`, `ZapCustomize.svelte`, `zap-presets.ts`. Cache field renamed `prevZapIntentJson` → `prevZapIntentRef` consistently.
