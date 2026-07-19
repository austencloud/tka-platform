import { describe, it, expect, vi } from "vitest";

// getBaseMotionColors pulls the SVG generator chain; stub it to keep the
// import light, same as prop-type-manager.layers.test.ts. Not exercised by
// these tests (only additionalLayerColors calls it).
vi.mock("../svg-generator", () => ({
  getBaseMotionColors: () => ({ blue: "#1111ff", red: "#ff1111" }),
}));

import { PropTypeManager } from "../prop-type-manager";
import { PropTypeChanger } from "../prop-type-changer.svelte";

/**
 * Regression/behavior guard for the hero-act prop crossfade (2026-07-19
 * design, section A): PropTypeManager must start the renderer's per-color
 * morph fade ONLY on a genuine hot-swap — never on the first-ever override
 * assignment (mount) and never for a color whose type didn't actually change.
 * loadPropTextures reloads both colors together regardless, but the fade
 * itself must be independent per color.
 *
 * Relocated into __tests__/ (2026-07-19, round 2) — the project's real
 * vitest config (tests/config/vitest.config.ts) only includes
 * "src/**\/__tests__/**\/*.test.ts"; a sibling *.test.ts file next to the
 * source (the original location, and prop-type-manager.layers.test.ts's
 * convention) never matches that glob and silently never runs under
 * `npm run test`. Confirmed via `vitest run --config tests/config/vitest.config.ts
 * <path>` reporting "No test files found" for the old location.
 */

