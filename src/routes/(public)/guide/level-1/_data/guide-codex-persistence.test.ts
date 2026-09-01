import { describe, expect, it } from "vitest";
import {
  restoreGuideCodexPrefs,
  serializeGuideCodexPrefs,
} from "./guide-codex-persistence";

describe("Guide Codex persistence", () => {
  it("restores the literal blue/red turns written by v3", () => {
    const restored = restoreGuideCodexPrefs(
      JSON.stringify({
        version: 3,
        propType: "staff",
        visibility: {},
        blueTurns: 1.5,
        redTurns: "fl",
      })
    );

    expect(restored.leftTurns).toBe(1.5);
    expect(restored.rightTurns).toBe("fl");
    expect(JSON.parse(serializeGuideCodexPrefs(restored))).toMatchObject({
      version: 4,
      leftTurns: 1.5,
      rightTurns: "fl",
    });
  });
});
