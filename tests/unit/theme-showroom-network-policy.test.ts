import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const showroomSource = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/shared/settings/components/tabs/background/showroom/ThemeShowroom.svelte"
  ),
  "utf8"
);

describe("theme showroom network policy", () => {
  it("keeps live scenes available when only Chrome's connection estimate is slow", () => {
    expect(showroomSource).toContain("prefersReducedData()");
    expect(showroomSource).not.toContain("isConstrainedConnection");
  });
});
