import { describe, expect, it } from "vitest";
import {
  PROP_DIMENSIONS,
  getPropDimensions,
} from "../IPropTextureLoader";

describe("getPropDimensions with model render keys", () => {
  it("uses the pictograph box for a model sprite", () => {
    expect(getPropDimensions("club__model")).toEqual(PROP_DIMENSIONS.club);
    expect(getPropDimensions("SWORD__MODEL")).toEqual(PROP_DIMENSIONS.sword);
    expect(getPropDimensions("club")).toEqual(PROP_DIMENSIONS.club);
  });
});
