import { describe, it, expect } from "vitest";
import { TunnelSnapshotSchema, SNAPSHOT_VERSION } from "./tunnel-snapshot";
import { DEFAULT_CONFIG } from "./tunnel-config";

const validSnapshot = {
  version: SNAPSHOT_VERSION,
  tunnel: { config: DEFAULT_CONFIG, gridVisible: false, spectrum: true, section: "tunnel" },
  effects: { activeEffect: "none" },
  effort: "linear",
  paths: { pathShape: "arc", motionAwarePaths: false, bluePathLines: false, redPathLines: false },
  playback: { bpm: 60, playbackMode: "continuous" },
  props: { bluePropType: "staff", redPropType: "staff" },
  trailRender: { mode: "trail" },
};

describe("TunnelSnapshotSchema", () => {
  it("accepts a well-formed snapshot", () => {
    expect(TunnelSnapshotSchema.safeParse(validSnapshot).success).toBe(true);
  });
  it("rejects a snapshot missing the tunnel block", () => {
    const { tunnel: _drop, ...rest } = validSnapshot;
    expect(TunnelSnapshotSchema.safeParse(rest).success).toBe(false);
  });
  it("rejects a bad section value", () => {
    const bad = { ...validSnapshot, tunnel: { ...validSnapshot.tunnel, section: "bogus" } };
    expect(TunnelSnapshotSchema.safeParse(bad).success).toBe(false);
  });
});
