import { describe, it, expect } from "vitest";
import { TunnelSnapshotSchema, SNAPSHOT_VERSION } from "./tunnel-snapshot";
import { captureTunnelSnapshot, type SnapshotDeps } from "./tunnel-snapshot";
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

function fakeDeps(): SnapshotDeps {
  return {
    controller: {
      config: { ...DEFAULT_CONFIG, fold: 4 },
      gridVisible: true,
      spectrum: false,
      section: "effects",
      applyConfig() {},
    } as unknown as SnapshotDeps["controller"],
    effects: { config: { activeEffect: "fire", tag: "E" }, replace() {} } as unknown as SnapshotDeps["effects"],
    visibility: {
      getEffortPreset: () => "sharp",
      getPathShape: () => "concave",
      getMotionAwarePaths: () => true,
      getVisibility: (k: string) => k === "bluePathLines",
      setEffortPreset() {}, setPathShape() {}, setMotionAwarePaths() {}, setVisibility() {},
    } as unknown as SnapshotDeps["visibility"],
    settings: { bluePropType: "fan", redPropType: "club", updateSettings() {} } as unknown as SnapshotDeps["settings"],
    animationSettings: { trail: { mode: "trail", tag: "T" }, updateSettings() {} } as unknown as SnapshotDeps["animationSettings"],
    playback: { handleBpmChange() {}, handlePlaybackModeChange() {} } as unknown as SnapshotDeps["playback"],
    animationPanel: { playbackMode: "step" } as unknown as SnapshotDeps["animationPanel"],
    getBpm: () => 144,
  };
}

describe("captureTunnelSnapshot", () => {
  it("reads every store into the flat blob", () => {
    const snap = captureTunnelSnapshot(fakeDeps());
    expect(snap.version).toBe(SNAPSHOT_VERSION);
    expect(snap.tunnel).toEqual({ config: { ...DEFAULT_CONFIG, fold: 4 }, gridVisible: true, spectrum: false, section: "effects" });
    expect(snap.effort).toBe("sharp");
    expect(snap.paths).toEqual({ pathShape: "concave", motionAwarePaths: true, bluePathLines: true, redPathLines: false });
    expect(snap.playback).toEqual({ bpm: 144, playbackMode: "step" });
    expect(snap.props).toEqual({ bluePropType: "fan", redPropType: "club" });
  });

  it("deep-clones effects + trailRender (no shared reference to the live store)", () => {
    const deps = fakeDeps();
    const snap = captureTunnelSnapshot(deps);
    expect(snap.effects).toEqual(deps.effects.config);
    expect(snap.effects).not.toBe(deps.effects.config);
    expect(snap.trailRender).toEqual(deps.animationSettings.trail);
    expect(snap.trailRender).not.toBe(deps.animationSettings.trail);
  });

  it("passes the schema it produces", () => {
    expect(TunnelSnapshotSchema.safeParse(captureTunnelSnapshot(fakeDeps())).success).toBe(true);
  });
});
