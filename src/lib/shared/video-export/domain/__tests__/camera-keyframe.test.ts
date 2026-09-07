import { describe, it, expect } from "vitest";
import {
  CameraKeyframeBuffer,
  compactCameraKeyframes,
  MAX_SAVED_KEYFRAMES,
  type CameraKeyframe,
} from "../camera-keyframe";

function makeKeyframes(count: number, hz: number): CameraKeyframe[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: i / hz,
    position: [i * 0.123456789, 1.987654321, -2.5] as [number, number, number],
    quaternion: [0, 0.7071067811, 0, 0.7071067811] as [
      number,
      number,
      number,
      number,
    ],
    fov: 50.123456789,
  }));
}

describe("compactCameraKeyframes", () => {
  it("returns nothing for an empty recording", () => {
    expect(compactCameraKeyframes([])).toEqual([]);
  });

  it("keeps the first and last samples", () => {
    const frames = makeKeyframes(600, 60); // 10 seconds at 60 Hz
    const compact = compactCameraKeyframes(frames);
    expect(compact[0]!.timestamp).toBe(0);
    expect(compact[compact.length - 1]!.timestamp).toBeCloseTo(
      frames[frames.length - 1]!.timestamp,
      3
    );
  });

  it("thins a 60 Hz recording down to the requested rate", () => {
    const frames = makeKeyframes(600, 60); // 10 seconds
    const compact = compactCameraKeyframes(frames, { sampleHz: 30 });
    // 10 seconds at 30 Hz is about 300 frames, never more than the source.
    expect(compact.length).toBeLessThan(frames.length);
    expect(compact.length).toBeGreaterThan(280);
    expect(compact.length).toBeLessThanOrEqual(302);
  });

  it("rounds every number to the requested precision", () => {
    const compact = compactCameraKeyframes(makeKeyframes(3, 60), {
      sampleHz: 60,
      precision: 2,
    });
    expect(compact[1]!.position[0]).toBe(0.12);
    expect(compact[1]!.fov).toBe(50.12);
  });

  it("never exceeds the hard keyframe cap", () => {
    // 10 minutes at 60 Hz: far past what one document can hold.
    const frames = makeKeyframes(36000, 60);
    const compact = compactCameraKeyframes(frames, { sampleHz: 60 });
    expect(compact.length).toBeLessThanOrEqual(MAX_SAVED_KEYFRAMES);
    expect(compact[0]!.timestamp).toBe(0);
    expect(compact[compact.length - 1]!.timestamp).toBeCloseTo(
      frames[frames.length - 1]!.timestamp,
      3
    );
  });
});

describe("CameraKeyframeBuffer.fromKeyframes", () => {
  it("rehydrates a saved path with a usable duration", () => {
    const frames = makeKeyframes(120, 60); // just under 2 seconds
    const buffer = CameraKeyframeBuffer.fromKeyframes(frames);
    expect(buffer.keyframes.length).toBe(120);
    expect(buffer.duration).toBeCloseTo(119 / 60, 5);
  });

  it("copies the samples so later edits cannot mutate the source", () => {
    const frames = makeKeyframes(2, 60);
    const buffer = CameraKeyframeBuffer.fromKeyframes(frames);
    buffer.keyframes[0]!.position[0] = 999;
    expect(frames[0]!.position[0]).toBe(0);
  });

  it("reports zero duration for a single-sample path", () => {
    expect(CameraKeyframeBuffer.fromKeyframes(makeKeyframes(1, 60)).duration).toBe(0);
  });
});
