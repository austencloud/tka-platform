import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateGridLayout,
  calculateGridVerticalCenterOffset,
} from "../../src/lib/shared/create/utils/grid-calculations";
import {
  WORKSPACE_BUTTON_LAYOUT,
  WORKSPACE_BUTTON_ICON,
  WORKSPACE_BUTTON_TUTORIAL,
  workspaceButtonsInZone,
} from "../../src/lib/features/create/shared/workspace-panel/shared/workspace-button-layout";

const workspaceGridSource = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/features/create/shared/workspace-panel/sequence-display/components/WorkspaceGrid.svelte"
  ),
  "utf8"
);
const buttonPanelSource = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/features/create/shared/workspace-panel/shared/components/ButtonPanel.svelte"
  ),
  "utf8"
);
const sequenceDisplaySource = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte"
  ),
  "utf8"
);
const standardWorkspaceSource = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/features/create/shared/components/StandardWorkspaceLayout.svelte"
  ),
  "utf8"
);
const drawerLauncherSource = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/features/create/shared/components/coordinators/SequenceDrawerLauncher.svelte"
  ),
  "utf8"
);

describe("calculateGridLayout workspace column selection", () => {
  it("uses four step columns when a tall workspace makes them larger", () => {
    const layout = calculateGridLayout(16, 719, 450, null);
    const forcedWideLayout = calculateGridLayout(16, 719, 450, null, {
      manualColumnCount: 8,
    });

    expect(layout.columns).toBe(4);
    expect(layout.rows).toBe(4);
    expect(layout.cellSize).toBeGreaterThan(forcedWideLayout.cellSize);
  });

  it("uses eight step columns when a short workspace makes them larger", () => {
    const layout = calculateGridLayout(16, 900, 250, null);
    const forcedStandardLayout = calculateGridLayout(16, 900, 250, null, {
      manualColumnCount: 4,
    });

    expect(layout.columns).toBe(8);
    expect(layout.rows).toBe(2);
    expect(layout.cellSize).toBeGreaterThan(forcedStandardLayout.cellSize);
  });

  it("preserves an explicit LOOP-aligned column count", () => {
    const layout = calculateGridLayout(16, 719, 450, null, {
      manualColumnCount: 8,
    });

    expect(layout.columns).toBe(8);
    expect(layout.rows).toBe(2);
  });

  it("keeps wide Construct sequences at four columns without resizing for new rows", () => {
    const fourRows = calculateGridLayout(16, 900, 250, null, {
      stableColumnCount: 4,
    });
    const fiveRows = calculateGridLayout(20, 900, 250, null, {
      stableColumnCount: 4,
    });

    expect(fourRows.columns).toBe(4);
    expect(fiveRows.columns).toBe(4);
    expect(fourRows.rows).toBe(4);
    expect(fiveRows.rows).toBe(5);
    expect(fiveRows.cellSize).toBe(fourRows.cellSize);
  });

  it("puts a four-step non-LOOP sequence on one wide row", () => {
    const layout = calculateGridLayout(4, 900, 450, null, {
      stableColumnCount: 4,
    });

    expect(layout.columns).toBe(4);
    expect(layout.rows).toBe(1);
  });

  it("lets explicit LOOP alignment override the stable Construct columns", () => {
    const layout = calculateGridLayout(20, 900, 450, null, {
      stableColumnCount: 4,
      manualColumnCount: 5,
    });

    expect(layout.columns).toBe(5);
    expect(layout.rows).toBe(4);
  });

  it("keeps the existing responsive policy below the wide-workspace threshold", () => {
    const layout = calculateGridLayout(4, 500, 450, null, {
      stableColumnCount: 4,
    });

    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(2);
  });

  it("keeps the wide layout for sequences that exceed the fit-all row limit", () => {
    const layout = calculateGridLayout(40, 719, 450, null);

    expect(layout.columns).toBe(8);
    expect(layout.rows).toBe(5);
  });

  it("keeps Assemble pictographs readable in a narrow, shallow workspace", () => {
    const defaultLayout = calculateGridLayout(5, 295, 120, null);
    const assembleLayout = calculateGridLayout(5, 295, 120, null, {
      narrowMaxColumns: 2,
      preferWidthSizingOnNarrow: true,
    });

    expect(assembleLayout.columns).toBe(2);
    expect(assembleLayout.rows).toBe(3);
    expect(assembleLayout.cellSize).toBeGreaterThanOrEqual(88);
    expect(assembleLayout.cellSize).toBeGreaterThan(defaultLayout.cellSize);
  });

  it("caps LOOP alignment when Assemble needs larger mobile cells", () => {
    const layout = calculateGridLayout(8, 320, 180, null, {
      manualColumnCount: 4,
      narrowMaxColumns: 2,
      preferWidthSizingOnNarrow: true,
    });

    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(4);
  });
});

