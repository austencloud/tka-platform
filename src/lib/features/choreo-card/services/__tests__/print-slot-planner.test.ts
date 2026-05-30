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
    expect(slots[0]!.pair?.label).toBe("water1");
    expect(slots[0]!.elementName).toBe("water");
    expect(slots[1]!.pair).toBeNull();
    expect(slots[1]!.elementName).toBe("water");
    expect(slots[9]!.pair?.label).toBe("fire1");
    expect(slots[9]!.elementName).toBe("fire");
  });

  it("whole-block repeats each color N times (not per-card runs)", () => {
    const pairs = [pair("a"), pair("b")];
    const elements = [EL("fire"), EL("fire")];
    const slots = planPrintSlots(pairs, elements, 3, 9);

    const labels = slots.slice(0, 6).map((s) => s.pair?.label);
    expect(labels).toEqual(["a", "b", "a", "b", "a", "b"]);
    expect(slots.length).toBe(9);
    expect(slots[6]!.pair).toBeNull();
  });

  it("puts untagged cards in a trailing bucket with null elementName", () => {
    const pairs = [pair("u1"), pair("fire1")];
    const elements = [undefined, EL("fire")];
    const slots = planPrintSlots(pairs, elements, 1, 9);

    expect(slots[0]!.pair?.label).toBe("fire1");
    expect(slots[9]!.pair?.label).toBe("u1");
    expect(slots[9]!.elementName).toBeNull();
  });

  it("copies < 1 is clamped to 1", () => {
    const slots = planPrintSlots([pair("a")], [EL("fire")], 0, 9);
    expect(slots.filter((s) => s.pair).length).toBe(1);
  });

  it("passes through with no element data (single padded bucket)", () => {
    const pairs = [pair("a"), pair("b")];
    const slots = planPrintSlots(pairs, [], 1, 9);
    expect(slots.length).toBe(9);
    expect(slots.slice(0, 2).map((s) => s.pair?.label)).toEqual(["a", "b"]);
    expect(slots[0]!.elementName).toBeNull();
  });
});
