import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const workspaceGrid = source(
  "src/lib/features/create/shared/workspace-panel/sequence-display/components/WorkspaceGrid.svelte"
);
const sequenceDisplay = source(
  "src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte"
);
const coordinator = source(
  "src/lib/features/create/shared/components/coordinators/StepEditorCoordinator.svelte"
);
const mandalaPanel = source(
  "src/lib/features/create/shared/components/sequence-actions/MandalaViewerPanel.svelte"
);

describe("Create workspace mandala viewer contract", () => {
  it("makes both workspace mandala layouts accessible click targets", () => {
    expect(workspaceGrid.match(/aria-label="Open mandala"/g)).toHaveLength(2);
    expect(workspaceGrid.match(/{#if onMandalaClick}/g)).toHaveLength(2);
    expect(workspaceGrid.match(/onclick=\{\(\) => onMandalaClick\(/g)).toHaveLength(2);
  });

  it("routes the click through panel state and reuses the editor drawer", () => {
    expect(sequenceDisplay).toContain("panelState.openMandalaViewer");
    expect(coordinator.match(/<CreatePanelDrawer/g)).toHaveLength(1);
    expect(coordinator).toContain("<Crossfade key={drawerMode}");
    expect(coordinator).toContain("<MandalaViewerPanel");
  });

  it("uses the shared animated pane and collection save path", () => {
    expect(mandalaPanel).toContain("<MandalaPane");
    expect(mandalaPanel).toContain("show={displayedVariant}");
    expect(mandalaPanel).toContain("showDownload={false}");
    expect(mandalaPanel).toContain("saveMandalaToCollection");
  });

  it("offers explicit motion and mandala-color selectors", () => {
    expect(mandalaPanel).toContain("<SegmentedControl");
    expect(mandalaPanel).toContain('{ value: "static", label: "Static" }');
    expect(mandalaPanel).toContain('{ value: "animated", label: "Animated" }');
    expect(mandalaPanel).toContain("<HandSelector");
    expect(mandalaPanel).toContain(
      'labels={{ blue: "Blue", both: "Purple", red: "Red" }}',
    );
    expect(mandalaPanel).toContain("variant: displayedVariant");
  });
});
