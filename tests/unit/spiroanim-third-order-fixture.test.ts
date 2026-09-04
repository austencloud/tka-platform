import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface ThirdOrderFixture {
  fixtureSchema: number;
  provenance: {
    sourceCodecVersion: number;
    decodedWithCommit: string;
    sourceUrl: string;
  };
  verification: { exactRoundTrip: boolean };
  summary: {
    propCount: number;
    propsWithMotion: number;
    propsWithoutMotion: number;
    cameraFrames: number;
    cameraBeats: number;
    totalBeats: number;
    independentTimelineBehavior: {
      animationHoldsAfterBeat: number;
      motionEndsAtBeat: number;
      cameraEndsAtBeat: number;
    };
    motionGroups: Array<{ propIndices: number[] }>;
  };
  decoded: {
    props: Array<{ anim: unknown[]; motion: unknown[] }>;
    camera: unknown[];
  };
  worldTrajectoryReference: {
    layers: Array<{
      id: string;
      propIndex: number;
      tipIndex: number;
      originalPointCount: number;
      points: Array<[number, number, number]>;
    }>;
  };
}

const fixture = JSON.parse(
  readFileSync(
    resolve("docs/research/spiroanim/fixtures/kyle-v11-third-order.json"),
    "utf8"
  )
) as ThirdOrderFixture;

describe("Kyle's SpiroAnim v11 Third Order fixture", () => {
  it("preserves the exact decoded scene and its independent clocks", () => {
    expect(fixture.fixtureSchema).toBe(1);
    expect(fixture.provenance.sourceCodecVersion).toBe(11);
    expect(fixture.provenance.decodedWithCommit).toBe(
      "3f42385010ecd4d5c5a0c78f5f35f7f5391e5ad3"
    );
    expect(fixture.provenance.sourceUrl).toMatch(/[?&]v=11$/);
    expect(fixture.verification.exactRoundTrip).toBe(true);

    expect(fixture.summary).toMatchObject({
      propCount: 18,
      propsWithMotion: 16,
      propsWithoutMotion: 2,
      cameraFrames: 10,
      cameraBeats: 45,
      totalBeats: 48,
      independentTimelineBehavior: {
        animationHoldsAfterBeat: 37,
        motionEndsAtBeat: 48,
        cameraEndsAtBeat: 45,
      },
    });
    expect(fixture.decoded.props).toHaveLength(18);
    expect(fixture.decoded.camera).toHaveLength(10);
    expect(
      fixture.decoded.props
        .slice(0, 16)
        .every((prop) => prop.anim.length === 37 && prop.motion.length === 4)
    ).toBe(true);
    expect(
      fixture.decoded.props
        .slice(16)
        .every((prop) => prop.anim.length === 1 && prop.motion.length === 0)
    ).toBe(true);
  });

  it("keeps all six moving cohorts separate from the static pair", () => {
    expect(
      fixture.summary.motionGroups.map((group) => group.propIndices)
    ).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9],
      [10, 11],
      [12, 13],
      [14, 15],
      [16, 17],
    ]);
  });

  it("contains renderer-authored world trajectories for both tips of every moving staff", () => {
    const layers = fixture.worldTrajectoryReference.layers;
    expect(layers).toHaveLength(32);
    expect(new Set(layers.map((layer) => layer.id)).size).toBe(32);

    for (let propIndex = 0; propIndex < 16; propIndex += 1) {
      const propLayers = layers.filter(
        (layer) => layer.propIndex === propIndex
      );
      expect(propLayers.map((layer) => layer.tipIndex)).toEqual([0, 1]);
      expect(
        propLayers.every(
          (layer) =>
            layer.originalPointCount === 3600 && layer.points.length === 192
        )
      ).toBe(true);
    }
  });
});
