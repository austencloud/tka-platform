import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import type { ReflectionAxis } from "@tka/sequence-engine/loop";
import LoopBlockTimeline from "./LoopBlockTimeline.svelte";

const cases: Array<{
  axis: ReflectionAxis;
  component: "mirrored" | "flipped";
  rotation: number;
  scale: number;
}> = [
  {
    axis: "north-south",
    component: "mirrored",
    rotation: 0,
    scale: 1,
  },
  {
    axis: "east-west",
    component: "flipped",
    rotation: 90,
    scale: 1,
  },
  {
    axis: "northeast-southwest",
    component: "mirrored",
    rotation: 45,
    scale: Math.SQRT1_2,
  },
  {
    axis: "northwest-southeast",
    component: "mirrored",
    rotation: -45,
    scale: Math.SQRT1_2,
  },
];

describe("LoopBlockTimeline reflection icons", () => {
  it.each(cases)(
    "renders $axis as the shared purple Reflection glyph",
    ({ axis, component, rotation, scale }) => {
      const view = render(LoopBlockTimeline, {
        model: {
          cells: [new Set([component])],
          reflectionAxes: { [component]: axis },
        },
      });

      const icon = document.querySelector(".cell i") as HTMLElement;
      expect(icon.classList.contains("fa-left-right")).toBe(true);
      expect(icon.style.color).toBe("rgb(111, 45, 168)");
      expect(icon.style.transform).toContain(`rotate(${rotation}deg)`);
      const renderedScale = Number(
        icon.style.transform.match(/scale\(([^)]+)\)/)?.[1]
      );
      expect(renderedScale).toBeCloseTo(scale, 5);

      view.unmount();
    }
  );
});
