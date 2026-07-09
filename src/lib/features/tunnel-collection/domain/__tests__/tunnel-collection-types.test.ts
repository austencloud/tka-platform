import { describe, it, expect } from "vitest";
import { CollectedTunnelSchema, TUNNEL_COLLECTION_STORAGE_KEY } from "../tunnel-collection-types";
import { SNAPSHOT_VERSION } from "$lib/shared/sequence-viewer/tunnel/tunnel-snapshot";
import { DEFAULT_CONFIG } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";

const snapshot = {
  version: SNAPSHOT_VERSION,
  tunnel: { config: DEFAULT_CONFIG, gridVisible: false, spectrum: true, section: "tunnel" },
  effects: { activeEffect: "none" },
  effort: "linear",
  paths: { pathShape: "arc", motionAwarePaths: false, bluePathLines: false, redPathLines: false },
  playback: { bpm: 60, playbackMode: "continuous" },
  props: { bluePropType: "staff", redPropType: "staff" },
  trailRender: { mode: "none" },
};

const valid = { id: "t1", name: "My Tunnel", steps: [], snapshot, poster: "data:image/webp;base64,AA", createdAt: 123 };

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
});
