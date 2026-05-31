// src/lib/features/choreo-card/services/__tests__/print-slot-planner.test.ts
import { describe, it, expect } from "vitest";
import { planPrintSlots } from "../print-slot-planner";
import type { CardPair } from "../types";
import { TND_ELEMENTS, type TnDElement } from "../../domain/tnd-element";

// Sentinel pairs — the planner never touches canvas internals, so fakes suffice.
function pair(label: string): CardPair {
  return { front: { label } as unknown as HTMLCanvasElement, back: {} as HTMLCanvasElement, label };
}
const EL = (element: string) => TND_ELEMENTS.find((e) => e.element === element)! as TnDElement;

describe("planPrintSlots", () => {
  it("groups by fixed TND_ELEMENTS order and pads each color to whole sheets", () => {
    const pairs = [pair("fire1"), pair("water1")];
    const elements = [EL("fire"), EL("water")];
    const slots = planPrintSlots(pairs, elements, 1, 9);

    expect(slots.length).toBe(18);
    expect(slots[0]!.item?.label).toBe("water1");
    expect(slots[0]!.elementName).toBe("water");
    expect(slots[1]!.item).toBeNull();
    expect(slots[1]!.elementName).toBe("water");
    expect(slots[9]!.item?.label).toBe("fire1");
    expect(slots[9]!.elementName).toBe("fire");
  });

  it("cut-collates: each card repeated N times consecutively", () => {
    const pairs = [pair("a"), pair("b")];
    const elements = [EL("fire"), EL("fire")];
    const slots = planPrintSlots(pairs, elements, 3, 9);

    const labels = slots.slice(0, 6).map((s) => s.item?.label);
    expect(labels).toEqual(["a", "a", "a", "b", "b", "b"]);
    expect(slots.length).toBe(9);
    expect(slots[6]!.item).toBeNull();
  });

  it("puts untagged cards in a trailing bucket with null elementName", () => {
    const pairs = [pair("u1"), pair("fire1")];
    const elements = [undefined, EL("fire")];
    const slots = planPrintSlots(pairs, elements, 1, 9);

    expect(slots[0]!.item?.label).toBe("fire1");
    expect(slots[9]!.item?.label).toBe("u1");
    expect(slots[9]!.elementName).toBeNull();
  });

  it("cut-collation: when copies == cardsPerPage, each page has one card repeated", () => {
    const pairs = [pair("A"), pair("B"), pair("C")];
    const elements = [EL("water"), EL("water"), EL("water")];
    const slots = planPrintSlots(pairs, elements, 9, 9);

    // 3 cards × 9 copies = 27 slots = 3 pages of 9
    expect(slots.length).toBe(27);
    // Page 1: all A
    expect(slots.slice(0, 9).every((s) => s.item?.label === "A")).toBe(true);
    // Page 2: all B
    expect(slots.slice(9, 18).every((s) => s.item?.label === "B")).toBe(true);
    // Page 3: all C
    expect(slots.slice(18, 27).every((s) => s.item?.label === "C")).toBe(true);
  });

  it("copies < 1 is clamped to 1", () => {
    const slots = planPrintSlots([pair("a")], [EL("fire")], 0, 9);
    expect(slots.filter((s) => s.item).length).toBe(1);
  });

  it("passes through with no element data (single padded bucket)", () => {
    const pairs = [pair("a"), pair("b")];
    const slots = planPrintSlots(pairs, [], 1, 9);
    expect(slots.length).toBe(9);
    expect(slots.slice(0, 2).map((s) => s.item?.label)).toEqual(["a", "b"]);
    expect(slots[0]!.elementName).toBeNull();
  });

  describe("groupByElement=false (normal fill)", () => {
    it("ignores element grouping and pads only the final sheet", () => {
      const pairs = [pair("fire1"), pair("water1"), pair("water2")];
      const elements = [EL("fire"), EL("water"), EL("water")];
      const slots = planPrintSlots(pairs, elements, 1, 9, false);

      // 3 cards → one sheet, no inter-color blanks, source order preserved.
      expect(slots.length).toBe(9);
      expect(slots.slice(0, 3).map((s) => s.item?.label)).toEqual(["fire1", "water1", "water2"]);
      expect(slots[3]!.item).toBeNull();
      expect(slots.every((s) => s.elementName === null)).toBe(true);
    });

    it("cut-collates: each card repeated N times consecutively", () => {
      const pairs = [pair("a"), pair("b")];
      const slots = planPrintSlots(pairs, [EL("fire"), EL("water")], 2, 9, false);

      expect(slots.slice(0, 4).map((s) => s.item?.label)).toEqual(["a", "a", "b", "b"]);
      expect(slots.length).toBe(9);
      expect(slots[4]!.item).toBeNull();
    });

    it("fills whole sheets with no blanks when the count divides evenly", () => {
      const pairs = Array.from({ length: 9 }, (_, i) => pair(`c${i}`));
      const slots = planPrintSlots(pairs, [], 1, 9, false);
      expect(slots.length).toBe(9);
      expect(slots.every((s) => s.item)).toBe(true);
    });
  });
});
