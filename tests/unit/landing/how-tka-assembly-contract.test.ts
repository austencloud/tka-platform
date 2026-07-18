import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("How TKA assembly architecture", () => {
  it("uses one pictograph stage and the installed single-select primitive", () => {
    const source = read("src/routes/landing/components/HowTkaWorksSection.svelte");
    expect(source.match(/<PictographContainer\b/g)).toHaveLength(1);
    expect(source).toContain("<ToggleGroup.Root");
    expect(source).toContain('type="single"');
    expect(source).toContain('aria-live="polite"');
    expect(source).not.toContain('class="step-card"');
  });

  it("activates the animation only for the playback step", () => {
    const source = read("src/routes/landing/components/HowTkaWorksSection.svelte");
    expect(source).toContain('active={activeStep === "playback"}');
  });

  it("gates the animation with active, intersection, and document visibility", () => {
    const source = read("src/routes/landing/components/HowTkaAnimationCard.svelte");
    expect(source).toContain("active?: boolean");
    expect(source).toContain("shouldEnableAssemblyPlayback");
    expect(source).toContain('document.addEventListener("visibilitychange"');
  });

  it("uses a stage-and-rail lazy skeleton instead of six cards", () => {
    const source = read("src/routes/landing/components/LazyHowTkaWorksSection.svelte");
    expect(source).toContain('class="sk-stage"');
    expect(source).toContain('class="sk-rail"');
    expect(source).not.toContain('class="sk-card"');
  });
});
