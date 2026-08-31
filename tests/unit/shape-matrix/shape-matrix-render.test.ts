import { describe, expect, it } from "vitest";
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import {
  renderCell,
  renderHeader,
} from "$lib/shared/shape-matrix/services/shape-matrix-render";

const blue: MandalaPaths = {
  blue: [{ d: "M 0 0 C 10 0 10 10 20 10", tipIndex: 0 }],
  red: [],
  purple: [],
};

const red: MandalaPaths = {
  blue: [],
  red: [{ d: "M 0 0 C -10 0 -10 -10 -20 -10", tipIndex: 0 }],
  purple: [],
};

function decodeSvg(dataUrl: string): string {
  const prefix = "data:image/svg+xml;charset=utf-8,";
  expect(dataUrl.startsWith(prefix)).toBe(true);
  return decodeURIComponent(dataUrl.slice(prefix.length));
}

describe("shape matrix image rendering", () => {
  it("keeps combined cells resolution-independent", () => {
    const svg = decodeSvg(renderCell(blue, red, 128, 100));

    expect(svg).toContain('viewBox="0 0 128 128"');
    expect(svg).toContain(blue.blue[0]!.d);
    expect(svg).toContain(red.red[0]!.d);
  });

  it("keeps axis headers resolution-independent", () => {
    const svg = decodeSvg(renderHeader(blue, "blue", 128, 100));

    expect(svg).toContain('viewBox="0 0 128 128"');
    expect(svg).toContain(blue.blue[0]!.d);
  });
});
