import { describe, expect, it } from "vitest";
import {
  orderedModePairs,
  isWorkspaceReplayCommand,
  WORKSPACE_GATE_REVIEWS,
} from "../../../src/routes/test/sequence-viewer-transitions/workspace-review-replays";

describe("workspace review coverage", () => {
  it("visits each directed transition once, without no-op pairs", () => {
    const modes = ["2d", "card", "tunnel", "studio"];
    const pairs = orderedModePairs(modes);
    expect(pairs).toHaveLength(12);
    expect(new Set(pairs.map((pair) => pair.join(":"))).size).toBe(12);
    for (const from of modes) {
      for (const to of modes) {
        expect(pairs.some((pair) => pair[0] === from && pair[1] === to)).toBe(
          from !== to
        );
      }
    }
  });

  it("does not multiply replays when both switchers publish the same mode", () => {
    expect(orderedModePairs(["2d", "card", "2d"])).toEqual([
      ["2d", "card"],
      ["card", "2d"],
    ]);
    expect(orderedModePairs(["2d"])).toEqual([]);
  });

  it("only accepts supported commands across the frame boundary", () => {
    expect(isWorkspaceReplayCommand("export-video")).toBe(false);
    expect(isWorkspaceReplayCommand({ command: "studio-2d" })).toBe(false);
    for (const gate of Object.values(WORKSPACE_GATE_REVIEWS)) {
      expect(
        gate.options.some((option) => option.command.endsWith("interrupt"))
      ).toBe(true);
      for (const option of gate.options)
        expect(isWorkspaceReplayCommand(option.command)).toBe(true);
    }
  });
});
