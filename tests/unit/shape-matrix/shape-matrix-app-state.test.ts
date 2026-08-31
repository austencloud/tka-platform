import { describe, expect, it, vi } from "vitest";

const { requestShapeMatrixTransition } = vi.hoisted(() => ({
  requestShapeMatrixTransition: vi.fn(),
}));

vi.mock(
  "$lib/shared/shape-matrix/debug/shape-matrix-transition-recorder",
  () => ({ requestShapeMatrixTransition })
);

import { buildFlowerAxis } from "$lib/shared/shape-matrix/domain/flower-signature";
import { createShapeMatrixAppState } from "$lib/shared/shape-matrix/app/state/shape-matrix-app-state.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { Flower } from "$lib/shared/shape-matrix/domain/flower-signature";

const LEVEL_FOUR_TURNS = [
  "fl",
  0,
  0.25,
  0.5,
  0.75,
  1,
  1.25,
  1.5,
  1.75,
  2,
  2.25,
  2.5,
  2.75,
  3,
] as const;

function semanticVariant(flower: Flower): number {
  if (flower.style === "float")
    return ["in", "out", "clock", "counter"].indexOf(flower.ori);
  return (flower.style === "anti" ? 2 : 0) + (flower.ori === "out" ? 1 : 0);
}

function createState(compact: boolean) {
  const syncState = vi.fn();
  const state = createShapeMatrixAppState(
    {
      loadMatrix: vi.fn(),
      syncState,
    },
    {
      level: 2,
      blueTurn: 0,
      redTurn: 0,
      activeAxis: "both",
      labelMode: "turns",
      propType: PropType.STAFF,
      relationshipDriver: "hands",
      pair: null,
      mode: null,
      propMode: null,
    },
    compact
  );
  return { state, syncState };
}

