import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("How TKA proof strip architecture", () => {
  it("shows three real proofs together without a step selector", () => {
    const source = read(
      "src/routes/landing/components/HowTkaWorksSection.svelte"
    );
    expect(source.match(/<PictographContainer\b/g)).toHaveLength(1);
    expect(source.match(/<ChoreoCard\b/g)).toHaveLength(1);
    expect(source.match(/<HowTkaAnimationCard\b/g)).toHaveLength(1);
    expect(source).toContain('class="proof-strip"');
    expect(source).toContain('class="proof-cell proof-pictograph"');
    expect(source).toContain('class="proof-cell proof-sequence"');
    expect(source).toContain('class="proof-cell proof-playback"');
    expect(source.match(/darkMode=\{true\}/g)).toHaveLength(2);
    expect(source).not.toContain("--proof-paper");
    expect(source).not.toContain("<ToggleGroup.Root");
    expect(source).not.toContain("activeStep");
    expect(source).not.toContain("autoAdvance");
    expect(source).not.toContain("step-rail");
  });

  it("keeps the compact strip capped on 4K displays", () => {
    const source = read(
      "src/routes/landing/components/HowTkaWorksSection.svelte"
    );
    expect(source).toContain("--proof-height: clamp(");
    expect(source).not.toContain("width: min(74vw, 2840px)");
  });

  it("gates playback with intersection, document visibility, and reduced motion", () => {
    const source = read(
      "src/routes/landing/components/HowTkaAnimationCard.svelte"
    );
    expect(source).toContain("shouldEnableAssemblyPlayback");
    expect(source).toContain("reducedMotion");
    expect(source).toContain('document.addEventListener("visibilitychange"');
  });

  it("uses a matching three-cell lazy skeleton", () => {
    const source = read(
      "src/routes/landing/components/LazyHowTkaWorksSection.svelte"
    );
    expect(source).toContain('class="sk-proof-strip"');
    expect(source.match(/class="sk-proof"/g)).toHaveLength(3);
    expect(source).not.toContain('class="sk-stage"');
    expect(source).not.toContain('class="sk-rail"');
  });
});
