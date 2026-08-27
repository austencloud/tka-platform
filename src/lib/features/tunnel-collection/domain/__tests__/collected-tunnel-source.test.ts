import { describe, it, expect } from "vitest";
import { SNAPSHOT_VERSION } from "$lib/shared/sequence-viewer/tunnel/tunnel-snapshot";
import {
  DEFAULT_CONFIG,
  type TunnelConfig,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  createIndependentTunnelPerformer,
  createTunnelComposition,
  resolveTunnelLayerPlans,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  collectedTunnelComposition,
  collectedTunnelSequence,
} from "../collected-tunnel-source";
import type { CollectedTunnel } from "../tunnel-collection-types";

const steps = [
  { stepNumber: 1, letter: "A", gridMode: "diamond" },
  { stepNumber: 2, letter: "B" },
  { stepNumber: 3, letter: "C" },
  { stepNumber: 4, letter: "D" },
] as unknown as StepData[];

function savedTunnel(
  config: TunnelConfig = { ...DEFAULT_CONFIG, fold: 4 },
  overrides: Partial<CollectedTunnel> = {}
): CollectedTunnel {
  return {
    id: "tunnel-42",
    name: "QPUΛ-",
    steps,
    poster: "data:image/webp;base64,AA",
    createdAt: 123,
    snapshot: {
      version: SNAPSHOT_VERSION,
      tunnel: {
        config,
        gridVisible: false,
        spectrum: true,
        section: "tunnel",
      },
      effects: { activeEffect: "none" },
      effort: "linear",
      paths: {
        pathShape: "arc",
        motionAwarePaths: false,
        bluePathLines: false,
        redPathLines: false,
      },
      playback: { bpm: 60, playbackMode: "continuous" },
      props: { bluePropType: "staff", redPropType: "staff" },
      trailRender: { mode: "none" },
    },
    ...overrides,
  } as unknown as CollectedTunnel;
}

describe("collectedTunnelSequence", () => {
  it("rebuilds the saved sequence and recovers its grid mode", () => {
    const sequence = collectedTunnelSequence(savedTunnel());

    expect(sequence.id).toBe("tunnel-42");
    expect(sequence.name).toBe("QPUΛ-");
    expect(sequence.steps).toHaveLength(4);
    expect(sequence.gridMode).toBe("diamond");
  });
});

describe("collectedTunnelComposition", () => {
  it("returns the authored cast untouched", () => {
    const authored = createTunnelComposition([
      createIndependentTunnelPerformer(
        createSequenceData({ id: "s1", name: "Lead", word: "LEAD", steps }),
        0
      ),
    ]);

    expect(collectedTunnelComposition(savedTunnel(undefined, { composition: authored }))).toBe(
      authored
    );
  });

  it("gives a legacy tunnel a two-slot cast the creator can edit", () => {
    const composition = collectedTunnelComposition(savedTunnel());

    expect(composition.id).toBe("tunnel-42");
    expect(composition.name).toBe("QPUΛ-");
    expect(composition.formation.fold).toBe(4);
    expect(composition.performers).toHaveLength(2);

    const [lead, partner] = composition.performers;
    expect(lead!.source.kind).toBe("independent");
    if (lead!.source.kind === "independent") {
      expect(lead!.source.sequence.steps).toHaveLength(4);
    }
    // No transforms: the partner reads back as the default relationship, so the
    // creator's Linked controls open on "copy", not on an invented rotation.
    expect(partner!.source).toEqual({
      kind: "derived",
      performerId: lead!.id,
      transforms: [],
    });
  });

  it("paints exactly what the one-performer tunnel painted", () => {
    const tunnel = savedTunnel();
    const formation = tunnel.snapshot.tunnel.config;
    const solo = createTunnelComposition(
      [createIndependentTunnelPerformer(collectedTunnelSequence(tunnel), 0)],
      { formation }
    );

    const before = resolveTunnelLayerPlans(solo);
    const after = resolveTunnelLayerPlans(collectedTunnelComposition(tunnel));

    expect(after).toHaveLength(before.length);
    for (const [arm, plan] of after.entries()) {
      expect(plan.ops).toEqual(before[arm]!.ops);
      expect(plan.sequence.steps).toEqual(before[arm]!.sequence.steps);
      expect(plan.stepOffset).toBe(before[arm]!.stepOffset);
      expect(plan.speed).toBe(before[arm]!.speed);
    }
  });

  it("stays a solo cast when the formation has only one image", () => {
    const composition = collectedTunnelComposition(
      savedTunnel({ ...DEFAULT_CONFIG, fold: 1 })
    );

    expect(composition.performers).toHaveLength(1);
    expect(composition.performers[0]!.source.kind).toBe("independent");
  });
});