describe("workspace grid vertical centering", () => {
  it("moves existing rows upward by half a cell when a new row is added", () => {
    const oneRowOffset = calculateGridVerticalCenterOffset(632, 1, 100, 32);
    const twoRowOffset = calculateGridVerticalCenterOffset(632, 2, 100, 32);

    expect(oneRowOffset).toBe(250);
    expect(twoRowOffset).toBe(200);
    expect(oneRowOffset - twoRowOffset).toBe(50);
  });

  it("pins the grid to the top once its rows need to scroll", () => {
    expect(calculateGridVerticalCenterOffset(632, 7, 100, 32)).toBe(0);
  });
});

describe("WorkspaceGrid mandala placement", () => {
  it("shares capped mandala placement across both workspace layouts", () => {
    expect(workspaceGridSource.match(/getMandalaPlacements\(\{/g)).toHaveLength(
      2
    );
    expect(workspaceGridSource).not.toContain("applyVariantCycling");
    expect(workspaceGridSource).toContain("{#if cell.show !== null}");
  });
});

describe("Create workspace action rail contract", () => {
  it("uses the Play glyph for the sequence viewer", () => {
    expect(WORKSPACE_BUTTON_ICON.view.icon).toBe("fa-play");
    expect(WORKSPACE_BUTTON_ICON.view.actionLabel).toBe("Play sequence");
    expect(WORKSPACE_BUTTON_TUTORIAL.view.label).toBe(
      WORKSPACE_BUTTON_ICON.view.actionLabel
    );
    expect(buttonPanelSource).toContain('purpose="play"');
    expect(drawerLauncherSource).toContain("playOnOpen: true");
  });

  it("keeps recovery in the leading header and four controls below it", () => {
    expect(
      workspaceButtonsInZone("header-leading").map((button) => button.id)
    ).toEqual(["undo"]);
    expect(workspaceButtonsInZone("right").map((button) => button.id)).toEqual([
      "sequence-actions",
      "share",
    ]);
    expect(
      workspaceButtonsInZone("header-trailing").map((button) => button.id)
    ).toEqual(["save"]);
    expect(WORKSPACE_BUTTON_ICON.share).toEqual({
      icon: "fa-share-nodes",
      iconType: "fa",
      actionLabel: "Share",
    });
    expect(WORKSPACE_BUTTON_TUTORIAL.share.label).toBe("Share");
    expect(WORKSPACE_BUTTON_TUTORIAL.share.description).toContain(
      "send the sequence in TKA"
    );
    expect(buttonPanelSource).toContain("<SequenceActionsButton");
    expect(buttonPanelSource).toContain("<ShareButton");
    expect(buttonPanelSource).not.toContain("<UndoButton");
    expect(buttonPanelSource).not.toContain("<SaveToLibraryButton");
    expect(standardWorkspaceSource).toContain("<UndoButton");
    expect(standardWorkspaceSource).toContain('direction="redo"');
    expect(sequenceDisplaySource).not.toContain("<UndoButton");
    expect(sequenceDisplaySource).not.toContain("<SequenceActionsButton");
    expect(sequenceDisplaySource).toContain("<SaveToLibraryButton");
  });

  it("keeps layout, icon, and tutorial maps in lockstep", () => {
    const layoutIds = WORKSPACE_BUTTON_LAYOUT.map((button) => button.id).sort();
    expect(Object.keys(WORKSPACE_BUTTON_ICON).sort()).toEqual(layoutIds);
    expect(Object.keys(WORKSPACE_BUTTON_TUTORIAL).sort()).toEqual(layoutIds);
  });

  it("keeps Play centered in the single-row phone layout", () => {
    expect(buttonPanelSource).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\)\s*50px\s*minmax\(0, 1fr\)/
    );
    expect(buttonPanelSource).not.toMatch(
      /grid-template-areas:\s*"\. center \."\s*"left \. right"/
    );
    expect(buttonPanelSource).toMatch(
      /grid-template-areas:\s*"left left left"\s*"\. center \."\s*"right right right"/
    );
  });

  it("keeps each side group packed instead of spacing buttons into equal cells", () => {
    expect(buttonPanelSource).toMatch(
      /\.left-zone,\s*\.right-zone\s*\{[^}]*display:\s*flex;[^}]*width:\s*max-content;[^}]*gap:\s*var\(--settings-workspace-action-gap\);/s
    );
    expect(buttonPanelSource).not.toContain(
      "grid-template-columns: repeat(3, minmax(0, 1fr));"
    );
    expect(buttonPanelSource).not.toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr));"
    );
  });
});
