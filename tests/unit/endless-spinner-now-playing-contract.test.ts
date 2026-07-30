import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import SpinnerNowPlaying from "../../src/routes/endless-spinner/components/SpinnerNowPlaying.svelte";

const source = readFileSync(
  resolve(
    process.cwd(),
    "src/routes/endless-spinner/components/SpinnerNowPlaying.svelte"
  ),
  "utf8"
);

describe("Endless Spinner now-playing LOOP identity", () => {
  it("compiles as a Svelte component", () => {
    expect(SpinnerNowPlaying).toBeDefined();
  });

  it("forwards both canonical per-component periods to LoopChips", () => {
    expect(source).toContain("tryGetLoopDisplayResolver");
    expect(source).toContain("loopDisplay.rotationPeriod");
    expect(source).toContain("loopDisplay.inversionPeriod");
    expect(source).toMatch(
      /<LoopChips\s+\{components\}\s+\{rotationPeriod\}\s+\{inversionPeriod\}\s*\/>/
    );
  });
});
