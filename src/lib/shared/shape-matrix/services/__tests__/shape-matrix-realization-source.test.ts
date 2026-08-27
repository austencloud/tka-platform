import { describe, expect, it } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { Flower } from "../../domain/flower-signature";
import { identifyShapeMatrixRealization } from "../shape-matrix-realization-source";

const blue: Flower = {
  style: "pro",
  turns: 1,
  ori: "in",
  grid: "diamond",
  petals: 2,
};
const red: Flower = {
  style: "anti",
  turns: 2,
  ori: "out",
  grid: "diamond",
  petals: 6,
};

describe("identifyShapeMatrixRealization", () => {
  it("keeps the realized motion payload and gives the cell result its own identity", () => {
    const base = {
      id: "catalog/base word",
      name: "Base",
      word: "AAAA",
      steps: [{ id: "base-step" }],
    } as unknown as SequenceData;
    const realized = {
      ...base,
      steps: [{ id: "realized-step", turn: 2 }],
      metadata: { marker: "exact" },
    } as unknown as SequenceData;

    const source = identifyShapeMatrixRealization(
      base,
      realized,
      { blue, red },
      "TO"
    );

    expect(source.sequence).toEqual({
      ...realized,
      id: "shape-matrix:catalog%2Fbase%20word:TO:pro-1-in-diamond:anti-2-out-diamond",
    });
    expect(source.sequence.steps).toBe(realized.steps);
    expect(source.sourceSequenceId).toBe(base.id);
    expect(source.provenance).toEqual({
      kind: "shape-matrix-realization",
      version: 1,
      baseSequenceId: base.id,
      mode: "TO",
      blueFlower: blue,
      redFlower: red,
    });
  });

  it("produces a different identity for a different mode without inventing a base", () => {
    const base = {
      id: "catalog-base",
      name: "Base",
      word: "AAAA",
      steps: [],
    } as unknown as SequenceData;

    const ss = identifyShapeMatrixRealization(base, base, { blue, red }, "SS");
    const so = identifyShapeMatrixRealization(base, base, { blue, red }, "SO");

    expect(ss.sequence.id).not.toBe(so.sequence.id);
    expect(ss.sourceSequenceId).toBe("catalog-base");
    expect(so.sourceSequenceId).toBe("catalog-base");
  });
});
