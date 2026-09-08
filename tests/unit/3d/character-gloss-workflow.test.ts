/**
 * Every Mixamo non-PBR intake measured on 2026-09-05 (Kate, Leonard, Michelle)
 * carried a metallic-roughness sheet named `*_Glossiness` whose blue channel
 * averaged 254-255 and whose green averaged 59-109, under a 0.5 metallic
 * factor. Cotton rendered as half-metal latex in the bake-off. The pass turns
 * glossiness into roughness and clears metal for that export family only.
 */
import { describe, expect, it } from "vitest";

import {
  convertGlossToRoughness,
  isGlossinessImageName,
} from "../../../scripts/lib/character-gloss-workflow.mjs";

describe("isGlossinessImageName", () => {
  it("recognises the Mixamo sheet name and ignores true metallic-roughness maps", () => {
    expect(isGlossinessImageName("Ch31_1001_Glossiness")).toBe(true);
    expect(isGlossinessImageName("gloss.webp")).toBe(true);
    expect(isGlossinessImageName("metallic_roughness")).toBe(false);
    expect(isGlossinessImageName(undefined)).toBe(false);
  });
});

describe("convertGlossToRoughness", () => {
  it("inverts the glossiness channel and clears metal, leaving red and alpha alone", () => {
    // Leonard's sweater: bright gloss on a saturated metal channel.
    const raw = new Uint8Array([255, 59, 255, 255, 12, 200, 254, 128]);
    convertGlossToRoughness(raw, 4);
    expect(Array.from(raw)).toEqual([255, 196, 0, 255, 12, 55, 0, 128]);
  });

  it("handles three-channel buffers", () => {
    const raw = new Uint8Array([1, 0, 9, 2, 255, 9]);
    convertGlossToRoughness(raw, 3);
    expect(Array.from(raw)).toEqual([1, 255, 0, 2, 0, 0]);
  });

  it("refuses a single-channel buffer", () => {
    expect(() => convertGlossToRoughness(new Uint8Array(4), 1)).toThrow(
      "three channels"
    );
  });
});
