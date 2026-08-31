import { describe, expect, it } from "vitest";

import {
  buildFlowerAxis,
  flowerKey,
} from "$lib/shared/shape-matrix/domain/flower-signature";
import {
  readShapeMatrixRouteState,
  writeShapeMatrixRouteState,
} from "../../../src/routes/(public)/notation/shape-matrix/_state/shape-matrix-url";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

const COMMON = {
  activeAxis: "both" as const,
  propType: PropType.STAFF,
  relationshipDriver: "hands" as const,
  propMode: null,
};

describe("shape matrix URL state", () => {
  it("round-trips the selected matrix state without dropping unrelated params", () => {
    const [left, right] = buildFlowerAxis();
    if (!left || !right) throw new Error("Shape Matrix axis is empty");
    const url = new URL(
      "https://tkaflowarts.com/notation/shape-matrix?ref=promo"
    );

    writeShapeMatrixRouteState(url, {
      level: 3,
      leftTurn: 0,
      rightTurn: 0,
      ...COMMON,
      labelMode: "ratios",
      pair: { left, right },
      mode: "SS",
    });

    expect(url.searchParams.get("ref")).toBe("promo");
    expect(url.searchParams.get("blue")).toBe(flowerKey(left));
    expect(url.searchParams.get("red")).toBe(flowerKey(right));
    expect(readShapeMatrixRouteState(url.search)).toEqual({
      level: 3,
      leftTurn: 0,
      rightTurn: 0,
      ...COMMON,
      labelMode: "ratios",
      pair: { left, right },
      mode: "SS",
    });
  });

  it("rejects partial or unknown selections without inventing a mode", () => {
    const state = readShapeMatrixRouteState(
      "?level=9&blue=not-a-flower&mode=SS"
    );

    expect(state).toEqual({
      level: 2,
      leftTurn: 2,
      rightTurn: 2,
      ...COMMON,
      labelMode: "turns",
      pair: null,
      mode: null,
    });
  });

  it("removes cell parameters when the selection is cleared", () => {
    const url = new URL(
      "https://tkaflowarts.com/notation/shape-matrix?size=medium&blue=x&red=y&mode=SS"
    );

    writeShapeMatrixRouteState(url, {
      level: 1,
      leftTurn: 0,
      rightTurn: 0,
      ...COMMON,
      labelMode: "turns",
      pair: null,
      mode: null,
    });

    expect(url.searchParams.get("blue")).toBeNull();
    expect(url.searchParams.get("red")).toBeNull();
    expect(url.searchParams.get("blueTurn")).toBe("0");
    expect(url.searchParams.get("redTurn")).toBe("0");
  });

  it("migrates the old cumulative size links onto their outer turn band", () => {
    expect(readShapeMatrixRouteState("?size=large")).toEqual({
      level: 2,
      leftTurn: 2,
      rightTurn: 2,
      ...COMMON,
      labelMode: "turns",
      pair: null,
      mode: null,
    });
  });

  it("round-trips independent axis bands and the prop-first driver", () => {
    const state = readShapeMatrixRouteState(
      "?level=4&blueTurn=0.75&redTurn=1.5&axis=red&labels=ratios&prop=fan&driver=props"
    );

    expect(state).toEqual({
      level: 4,
      leftTurn: 0.75,
      rightTurn: 1.5,
      activeAxis: "red",
      labelMode: "ratios",
      propType: PropType.FAN,
      relationshipDriver: "props",
      pair: null,
      mode: null,
      propMode: null,
    });
  });

  it("round-trips an explicit prop relationship for an equal rotating pair", () => {
    const flowers = buildFlowerAxis([0.25]).filter(
      (flower) => flower.grid === "diamond"
    );
    const left = flowers[0];
    const right = flowers[1];
    if (!left || !right) throw new Error("Expected quarter-turn flowers");
    const url = new URL("https://tkaflowarts.com/notation/shape-matrix");

    writeShapeMatrixRouteState(url, {
      level: 4,
      leftTurn: 0.25,
      rightTurn: 0.25,
      activeAxis: "both",
      labelMode: "turns",
      propType: PropType.CLUB,
      relationshipDriver: "props",
      pair: { left, right },
      mode: "TS",
      propMode: "SS",
    });

    expect(url.searchParams.get("propMode")).toBe("SS");
    expect(readShapeMatrixRouteState(url.search).propMode).toBe("SS");
  });

  it("rejects timed prop state for unequal turns", () => {
    const state = readShapeMatrixRouteState(
      "?level=4&blueTurn=0.25&redTurn=1&propMode=SS"
    );
    expect(state.propMode).toBeNull();
  });
});
