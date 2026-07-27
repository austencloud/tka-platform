import { describe, expect, it } from "vitest";
import { applyMotionColorToSvg } from "../src/svg-color.js";

const FAN_SVG = `
  <svg viewBox="0 0 260 207">
    <style>.st0{fill:#2E3192;}</style>
    <path class="st0" d="M0 0h10v10z"/>
  </svg>
`;

describe("applyMotionColorToSvg", () => {
  it("scopes duplicated prop classes by motion color", () => {
    const blue = applyMotionColorToSvg(FAN_SVG, "blue", {
      makeClassNamesUnique: true,
    });
    const red = applyMotionColorToSvg(FAN_SVG, "red", {
      makeClassNamesUnique: true,
    });

    expect(blue).toContain(".st0-blue{fill:#3575E2;}");
    expect(blue).toContain('class="st0-blue"');
    expect(red).toContain(".st0-red{fill:#ED1C24;}");
    expect(red).toContain('class="st0-red"');
    expect(`${blue}${red}`).not.toMatch(/class="st0"/);
  });
});
