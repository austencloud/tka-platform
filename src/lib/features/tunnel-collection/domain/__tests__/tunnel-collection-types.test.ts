import { describe, it, expect } from "vitest";
import {
  CollectedTunnelSchema,
  TUNNEL_COLLECTION_STORAGE_KEY,
  type CollectedTunnel,
} from "../tunnel-collection-types";
import { SNAPSHOT_VERSION } from "$lib/shared/sequence-viewer/tunnel/tunnel-snapshot";
import { DEFAULT_CONFIG } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  createDerivedTunnelPerformer,
  createIndependentTunnelPerformer,
  createTunnelComposition,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
import {
  createTunnelRevision,
  prepareTunnelRevision,
} from "../tunnel-revision";

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
};

const valid = {
  id: "t1",
  name: "My Tunnel",
  steps: [],
  snapshot,
  poster: "data:image/webp;base64,AA",
  createdAt: 123,
};

describe("CollectedTunnelSchema", () => {
  it("accepts a well-formed record", () => {
    expect(CollectedTunnelSchema.safeParse(valid).success).toBe(true);
  });
  it("requires an id", () => {
    const { id: _drop, ...rest } = valid;
    expect(CollectedTunnelSchema.safeParse(rest).success).toBe(false);
  });
  it("exposes the storage key", () => {
    expect(TUNNEL_COLLECTION_STORAGE_KEY).toBe("tka:tunnel-collection");
  });

  // Unit 3 (lineage stamp): old entries lack sourceWord/sourceSequenceId
  // entirely — the schema must still accept them.
  it("accepts an entry with no lineage stamp (old entries)", () => {
    expect(CollectedTunnelSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an entry stamped with a simplified source word + id", () => {
    // The stamp always goes through simplifyRepeatedWord at save time — a
    // repeating word like "FΨFΨFΨFΨ" is stored as its shortest form "FΨ",
    // never the raw repeated string (rule: simplified-word-display).
    const sourceWord = simplifyRepeatedWord("FΨFΨFΨFΨ");
    expect(sourceWord).toBe("FΨ");

    const stamped = { ...valid, sourceWord, sourceSequenceId: "seq-123" };
    const result = CollectedTunnelSchema.safeParse(stamped);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceWord).toBe("FΨ");
      expect(result.data.sourceSequenceId).toBe("seq-123");
    }
  });

  it("accepts a saved multi-performer composition", () => {
    const sequence = createSequenceData({
      id: "sequence-1",
      name: "Lead",
      word: "LEAD",
      steps: [],
    });
    const lead = createIndependentTunnelPerformer(sequence, 0, "Lead");
    const partner = createDerivedTunnelPerformer(lead.id, 1, [
      { kind: "rotate", amount: 3 },
      { kind: "mirror" },
      { kind: "rewind" },
    ]);
    partner.timing = { stepOffset: 2, speed: 0.5 };
    const composition = createTunnelComposition([lead, partner]);

    const parsed = CollectedTunnelSchema.safeParse({ ...valid, composition });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.composition?.performers[1]).toEqual(partner);
  });

  it("stores choreography transforms in the immutable tunnel revision", async () => {
    const sequence = createSequenceData({
      id: "sequence-1",
      name: "Lead",
      word: "LEAD",
      steps: [],
    });
    const lead = createIndependentTunnelPerformer(sequence, 0, "Lead");
    const partner = createDerivedTunnelPerformer(lead.id, 1, [
      { kind: "flip" },
      { kind: "invert" },
    ]);
    partner.timing = { stepOffset: 3, speed: 2 };
    const composition = createTunnelComposition([lead, partner]);
    const tunnel = { ...valid, composition } as CollectedTunnel;

    const prepared = await prepareTunnelRevision(tunnel);
    const revision = await createTunnelRevision(
      prepared,
      prepared.currentRevisionCreatedAt!
    );

    expect(revision.payload.composition?.performers[1]).toEqual(partner);
  });

  it("creates deterministic immutable revisions and advances only on content edits", async () => {
    const first = await prepareTunnelRevision(valid as CollectedTunnel);
    const same = await prepareTunnelRevision(
      { ...first, name: "Renamed" },
      first
    );
    const changed = await prepareTunnelRevision(
      {
        ...same,
        snapshot: {
          ...same.snapshot,
          playback: { ...same.snapshot.playback, bpm: 90 },
        },
      },
      same
    );

    expect(first.currentRevisionId).toMatch(/^v1_[a-f0-9]{64}$/);
    expect(same.currentRevisionId).toBe(first.currentRevisionId);
    expect(changed.currentRevisionId).not.toBe(first.currentRevisionId);

    const retained = await createTunnelRevision(
      first,
      first.currentRevisionCreatedAt!
    );
    const retainedChange = await createTunnelRevision(
      changed,
      changed.currentRevisionCreatedAt!
    );
    expect(retained.payload.snapshot.playback.bpm).toBe(60);
    expect(retainedChange.payload.snapshot.playback.bpm).toBe(90);
    expect(retained.revisionId).toBe(first.currentRevisionId);
    expect(retainedChange.revisionId).toBe(changed.currentRevisionId);
  });
});
