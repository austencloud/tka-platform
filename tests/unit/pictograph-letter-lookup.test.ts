import { describe, it, expect } from "vitest";
import {
  parseCsvEdges,
  lookupLetter,
  type CsvEdge,
} from "$lib/features/choreo-card/services/pictograph-letter-lookup";

const CSV = [
  "letter,startPosition,endPosition,blueMotionType,blueStartLocation,blueEndLocation,redMotionType,redStartLocation,redEndLocation",
  "A,alpha1,alpha2,pro,s,w,pro,n,e",
  "B,alpha1,alpha2,anti,s,w,anti,n,e",
].join("\n");

describe("parseCsvEdges", () => {
  it("parses header + rows into objects", () => {
    const edges = parseCsvEdges(CSV);
    expect(edges).toHaveLength(2);
    expect(edges[0].letter).toBe("A");
    expect(edges[1].blueMotionType).toBe("anti");
  });
});

describe("lookupLetter", () => {
  const edges = parseCsvEdges(CSV);
  it("matches a step on positions + motion types + locations", () => {
    const letter = lookupLetter(edges, {
      startPosition: "alpha1",
      endPosition: "alpha2",
      blue: { motionType: "anti", startLocation: "s", endLocation: "w" },
      red: { motionType: "anti", startLocation: "n", endLocation: "e" },
    });
    expect(letter).toBe("B");
  });
  it("returns null when no edge matches", () => {
    const letter = lookupLetter(edges, {
      startPosition: "beta1",
      endPosition: "beta2",
      blue: { motionType: "pro", startLocation: "s", endLocation: "w" },
      red: { motionType: "pro", startLocation: "n", endLocation: "e" },
    });
    expect(letter).toBeNull();
  });
});
