import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const homeHero = readSource(
  "src/lib/shared/landing/components/HomeHero.svelte"
);
const sequenceHero = readSource(
  "src/lib/shared/landing/components/SequenceHeroDemo.svelte"
);
const stepStrip = readSource("src/lib/shared/timeline/StepStrip.svelte");
const inlinePlayer = readSource(
  "src/lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
);
const animatorCanvas = readSource(
  "src/lib/shared/animation-engine/components/AnimatorCanvas.svelte"
);
const landingPage = readSource("src/routes/+page.svelte");
const launchpadGrid = readSource(
  "src/lib/shared/landing/components/launchpad/LaunchpadGrid.svelte"
);
const launchpadTile = readSource(
  "src/lib/shared/landing/components/launchpad/LaunchpadTile.svelte"
);
const glossaryCard = readSource(
  "src/lib/shared/landing/components/launchpad/GlossaryDictionaryCard.svelte"
);

describe("homepage hero notation rail contract", () => {
  it("reuses the shared StepStrip through the hero's lazy stage seam", () => {
    expect(homeHero).toContain("showNotationStrip={true}");
    expect(sequenceHero).toContain(
      'import("$lib/shared/timeline/StepStrip.svelte")'
    );
    expect(sequenceHero).toContain('density: "compact"');
    expect(sequenceHero).toContain("active={active && !!sequence}");
    expect(stepStrip).toContain(
      "const resolvedCells = $derived(cells ?? buildNotationCells(sequence))"
    );
  });

  it("keys live step reports to the sequence actually loaded in the player", () => {
    expect(inlinePlayer).toContain(
      "onStepChange?: (currentStep: number, sequenceId: string | null) => void"
    );
    expect(inlinePlayer).toContain(
      "const sequenceId = animationState.sequenceData?.id ?? null"
    );
    expect(sequenceHero).toContain(
      "reportedSequenceId === (sequence?.id ?? null) ? reportedStep : 0"
    );
  });

  it("shows the shared whole-word header with the engine's live step highlight", () => {
    expect(homeHero).toContain("showWordHeader={true}");
    expect(sequenceHero).toContain("showWordHeader,");
    expect(sequenceHero).toContain("visibilityManagerOverride: showWordHeader");
    expect(inlinePlayer).toContain(
      "word={animationState.sequenceData?.word ?? sequence.word}"
    );
    expect(inlinePlayer).toContain("hideHeader={fill && !showWordHeader}");
    expect(animatorCanvas).toContain(
      "activeStepNumber={headerActiveStepNumber}"
    );
  });

  it("routes the prefetched sequence through the player's clock-preserving boundary handoff", () => {
    expect(homeHero).toContain(
      "onSequenceBoundary={heroAct.offerSequenceBoundary}"
    );
    expect(sequenceHero).toContain("onSequenceBoundary,");
    expect(inlinePlayer).toContain(
      "playbackController.onSequenceBoundary(() =>"
    );
    expect(inlinePlayer).toContain(
      "lastLoadedSequenceId = getSequenceLoadId(handoff.sequence)"
    );
  });

  it("reserves the compact rail and scales it continuously inside the wide stage budget", () => {
    expect(sequenceHero).toMatch(
      /\.notation-strip\s*\{[\s\S]*?height: 4\.125rem/
    );
    expect(sequenceHero).toContain("height: 4.375rem");
    expect(sequenceHero).toContain("height: 4.6875rem");
    expect(sequenceHero).not.toContain("@media (min-width: 2200px)");
    expect(homeHero).toContain(
      "--hero-demo-wide-max-width: min(calc(48svh - 3rem), 31rem)"
    );
    expect(homeHero).not.toContain("@media (min-width: 2200px)");
  });

  it("keeps the wide launchpad on the shared lockstep scale", () => {
    expect(landingPage).toContain(
      "max-width: var(--shell-w, min(1720px, 92vw))"
    );
    expect(launchpadGrid).toContain(
      "grid-auto-rows: clamp(10.625rem, 21.5svh, 21.25rem)"
    );
    expect(launchpadTile).toContain("width: 10.625rem");
    expect(launchpadTile).toContain("width: 8.75rem");

    for (const source of [launchpadGrid, launchpadTile, glossaryCard]) {
      expect(source).not.toContain("@media (min-width: 2200px)");
    }
  });

  it("gives tablet viewports a complete four-band destination bento", () => {
    const tabletQuery =
      "@media (min-width: 760px) and (max-width: 1679px) and (min-height: 500px)";
    const foldLandscapeQuery =
      "@media (min-width: 760px) and (max-width: 1180px) and (min-height: 500px) and (max-height: 649px)";

    expect(landingPage).toContain(tabletQuery);
    expect(homeHero).toContain(tabletQuery);
    expect(launchpadGrid).toContain(tabletQuery);
    expect(launchpadTile).toContain(tabletQuery);
    expect(launchpadGrid).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr))"
    );
    expect(launchpadGrid).toContain('class="launchpad-group"');
    expect(launchpadGrid).toContain("grid-template-rows: auto auto");
    expect(launchpadGrid).toContain("align-content: center");
    expect(launchpadGrid).toContain(".t-composer),");
    expect(launchpadGrid).toContain(".t-notation)");
    expect(launchpadGrid).toContain("@container launchpad (max-width: 22rem)");
    expect(launchpadTile).toContain("@container launchpad (max-width: 32rem)");
    expect(launchpadGrid).toContain(
      "grid-template-rows: repeat(6, minmax(0, 1fr))"
    );
    expect(launchpadTile).toContain("max-height: 850px");

    for (const source of [landingPage, homeHero, sequenceHero, launchpadGrid]) {
      expect(source).toContain(foldLandscapeQuery);
    }
    expect(homeHero).toContain("--hero-demo-max-width: min(100%, 40svh)");
    expect(sequenceHero).toMatch(
      /\.with-notation-strip \.notation-strip\s*\{\s*display: none/
    );
    expect(launchpadGrid).toContain("row-gap: 0.5rem");
    expect(launchpadGrid).toContain(
      "grid-template-rows: repeat(3, minmax(0, 1fr))"
    );
    expect(launchpadGrid).toContain(
      "grid-template-columns: repeat(4, minmax(0, 1fr))"
    );
  });
});
