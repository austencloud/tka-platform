import { describe, expect, it } from "vitest";
import { applyMotionColorToSvg } from "../src/svg-color.js";

const FAN_SVG = `
  <svg viewBox="0 0 260 207">
    <style>.st0{fill:#2E3192;}</style>
    <path class="st0" d="M0 0h10v10z"/>
  </svg>
`;

describe("applyMotionColorToSvg", () => {
  it("scopes duplicated prop classes by performer hand", () => {
    const left = applyMotionColorToSvg(FAN_SVG, "left", {
      makeClassNamesUnique: true,
    });
    const right = applyMotionColorToSvg(FAN_SVG, "right", {
      makeClassNamesUnique: true,
    });

    expect(left).toContain(".st0-left{fill:#3575E2;}");
    expect(left).toContain('class="st0-left"');
    expect(right).toContain(".st0-right{fill:#ED1C24;}");
    expect(right).toContain('class="st0-right"');
    expect(`${left}${right}`).not.toMatch(/class="st0"/);
  });
});
