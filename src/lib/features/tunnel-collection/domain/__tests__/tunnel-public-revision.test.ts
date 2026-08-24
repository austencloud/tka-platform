import { describe, expect, it } from "vitest";
import { SNAPSHOT_VERSION } from "$lib/shared/sequence-viewer/tunnel/tunnel-snapshot";
import { DEFAULT_CONFIG } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
import {
  TunnelCompositionSchema,
  createDerivedTunnelPerformer,
  createIndependentTunnelPerformer,
  createTunnelComposition,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { CollectedTunnel } from "../tunnel-collection-types";
import { createTunnelRevision } from "../tunnel-revision";
import {
  createTunnelPublicRevision,
  sanitizeTunnelComposition,
  tunnelPublicPayload,
} from "../tunnel-public-revision";

const snapshot = {
  version: SNAPSHOT_VERSION,
  tunnel: {
    config: DEFAULT_CONFIG,
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
} as CollectedTunnel["snapshot"];

function tunnelFixture(
  overrides: Partial<CollectedTunnel> = {}
): CollectedTunnel {
  return {
    id: "tunnel-1",
    name: "My Tunnel",
    steps: [],
    snapshot,
    poster: "data:image/webp;base64,AA",
    createdAt: 123,
    ...overrides,
  };
}

function compositionFixture() {
  const sequence = createSequenceData({
    id: "library-sequence-42",
    name: "Source",
    word: "ABAB",
    steps: [],
  });
  const lead = createIndependentTunnelPerformer(sequence, 0);
  const echo = createDerivedTunnelPerformer(lead.id, 1, [
    { kind: "rotate", amount: 90 },
  ]);
  return createTunnelComposition([lead, echo], {
    id: "comp-1",
    name: "Cast",
    now: 456,
  });
}

describe("sanitizeTunnelComposition", () => {
  it("whitelists independent sources to positional placeholders", () => {
    const sanitized = sanitizeTunnelComposition(compositionFixture());
    const lead = sanitized.performers[0];
    expect(lead.source.kind).toBe("independent");
    if (lead.source.kind !== "independent") return;
    expect(lead.source.sequence).toEqual({
      id: "src-1",
      name: "Source",
      word: "ABAB",
      steps: [],
    });
    expect("sourceSequenceId" in lead.source).toBe(false);
  });

  it("drops hydrated SequenceData passthrough metadata entirely", () => {
    const sanitized = sanitizeTunnelComposition(compositionFixture());
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("library-sequence-42");
    expect(serialized).not.toContain("sourceSequenceId");
    expect(serialized).not.toContain("thumbnails");
    expect(serialized).not.toContain("isFavorite");
  });

  it("preserves the derivation graph verbatim", () => {
    const composition = compositionFixture();
    const sanitized = sanitizeTunnelComposition(composition);
    expect(sanitized.performers[1].source).toEqual(
      composition.performers[1].source
    );
    expect(sanitized.formation).toEqual(composition.formation);
  });

  it("still parses at the composition boundary schema", () => {
    const sanitized = sanitizeTunnelComposition(compositionFixture());
    expect(TunnelCompositionSchema.safeParse(sanitized).success).toBe(true);
  });
});

describe("tunnelPublicPayload", () => {
  it("never carries private lineage fields", () => {
    const payload = tunnelPublicPayload(
      tunnelFixture({
        source: "viewer",
        sourceWord: "ABAB",
        sourceSequenceId: "library-sequence-42",
        composition: compositionFixture(),
      })
    );
    expect("sourceSequenceId" in payload).toBe(false);
    expect("source" in payload).toBe(false);
    expect(payload.sourceWord).toBe("ABAB");
    expect(JSON.stringify(payload)).not.toContain("library-sequence-42");
  });

  it("omits absent optionals instead of writing undefined", () => {
    const payload = tunnelPublicPayload(tunnelFixture());
    expect(Object.keys(payload).sort()).toEqual([
      "poster",
      "snapshot",
      "steps",
    ]);
  });
});

describe("createTunnelPublicRevision", () => {
  it("is deterministic for identical content", async () => {
    const a = await createTunnelPublicRevision(tunnelFixture());
    const b = await createTunnelPublicRevision(tunnelFixture());
    expect(a.revisionId).toBe(b.revisionId);
    expect(a.revisionId).toMatch(/^v1_[a-f0-9]{64}$/);
    expect(a.artifactType).toBe("tunnel");
  });

  it("ignores private-only differences (same public content, same id)", async () => {
    const base = await createTunnelPublicRevision(tunnelFixture());
    const withLineage = await createTunnelPublicRevision(
      tunnelFixture({
        source: "viewer",
        sourceSequenceId: "library-sequence-42",
        currentRevisionId: "v1_" + "a".repeat(64),
        currentContentDigest: "a".repeat(64),
      })
    );
    expect(withLineage.revisionId).toBe(base.revisionId);
  });

  it("changes with public content", async () => {
    const a = await createTunnelPublicRevision(tunnelFixture());
    const b = await createTunnelPublicRevision(
      tunnelFixture({ poster: "data:image/webp;base64,BB" })
    );
    expect(a.revisionId).not.toBe(b.revisionId);
  });

  it("addresses a different payload than the private revision when private extras exist", async () => {
    const tunnel = tunnelFixture({
      sourceSequenceId: "library-sequence-42",
      composition: compositionFixture(),
    });
    const privateRevision = await createTunnelRevision(tunnel, tunnel.createdAt);
    const publicRevision = await createTunnelPublicRevision(tunnel);
    expect(publicRevision.contentDigest).not.toBe(privateRevision.contentDigest);
  });
});