// Minimal AnimatorState double: a mutable current-type pair plus the setters
// PropTypeManager calls. Real AnimatorState is a much larger interface; only
// the members handleOverrides/handleSettingsChange/loadPropTextures touch are
// needed here.
function makeState(initialBlue: string, initialRed: string) {
  let blue = initialBlue;
  let red = initialRed;
  return {
    get currentBluePropType() {
      return blue;
    },
    get currentRedPropType() {
      return red;
    },
    setBluePropType: (v: string) => {
      blue = v;
    },
    setRedPropType: (v: string) => {
      red = v;
    },
    setLegacyPropType: () => {},
    setBluePropDimensions: () => {},
    setRedPropDimensions: () => {},
    isInitialized: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeManager(opts?: { propTypeChangeService?: PropTypeChanger }) {
  const renderer = {
    startBluePropMorphFade: vi.fn(),
    startRedPropMorphFade: vi.fn(),
  };
  const ptm = new PropTypeManager();
  ptm.wire({
    settingsService: null,
    propTextureService: null, // loadPropTextures early-returns; nothing to load
    trailCapturer: null,
    renderLoopService: null,
    precomputationService: null,
    propTypeChangeService: opts?.propTypeChangeService ?? null,
    fireTipTracker: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    animationRenderer: renderer as any,
  });
  return { ptm, renderer };
}

const getFrameParams = () => ({}) as never;

/** loadPropTextures resolves on the next microtask (propTextureService is
 *  null, so it hits the early `return;`); flush that before asserting. */
async function flushHotSwap() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("PropTypeManager.handleOverrides morph-fade trigger", () => {
  it("does not fade on the very first override assignment (mount)", async () => {
    const { ptm, renderer } = makeManager();
    const state = makeState("staff", "staff");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ptm.handleOverrides({ bluePropType: "fan", redPropType: "fan" } as any, state, getFrameParams, false);
    await flushHotSwap();

    expect(renderer.startBluePropMorphFade).not.toHaveBeenCalled();
    expect(renderer.startRedPropMorphFade).not.toHaveBeenCalled();
  });

  it("fades only the color that actually changed on a later hot-swap", async () => {
    const { ptm, renderer } = makeManager();
    const state = makeState("staff", "staff");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ptm.handleOverrides({ bluePropType: "fan", redPropType: "fan" } as any, state, getFrameParams, false);
    await flushHotSwap();
    renderer.startBluePropMorphFade.mockClear();
    renderer.startRedPropMorphFade.mockClear();

    // Blue changes fan -> club; red stays fan.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ptm.handleOverrides({ bluePropType: "club", redPropType: "fan" } as any, state, getFrameParams, false);
    await flushHotSwap();

    expect(renderer.startBluePropMorphFade).toHaveBeenCalledTimes(1);
    expect(renderer.startRedPropMorphFade).not.toHaveBeenCalled();
  });

  it("fades both colors when both change together", async () => {
    const { ptm, renderer } = makeManager();
    const state = makeState("staff", "staff");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ptm.handleOverrides({ bluePropType: "fan", redPropType: "fan" } as any, state, getFrameParams, false);
    await flushHotSwap();
    renderer.startBluePropMorphFade.mockClear();
    renderer.startRedPropMorphFade.mockClear();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ptm.handleOverrides({ bluePropType: "club", redPropType: "buugeng" } as any, state, getFrameParams, false);
    await flushHotSwap();

    expect(renderer.startBluePropMorphFade).toHaveBeenCalledTimes(1);
    expect(renderer.startRedPropMorphFade).toHaveBeenCalledTimes(1);
  });

  it("does not fade when nothing actually changed (handleOverrides returns false)", async () => {
    const { ptm, renderer } = makeManager();
    const state = makeState("staff", "staff");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ptm.handleOverrides({ bluePropType: "fan", redPropType: "fan" } as any, state, getFrameParams, false);
    await flushHotSwap();
    renderer.startBluePropMorphFade.mockClear();
    renderer.startRedPropMorphFade.mockClear();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const changed = ptm.handleOverrides({ bluePropType: "fan", redPropType: "fan" } as any, state, getFrameParams, false);
    await flushHotSwap();

    expect(changed).toBe(false);
    expect(renderer.startBluePropMorphFade).not.toHaveBeenCalled();
    expect(renderer.startRedPropMorphFade).not.toHaveBeenCalled();
  });
});

describe("PropTypeManager.handleSettingsChange morph-fade trigger", () => {
  it("does not fade when settings already match AnimatorState at mount", async () => {
    const propTypeChangeService = new PropTypeChanger();
    const { ptm, renderer } = makeManager({ propTypeChangeService });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ptm as any).settingsService = {
      currentSettings: { bluePropType: "club", redPropType: "club", propType: "club" },
    };

    // Simulates the true initial load already having synced AnimatorState to
    // "club" (via the direct loadTextures path) before handleSettingsChange
    // ever runs — PropTypeChanger's own internal cache still defaults to
    // "staff", so it WILL fire a reload signal, but nothing should fade since
    // the visible prop isn't actually changing.
    const state = makeState("club", "club");

    ptm.handleSettingsChange(state, getFrameParams, false);
    await flushHotSwap();

    expect(renderer.startBluePropMorphFade).not.toHaveBeenCalled();
    expect(renderer.startRedPropMorphFade).not.toHaveBeenCalled();
  });

  it("fades only the color that genuinely changed via settings", async () => {
    const propTypeChangeService = new PropTypeChanger();
    const { ptm, renderer } = makeManager({ propTypeChangeService });
    const settingsService: { currentSettings: Record<string, string> } = {
      currentSettings: { bluePropType: "club", redPropType: "club", propType: "club" },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ptm as any).settingsService = settingsService;

    const state = makeState("club", "club");

    // Mount-time sync (see previous test) — not under test here.
    ptm.handleSettingsChange(state, getFrameParams, false);
    await flushHotSwap();
    renderer.startBluePropMorphFade.mockClear();
    renderer.startRedPropMorphFade.mockClear();

    // Genuine change: red only, club -> fan.
    settingsService.currentSettings = { bluePropType: "club", redPropType: "fan", propType: "club" };
    ptm.handleSettingsChange(state, getFrameParams, false);
    await flushHotSwap();

    expect(renderer.startBluePropMorphFade).not.toHaveBeenCalled();
    expect(renderer.startRedPropMorphFade).toHaveBeenCalledTimes(1);
  });
});
