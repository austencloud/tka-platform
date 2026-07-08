import { describe, it, expect } from "vitest";
import { orderQuickCombos } from "../loop-quick-combos";
import type { LOOPPreset } from "../../domain/constants/loop-presets";

const preset = (id: string, featured = false): LOOPPreset => ({
  id,
  name: id,
  description: "",
  useCase: "",
  components: [],
  difficulty: 1,
  icon: "rotate",
  featured,
});

describe("orderQuickCombos", () => {
  it("returns only featured presets when there are no favorites", () => {
    const presets = [preset("a", true), preset("b", false), preset("c", true)];
    expect(orderQuickCombos(presets, []).map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("sorts starred presets first, preserving featured order after", () => {
    const presets = [preset("a", true), preset("b", true), preset("c", true)];
    expect(orderQuickCombos(presets, ["b"]).map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("includes a starred preset even when it is not featured", () => {
    const presets = [preset("a", true), preset("b", false)];
    expect(orderQuickCombos(presets, ["b"]).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("does not duplicate a preset that is both starred and featured", () => {
    const presets = [preset("a", true), preset("b", true)];
    expect(orderQuickCombos(presets, ["a"]).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
