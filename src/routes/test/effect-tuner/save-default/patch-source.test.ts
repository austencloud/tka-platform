import { describe, it, expect } from "vitest";
import {
  serialize,
  matchBrace,
  patchDefaultsBlock,
  patchPresetPatch,
} from "./patch-source";

const SAMPLE_DEFAULTS = `import type { EffectsConfig } from "./effects-config";

export const DEFAULT_EFFECTS_CONFIG: EffectsConfig = {
  version: 3,

  bloom: {
    intensity: 0.6,
    radius: 90,
    palette: ["#f472b6", "#fbbf24", "#22d3ee"],
    afterglow: 0.5,
  },

  water: {
    intensity: 0.6,
    palette: "classic",
  },
};
`;

const SAMPLE_PRESETS = `import type { EffectPreset } from "./types";

export const BLOOM_PRESETS: EffectPreset<"bloom">[] = [
  {
    id: "bloom-supernova",
    name: "Supernova",
    previewColor: "#ffffff",
    patch: {
      intensity: 1.0,
      radius: 120,
      colorMode: "prop-matched",
    },
  },
  {
    id: "bloom-comet",
    name: "Comet",
    previewColor: "#fbbf24",
    patch: {
      intensity: 0.95,
      radius: 95,
    },
  },
  {
    id: "trails-custom",
    name: "Custom",
    previewColor: "custom",
    resolvePatch: () => ({ blueColor: "#fff" }),
  },
];
`;

describe("serialize", () => {
  it("renders scalars, strings, arrays, objects, null", () => {
    expect(serialize(0.5)).toBe("0.5");
    expect(serialize(true)).toBe("true");
    expect(serialize("solid")).toBe('"solid"');
    expect(serialize(["#a", "#b"])).toBe('["#a", "#b"]');
    expect(serialize({ k: 1, c: "x" })).toBe('{ k: 1, c: "x" }');
    expect(serialize(null)).toBe("null");
  });
});

describe("patchDefaultsBlock", () => {
  it("swaps a field in the target block, leaves other blocks alone", () => {
    const { src } = patchDefaultsBlock(SAMPLE_DEFAULTS, "bloom", { intensity: 0.5 });
    expect(src).toContain("  bloom: {\n    intensity: 0.5,");
    // water.intensity must stay 0.6 — same field name, different block
    expect(src).toContain("  water: {\n    intensity: 0.6,");
  });

  it("swaps the LAST field without duplicating it (the end-of-slice anchor)", () => {
    const { src } = patchDefaultsBlock(SAMPLE_DEFAULTS, "bloom", { afterglow: 0.7 });
    expect(src).toContain("afterglow: 0.7,");
    expect(src).not.toContain("afterglow: 0.5,");
    expect(src.match(/afterglow:/g)).toHaveLength(1);
  });

  it("is idempotent when the value is unchanged", () => {
    const { src } = patchDefaultsBlock(SAMPLE_DEFAULTS, "bloom", { intensity: 0.6 });
    expect(src).toBe(SAMPLE_DEFAULTS);
  });

  it("serializes array values", () => {
    const { src } = patchDefaultsBlock(SAMPLE_DEFAULTS, "bloom", {
      palette: ["#000", "#111"],
    });
    expect(src).toContain('palette: ["#000", "#111"],');
  });

  it("appends a field absent from the source block", () => {
    const { src } = patchDefaultsBlock(SAMPLE_DEFAULTS, "bloom", { newField: 3 });
    expect(src).toContain("newField: 3,");
  });

  it("reports patched keys", () => {
    const { patched } = patchDefaultsBlock(SAMPLE_DEFAULTS, "bloom", {
      intensity: 0.5,
      radius: 80,
    });
    expect(patched).toEqual(["intensity", "radius"]);
  });

  it("throws on an unknown effect block", () => {
    expect(() => patchDefaultsBlock(SAMPLE_DEFAULTS, "nope", { x: 1 })).toThrow();
  });
});

describe("matchBrace", () => {
  it("matches a flat object", () => {
    const s = "x = { a: 1 };";
    expect(matchBrace(s, 4)).toBe(s.indexOf("}"));
  });

  it("matches through nesting and ignores braces inside strings", () => {
    const s = '{ a: { b: 1 }, c: "}" }';
    // last char is the matching close brace
    expect(matchBrace(s, 0)).toBe(s.length - 1);
  });

  it("throws when the open index is not a brace", () => {
    expect(() => matchBrace("abc", 0)).toThrow();
  });

  it("throws on unbalanced braces", () => {
    expect(() => matchBrace("{ a: { b: 1 }", 0)).toThrow();
  });
});

describe("patchPresetPatch", () => {
  it("replaces the target preset's patch, leaving siblings + metadata intact", () => {
    const out = patchPresetPatch(SAMPLE_PRESETS, "bloom-supernova", {
      intensity: 0.5,
      radius: 90,
      colorMode: "solid",
    });
    expect(out).toContain(
      'patch: {\n      intensity: 0.5,\n      radius: 90,\n      colorMode: "solid",\n    }',
    );
    expect(out).toContain('name: "Supernova"'); // metadata untouched
    expect(out).toContain("intensity: 0.95,"); // comet's patch untouched
  });

  it("throws on an unknown preset id", () => {
    expect(() => patchPresetPatch(SAMPLE_PRESETS, "bloom-nope", { x: 1 })).toThrow();
  });

  it("throws on a resolvePatch-only preset (no static patch)", () => {
    expect(() => patchPresetPatch(SAMPLE_PRESETS, "trails-custom", { x: 1 })).toThrow();
  });

  it("throws when a patchless preset precedes a patched sibling", () => {
    const patchlessMiddle = `[
  {
    id: "a",
    name: "A",
  },
  {
    id: "b",
    name: "B",
    patch: {
      x: 1,
    },
  },
];`;
    expect(() => patchPresetPatch(patchlessMiddle, "a", { x: 2 })).toThrow();
  });
});
