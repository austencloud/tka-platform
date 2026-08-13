import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("Fuse sequence actions contract", () => {
  it("composes the canonical transform grid instead of owning another action list", () => {
    const popover = read(
      "src/lib/features/fuse/components/FuseSourceActionPopover.svelte"
    );
    const createPanel = read(
      "src/lib/features/create/shared/components/sequence-actions/SequenceActionsPanel.svelte"
    );

    expect(popover).toContain(
      'import SequenceTransformActions from "$lib/shared/create/components/SequenceTransformActions.svelte"'
    );
    expect(createPanel).toContain(
      'import SequenceTransformActions from "$lib/shared/create/components/SequenceTransformActions.svelte"'
    );
    expect(popover).toContain("<SequenceTransformActions");
    expect(popover).toContain("rotationDegrees={90}");
    expect(popover).toContain('shiftStartPlacement="transform"');
    expect(popover).not.toContain("onRewind=");
    expect(popover).not.toContain("onSwap=");
    expect(popover).not.toContain("onDuration=");
  });

  it("uses the visible source card as the desktop first-step picker", () => {
    const layout = read("src/lib/features/fuse/components/FuseLayout.svelte");
    const card = read("src/lib/features/fuse/components/FuseSourceCard.svelte");

    expect(layout).toContain("inlineFirstStepSide");
    expect(layout).toContain("firstStepPickerActive={inlineFirstStepSide");
    expect(card).toContain("<FuseSourceActionPopover");
    expect(card).toContain("onStepClick={firstStepPickerActive");
    expect(card).toContain('kind: "first-step"');
  });
});
