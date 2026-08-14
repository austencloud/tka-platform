import { describe, expect, it } from "vitest";
import manifests from "$lib/features/choreo-card/data/festival-sampler-manifests.json";
import {
  festivalSamplerCardKey,
  type FestivalSamplerCardManifest,
} from "$lib/features/choreo-card/services/festival-sampler-manifest";
import {
  applyFestivalSamplerTurnAssignment,
  loadFestivalSamplerBaseSequence,
  resolveFestivalSamplerCardSequence,
} from "$lib/features/choreo-card/services/festival-sampler-turns";

function smallestMotifLength(pattern: string): number {
  const entries = pattern.split("-");
  for (let motifLength = 1; motifLength <= entries.length; motifLength += 1) {
    if (entries.length % motifLength !== 0) continue;
    if (
      entries.every((entry, index) => entry === entries[index % motifLength])
    ) {
      return motifLength;
    }
  }
  return entries.length;
}

describe("festival sampler frozen turn assignments", () => {
  it("resolves the first-page JD card from its repeating two-beat recipe", async () => {
    const card = manifests.candidates[0]!.cards.find(
      (candidate) => candidate.name === "JDJD"
    ) as FestivalSamplerCardManifest;
    const sequence = await resolveFestivalSamplerCardSequence(card);
    const applied = sequence.steps.map(
      (step) => `${step.motions?.blue?.turns}|${step.motions?.red?.turns}`
    );

    expect(card.turnPattern).toBe("0|1-1|0-0|1-1|0");
    expect(applied).toEqual(["0|1", "1|0", "0|1", "1|0"]);
  });

  it("keeps every patterned card closed and inside its declared turn cap", async () => {
    const uniqueCards = new Map<string, FestivalSamplerCardManifest>();
    for (const pack of manifests.candidates) {
      for (const card of pack.cards as FestivalSamplerCardManifest[]) {
        uniqueCards.set(festivalSamplerCardKey(card), card);
      }
    }

    expect(uniqueCards.size).toBeGreaterThan(300);
    for (const card of uniqueCards.values()) {
      const sequence = await resolveFestivalSamplerCardSequence(card);
      const turns = sequence.steps.flatMap((step) => [
        step.motions?.blue?.turns,
        step.motions?.red?.turns,
      ]);
      const cap = card.turnIntensity ?? 0;

      expect(sequence.level).toBe(card.level);
      expect(
        turns.every(
          (turn) => typeof turn === "number" && turn >= 0 && turn <= cap
        )
      ).toBe(true);
      if (cap === 0) {
        expect(turns.every((turn) => turn === 0)).toBe(true);
      } else {
        expect(turns).toContain(cap);
        expect(turns).toContain(0);
        const patternLength = card.turnPattern!.split("-").length;
        expect(smallestMotifLength(card.turnPattern!)).toBeLessThan(
          patternLength
        );
      }
    }
  }, 30_000);

  it("rejects a four-beat recipe that closes but does not repeat a motif", async () => {
    const source = manifests.candidates
      .flatMap((pack) => pack.cards as FestivalSamplerCardManifest[])
      .find((card) => card.source === "catalog")!;
    const base = await loadFestivalSamplerBaseSequence(source);
    const nonCyclic = {
      ...source,
      level: 2,
      turnIntensity: 1,
      turnPattern: "1|1-0|0-0|1-1|0",
    };

    expect(() => applyFestivalSamplerTurnAssignment(nonCyclic, base)).toThrow(
      /not a cyclic motif/
    );
  });
});
