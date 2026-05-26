import { describe, it, expect } from "vitest";
import { deriveStartPositionInfo } from "../../src/lib/features/choreo-card/components/card-back/card-back-data";

describe("deriveStartPositionInfo", () => {
  it("returns diamond mode for cardinal hand locations", () => {
    const result = deriveStartPositionInfo({
      blueLocation: "s",
      redLocation: "n",
    });
    expect(result.gridMode).toBe("diamond");
    expect(result.group).toBe("alpha");
    expect(result.blueLocation).toBe("s");
    expect(result.redLocation).toBe("n");
  });

  it("returns box mode for intercardinal hand locations", () => {
    const result = deriveStartPositionInfo({
      blueLocation: "ne",
      redLocation: "sw",
    });
    expect(result.gridMode).toBe("box");
    expect(result.group).toBe("alpha");
  });

  it("returns mixed mode when locations span cardinal and intercardinal", () => {
    const result = deriveStartPositionInfo({
      blueLocation: "n",
      redLocation: "ne",
    });
    expect(result.gridMode).toBe("mixed");
    expect(result.group).toBe("gamma");
  });

  it("returns beta for same locations", () => {
    const result = deriveStartPositionInfo({
      blueLocation: "s",
      redLocation: "s",
    });
    expect(result.group).toBe("beta");
    expect(result.gridMode).toBe("diamond");
  });

  it("returns null info when no locations provided", () => {
    const result = deriveStartPositionInfo({
      blueLocation: null,
      redLocation: null,
    });
    expect(result.group).toBeNull();
    expect(result.blueLocation).toBeNull();
    expect(result.redLocation).toBeNull();
    expect(result.gridMode).toBe("diamond");
  });
});
