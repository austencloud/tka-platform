import { beforeEach, describe, expect, it } from "vitest";
import type { CollectedTunnel } from "$lib/features/tunnel-collection/domain/tunnel-collection-types";
import { DEFAULT_CONFIG } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  createIndependentTunnelPerformer,
  createTunnelComposition,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  consumeTunnelCreatorHandoff,
  saveTunnelCreatorHandoff,
} from "$lib/features/create/tunnel/services/tunnel-creator-handoff";

const STORAGE_KEY = "tka:tunnel-creator-handoff";

const steps = [
  { stepNumber: 1, letter: "A" },
  { stepNumber: 2, letter: "B" },
] as unknown as StepData[];

const formation = { ...DEFAULT_CONFIG, fold: 4 };

function savedTunnel(overrides: Partial<CollectedTunnel> = {}): CollectedTunnel {
  return {
    id: "tunnel-42",
    name: "Four-person weave",
    steps,
    poster: "data:image/webp;base64,AA",
    createdAt: 123,
    snapshot: { tunnel: { config: formation } },
    ...overrides,
  } as unknown as CollectedTunnel;
}

describe("tunnel creator handoff", () => {
  beforeEach(() => sessionStorage.clear());

  it("carries the saved tunnel identity, poster, and cast exactly once", () => {
    const composition = createTunnelComposition(
      [
        createIndependentTunnelPerformer(
          createSequenceData({ id: "s1", name: "Lead", word: "AB", steps }),
          0
        ),
      ],
      { formation }
    );
    saveTunnelCreatorHandoff(savedTunnel({ composition }));

    expect(consumeTunnelCreatorHandoff()).toMatchObject({
      tunnelId: "tunnel-42",
      tunnelName: "Four-person weave",
      poster: "data:image/webp;base64,AA",
      composition: { performers: composition.performers },
      formation,
    });
    expect(consumeTunnelCreatorHandoff()).toBeNull();
  });

  // The bug this contract exists for: a tunnel saved before the creator existed
  // has no composition, and used to reach the creator as an empty picker under
  // an "Edit tunnel" title.
  it("reconstructs a cast for a tunnel saved without one", () => {
    saveTunnelCreatorHandoff(savedTunnel());

    const handoff = consumeTunnelCreatorHandoff();
    expect(handoff?.composition.performers.length).toBeGreaterThan(0);

    const lead = handoff!.composition.performers[0]!;
    expect(lead.source.kind).toBe("independent");
    if (lead.source.kind === "independent") {
      expect(lead.source.sequence.steps).toHaveLength(2);
    }
  });

  it("rejects an incomplete persisted handoff", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tunnelId: "tunnel-42", tunnelName: "Broken" })
    );

    expect(consumeTunnelCreatorHandoff()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("rejects a persisted handoff whose cast is empty", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tunnelId: "tunnel-42",
        tunnelName: "Empty cast",
        composition: { performers: [] },
        formation,
      })
    );

    expect(consumeTunnelCreatorHandoff()).toBeNull();
  });
});
