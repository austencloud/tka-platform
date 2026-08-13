import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const popoverSource = readFileSync(
  resolve(process.cwd(), "src/lib/shared/3d/components/PlanesPopover.svelte"),
  "utf8"
);

describe("PlanesPopover group scope contract", () => {
  it("routes hand-plane clicks through the scoped performer writer", () => {
    const handler = popoverSource.match(
      /function handleHandSlotClick[\s\S]*?reportViewerControlChange\(/
    )?.[0];

    expect(handler).toContain("viewer.setHandPlaneScoped(hand, plane)");
    expect(handler).not.toContain("viewer.setDefaultHandPlane(hand, plane)");
  });

  it("reads the shared effective plane in All Performers mode", () => {
    expect(popoverSource).toContain('? sharedPlane("blue")');
    expect(popoverSource).toContain('? sharedPlane("red")');
  });
});
