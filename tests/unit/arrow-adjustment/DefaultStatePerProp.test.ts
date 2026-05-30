import { describe, it, expect } from "vitest";
import { createDefaultArrowPlacementState } from "$lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte";

describe("default state per-prop isolation", () => {
  it("stores and reads a value under its propType", () => {
    const s = createDefaultArrowPlacementState();
    s.setValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0", [3, 4], "me");
    expect(s.getValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0")).toEqual([3, 4]);
  });

  it("does not bleed a fan value into staff", () => {
    const s = createDefaultArrowPlacementState();
    s.setValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0", [3, 4], "me");
    expect(s.getValue("diamond", "staff", "pro", "pro_to_layer1_alpha", "0")).toBeNull();
  });

  it("removeValue clears only the targeted prop", () => {
    const s = createDefaultArrowPlacementState();
    s.setValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0", [3, 4], "me");
    s.setValue("diamond", "staff", "pro", "pro_to_layer1_alpha", "0", [9, 9], "me");
    s.removeValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0");
    expect(s.getValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0")).toBeNull();
    expect(s.getValue("diamond", "staff", "pro", "pro_to_layer1_alpha", "0")).toEqual([9, 9]);
  });
});
