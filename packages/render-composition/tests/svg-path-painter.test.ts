import { describe, it, expect } from "vitest";
import { parsePathData } from "../src/svg-path-painter.js";

describe("parsePathData", () => {
  it("parses M L Z commands", () => {
    const commands = parsePathData("M10 20 L30 40 Z");
    expect(commands).toHaveLength(3);
    expect(commands[0]).toEqual({ cmd: "M", args: [10, 20] });
    expect(commands[1]).toEqual({ cmd: "L", args: [30, 40] });
    expect(commands[2]).toEqual({ cmd: "Z", args: [] });
  });

  it("parses H and V commands", () => {
    const commands = parsePathData("M0 0 H50 V100");
    expect(commands).toHaveLength(3);
    expect(commands[1]).toEqual({ cmd: "H", args: [50] });
    expect(commands[2]).toEqual({ cmd: "V", args: [100] });
  });

  it("parses cubic bezier C command", () => {
    const commands = parsePathData("M0 0 C10 20 30 40 50 60");
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual({ cmd: "C", args: [10, 20, 30, 40, 50, 60] });
  });

  it("parses FA rotate icon path without error", () => {
    const d = "M480.1 192l7.9 0c13.3 0 24-10.7 24-24l0-144c0-9.7-5.8-18.5-14.8-22.2";
    const commands = parsePathData(d);
    expect(commands.length).toBeGreaterThan(0);
  });

  it("handles relative commands (lowercase)", () => {
    const commands = parsePathData("M10 10 l20 30 z");
    expect(commands).toHaveLength(3);
    expect(commands[1]).toEqual({ cmd: "l", args: [20, 30] });
  });
});
