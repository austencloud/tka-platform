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

  it("keeps phone source actions compact and opens the canonical card viewer", () => {
    const card = read("src/lib/features/fuse/components/FuseSourceCard.svelte");
    const popover = read(
      "src/lib/features/fuse/components/FuseSourceActionPopover.svelte"
    );
    const navigator = read(
      "src/lib/shared/sequence-viewer/services/sequence-viewer-navigator.ts"
    );
    const overlayState = read(
      "src/lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte.ts"
    );
    const drawerHost = read(
      "src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte"
    );

    expect(card).toContain('label: "View Choreo Card"');
    expect(card).toContain('initialViewMode: "image"');
    expect(card).toContain("compactTrigger={true}");
    expect(popover).toContain("compactTrigger?: boolean");
    expect(navigator).toContain("initialViewMode: options.initialViewMode");
    expect(overlayState).toContain(
      "_initialViewMode = options?.initialViewMode"
    );
    expect(drawerHost).toContain("initialViewMode={overlay.initialViewMode}");

    const compactMenu = card.slice(
      card.indexOf("const compactSourceMenuItems"),
      card.indexOf("</script>")
    );
    expect(compactMenu).not.toContain('label: "Regenerate path"');
    expect(compactMenu).not.toContain('label: "Mirror path"');
    expect(compactMenu).not.toContain('label: "Choose first step"');
  });

  it("reserves readable width for the desktop tempo control", () => {
    const preview = read(
      "src/lib/features/fuse/components/FusePreviewStage.svelte"
    );

    expect(preview).toContain(
      "grid-template-columns: clamp(110px, 14cqw, 180px) minmax(0, 1fr)"
    );
    expect(preview).toContain("min-width: 110px");
    expect(preview).toContain("@container fuse-preview (max-width: 620px)");
    expect(preview).toContain('"tempo save viewer"');
  });
});
