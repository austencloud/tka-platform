import { describe, it, expect } from "vitest";
import { composeMenu } from "../compose-menu";
import type { ContextMenuEntry } from "../context-menu-types";

const item = (id: string): ContextMenuEntry => ({ id, label: id });
const sep = (): ContextMenuEntry => ({ type: "separator" });

describe("composeMenu", () => {
  it("drops empty sections entirely", () => {
    const out = composeMenu([
      { header: "Pictograph", entries: [] },
      { header: "Card", entries: [item("rerender")] },
    ]);
    expect(out).toEqual([item("rerender")]);
  });

  it("renders headers only when two or more sections survive", () => {
    const single = composeMenu([{ header: "Card", entries: [item("a")] }]);
    expect(single.some((e) => "type" in e && e.type === "header")).toBe(false);

    const double = composeMenu([
      { header: "Pictograph", entries: [item("a")] },
      { header: "Card", entries: [item("b")] },
    ]);
    expect(double).toEqual([
      { type: "header", label: "Pictograph" },
      item("a"),
      sep(),
      { type: "header", label: "Card" },
      item("b"),
    ]);
  });

  it("a section that is only separators counts as empty", () => {
    const out = composeMenu([
      { header: "Pictograph", entries: [sep(), sep()] },
      { header: "Card", entries: [item("a")] },
    ]);
    expect(out).toEqual([item("a")]);
  });

  it("strips leading/trailing separators inside sections, keeps interior ones", () => {
    const out = composeMenu([
      { header: "A", entries: [sep(), item("a1"), sep(), item("a2"), sep()] },
      { header: "B", entries: [item("b1")] },
    ]);
    expect(out).toEqual([
      { type: "header", label: "A" },
      item("a1"),
      sep(),
      item("a2"),
      sep(),
      { type: "header", label: "B" },
      item("b1"),
    ]);
  });

  it("sections without a header still get separator boundaries", () => {
    const out = composeMenu([
      { entries: [item("a")] },
      { entries: [item("b")] },
    ]);
    expect(out).toEqual([item("a"), sep(), item("b")]);
  });

  it("returns [] when nothing survives", () => {
    expect(composeMenu([{ header: "X", entries: [] }, { entries: [sep()] }])).toEqual([]);
  });
});
