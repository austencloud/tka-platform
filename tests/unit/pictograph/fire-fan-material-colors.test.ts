import { describe, expect, it } from "vitest";

import { applyFanFrameColor } from "$lib/shared/pictograph/prop/domain/fan-appearance";

describe("physical fire-fan material colors", () => {
  it("colors the marked frame without repainting wicks or fitted covers", () => {
    const source = `<svg><g data-fan-frame="" fill="none" stroke="#2E3192"><path/></g><g data-fire-wick="1" fill="#f5e6b8"><rect/></g><g data-fan-cover="" fill="#df255f"><path/></g></svg>`;

    const colored = applyFanFrameColor(source, "#3575E2");

    expect(colored).toContain(
      '<g data-fan-frame="" fill="none" stroke="#3575E2">'
    );
    expect(colored).toContain('data-fire-wick="1" fill="#f5e6b8"');
    expect(colored).toContain('data-fan-cover="" fill="#df255f"');
  });
});