describe("shape matrix app state", () => {
  it("changes an empty matrix turn without inventing a transition", () => {
    requestShapeMatrixTransition.mockClear();
    const { state, syncState } = createState(false);

    state.setLevel(4);
    state.setTurn(0.75);

    expect(state.selectedPair).toBeNull();
    expect(state.blueTurn).toBe(0.75);
    expect(state.redTurn).toBe(0.75);
    expect(requestShapeMatrixTransition).not.toHaveBeenCalled();
    expect(syncState).toHaveBeenLastCalledWith(
      expect.objectContaining({ blueTurn: 0.75, redTurn: 0.75, pair: null })
    );
  });

  it("opens a selected cell in the compact detail view with an active mode", () => {
    const { state, syncState } = createState(true);
    const [blue, red] = buildFlowerAxis();
    if (!blue || !red) throw new Error("Shape Matrix axis is empty");

    state.selectPair({ blue, red });

    expect(state.activeView).toBe("detail");
    expect(state.compactFocusRequest).toEqual({ id: 1, target: "detail" });
    expect(state.selectedMode).not.toBeNull();
    expect(syncState).toHaveBeenCalledWith(
      expect.objectContaining({ pair: { blue, red } })
    );
  });

  it("returns to the matrix without clearing the selected cell", () => {
    const { state } = createState(true);
    const [blue, red] = buildFlowerAxis();
    if (!blue || !red) throw new Error("Shape Matrix axis is empty");
    state.selectPair({ blue, red });

    state.showMatrix();

    expect(state.activeView).toBe("matrix");
    expect(state.compactFocusRequest).toEqual({ id: 2, target: "matrix" });
    expect(state.selectedPair).toEqual({ blue, red });
  });

  it("does not request compact focus for desktop selection or responsive changes", () => {
    const { state } = createState(false);
    const [blue, red] = buildFlowerAxis();
    if (!blue || !red) throw new Error("Shape Matrix axis is empty");

    state.selectPair({ blue, red });
    expect(state.compactFocusRequest).toBeNull();

    state.setCompact(true);
    expect(state.compactFocusRequest).toBeNull();
  });

  it("keeps both-pane selection state when responsive mode changes", () => {
    const { state } = createState(false);
    const [blue, red] = buildFlowerAxis();
    if (!blue || !red) throw new Error("Shape Matrix axis is empty");
    state.selectPair({ blue, red });

    state.setCompact(true);
    state.showDetail();
    state.setCompact(false);

    expect(state.selectedPair).toEqual({ blue, red });
    expect(state.activeView).toBe("detail");
  });

  it("returns to the matrix when a compact visitor changes its turn band", () => {
    const { state } = createState(true);
    const [blue, red] = buildFlowerAxis();
    if (!blue || !red) throw new Error("Shape Matrix axis is empty");
    state.selectPair({ blue, red });

    state.setTurn(1);

    expect(state.activeView).toBe("matrix");
    expect(state.selectedPair?.blue.turns).toBe(1);
    expect(state.selectedPair?.red.turns).toBe(1);
    expect(state.selectedPair?.blue.style).toBe(blue.style);
    expect(state.selectedPair?.red.style).toBe(red.style);
  });

  it("keeps one realization active after a cell is selected", () => {
    const { state, syncState } = createState(false);
    const [blue, red] = buildFlowerAxis();
    if (!blue || !red) throw new Error("Shape Matrix axis is empty");
    state.selectPair({ blue, red });
    const activeMode = state.selectedMode;

    state.setMode(null);

    expect(state.selectedMode).toBe(activeMode);
    expect(syncState).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: activeMode })
    );
  });

  it("restores a shared route without writing it back", () => {
    const { state, syncState } = createState(false);
    const [blue, red] = buildFlowerAxis();
    if (!blue || !red) throw new Error("Shape Matrix axis is empty");

    state.restoreState({
      level: 3,
      blueTurn: 0.5,
      redTurn: 0.5,
      activeAxis: "both",
      labelMode: "ratios",
      propType: PropType.STAFF,
      relationshipDriver: "props",
      pair: { blue, red },
      mode: "QS",
      propMode: "SO",
    });

    expect(state.level).toBe(3);
    expect(state.blueTurn).toBe(0.5);
    expect(state.redTurn).toBe(0.5);
    expect(state.labelMode).toBe("ratios");
    expect(state.selectedPair?.blue.turns).toBe(0.5);
    expect(state.selectedPair?.red.turns).toBe(0.5);
    expect(state.selectedPair?.blue.style).toBe(blue.style);
    expect(state.selectedPair?.red.style).toBe(red.style);
    expect(state.selectedMode).toBe("QS");
    expect(state.selectedPropMode).toBe("SO");
    expect(syncState).not.toHaveBeenCalled();
  });

  it("keeps an exact prop target only while the pair has equal rotating turns", () => {
    const { state } = createState(false);
    const flowers = buildFlowerAxis([0]).filter(
      (flower) => flower.grid === "diamond"
    );
    const blue = flowers[0];
    const red = flowers[1];
    if (!blue || !red) throw new Error("Expected numeric flowers");
    state.selectPair({ blue, red });
    state.setRelationshipDriver("props");
    state.setPropMode("SS");
    expect(state.selectedPropMode).toBe("SS");

    state.setLevel(4);
    state.setActiveAxis("blue");
    state.setTurn(0.25);
    expect(state.selectedPropMode).toBeNull();
  });

  it("treats float as a four-orientation matrix and restores rotating styles", () => {
    const { state } = createState(false);
    const blue = buildFlowerAxis().find(
      (flower) => flower.style === "anti" && flower.ori === "in"
    )!;
    const red = buildFlowerAxis().find(
      (flower) => flower.style === "pro" && flower.ori === "out"
    )!;
    state.selectPair({ blue, red });

    state.setLevel(3);
    state.setTurn("fl");
    expect(state.selectedPair?.blue.style).toBe("float");
    expect(state.selectedPair?.red.style).toBe("float");

    state.setTurn(0.5);
    expect(state.selectedPair?.blue.style).toBe("anti");
    expect(state.selectedPair?.red.style).toBe("pro");
  });

  it("edits one axis without changing the other", () => {
    const { state } = createState(false);
    const [blue, red] = buildFlowerAxis();
    if (!blue || !red) throw new Error("Shape Matrix axis is empty");
    state.selectPair({ blue, red });
    state.setLevel(4);
    state.setActiveAxis("blue");
    state.setTurn(0.75);

    expect(state.blueTurn).toBe(0.75);
    expect(state.redTurn).toBe(0);
    expect(state.selectedPair?.blue.turns).toBe(0.75);
    expect(state.selectedPair?.red.turns).toBe(0);
  });

  it("preserves each semantic row and column through every L4 turn and ratio band", () => {
    const axis = buildFlowerAxis([0]).filter(
      (flower) => flower.grid === "diamond"
    );

    for (let variant = 0; variant < 4; variant += 1) {
      const blue = axis[variant];
      const red = axis[3 - variant];
      if (!blue || !red) throw new Error("Expected four semantic variants");
      const { state, syncState } = createState(false);
      state.setLevel(4);
      state.setLabelMode("ratios");
      state.selectPair({ blue, red });

      state.setActiveAxis("blue");
      for (const turn of LEVEL_FOUR_TURNS) {
        state.setTurn(turn);
        expect(semanticVariant(state.selectedPair!.blue)).toBe(variant);
        expect(semanticVariant(state.selectedPair!.red)).toBe(3 - variant);
        expect(state.redTurn).toBe(0);
      }

      state.setActiveAxis("red");
      for (const turn of LEVEL_FOUR_TURNS) {
        state.setTurn(turn);
        expect(semanticVariant(state.selectedPair!.blue)).toBe(variant);
        expect(semanticVariant(state.selectedPair!.red)).toBe(3 - variant);
      }

      expect(syncState).toHaveBeenLastCalledWith(
        expect.objectContaining({
          blueTurn: 3,
          redTurn: 3,
          pair: state.selectedPair,
        })
      );
    }
  });
});
