import { describe, it, expect } from "vitest";
import { createSelectionStore } from "../selection-store.svelte";

describe("createSelectionStore", () => {
  it("starts empty", () => {
    const s = createSelectionStore();
    expect(s.isSelected("a")).toBe(false);
    expect(s.selectedIds.size).toBe(0);
  });

  it("select(id) marks id as selected", () => {
    const s = createSelectionStore();
    s.select("a");
    expect(s.isSelected("a")).toBe(true);
  });

  it("select replaces prior selection by default", () => {
    const s = createSelectionStore();
    s.select("a");
    s.select("b");
    expect(s.isSelected("a")).toBe(false);
    expect(s.isSelected("b")).toBe(true);
  });

  it("select({ additive: true }) preserves prior selection", () => {
    const s = createSelectionStore();
    s.select("a");
    s.select("b", { additive: true });
    expect(s.isSelected("a")).toBe(true);
    expect(s.isSelected("b")).toBe(true);
  });

  it("deselect removes a specific id", () => {
    const s = createSelectionStore();
    s.select("a", { additive: true });
    s.select("b", { additive: true });
    s.deselect("a");
    expect(s.isSelected("a")).toBe(false);
    expect(s.isSelected("b")).toBe(true);
  });

  it("clear removes all selection", () => {
    const s = createSelectionStore();
    s.select("a", { additive: true });
    s.select("b", { additive: true });
    s.clear();
    expect(s.isSelected("a")).toBe(false);
    expect(s.isSelected("b")).toBe(false);
    expect(s.selectedIds.size).toBe(0);
  });

  it("isolates selection between independent instances", () => {
    const a = createSelectionStore();
    const b = createSelectionStore();
    a.select("x");
    expect(a.isSelected("x")).toBe(true);
    expect(b.isSelected("x")).toBe(false);
  });
});
