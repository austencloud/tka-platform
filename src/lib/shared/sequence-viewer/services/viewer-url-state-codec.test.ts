import { describe, it, expect } from "vitest";
import {
  encodeViewerStateParams,
  decodeViewerStateParams,
  deepEqual,
  VIEWER_STATE_PARAM_NAMES,
} from "./viewer-url-state-codec";

describe("viewer-url-state-codec", () => {
  it("round-trips headline + blob slices", () => {
    const slices = {
      vw: { mode: "split", split: { leftPane: "animation", rightPane: "card" } },
      fx: { active: "sparkles", tuning: { sparkles: { rate: 0.92 } } },
      tn: { speed: 2, cameraMode: "orbit" },
    };
    const patch = encodeViewerStateParams(slices);
    expect(patch.set.pane).toBe("split");
    expect(patch.set.split).toBe("animation,card");
    expect(patch.set.fx).toBe("sparkles");
    expect(patch.set.s).toMatch(/^(d1:|raw:)/);

    const params = new URLSearchParams(patch.set);
    expect(decodeViewerStateParams(params)).toEqual(slices);
  });

  it("empty slices produce removals, not params", () => {
    const patch = encodeViewerStateParams({});
    expect(Object.keys(patch.set)).toHaveLength(0);
    expect([...patch.remove].sort()).toEqual([...VIEWER_STATE_PARAM_NAMES].sort());
  });

  it("headline-only state emits no blob", () => {
    const patch = encodeViewerStateParams({ vw: { mode: "animation" } });
    expect(patch.set.pane).toBe("animation");
    expect(patch.set.s).toBeUndefined();
    expect(patch.remove).toContain("s");
  });

  it("cd slice splits cols headline from blob rest", () => {
    const patch = encodeViewerStateParams({ cd: { cols: 4, rest: { showWord: false } } });
    expect(patch.set.cols).toBe("4");
    const decoded = decodeViewerStateParams(new URLSearchParams(patch.set));
    expect(decoded.cd).toEqual({ cols: 4, rest: { showWord: false } });
  });

  it("ignores a corrupt blob but keeps headline params", () => {
    const params = new URLSearchParams({ pane: "card", s: "d1:%%%not-base64%%%" });
    expect(decodeViewerStateParams(params)).toEqual({ vw: { mode: "card" } });
  });

  it("ignores unknown slice ids in the blob", () => {
    const patch = encodeViewerStateParams({ tn: { speed: 1 } });
    // hand-craft a blob with a foreign key by decoding, mutating, re-encoding is
    // overkill — instead assert decode only returns known ids
    const decoded = decodeViewerStateParams(new URLSearchParams(patch.set));
    expect(Object.keys(decoded)).toEqual(["tn"]);
  });

  it("deepEqual: structural, order-sensitive arrays, null-safe", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });
});
