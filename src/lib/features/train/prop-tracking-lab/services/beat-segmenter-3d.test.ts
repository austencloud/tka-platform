import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { segmentBeats3D, accumulateBetween } from './beat-segmenter-3d';
import type { StaffPose3D } from '../domain/notation-3d';

/** axisAngle = world-plane angle of the staff's facing vector (default North). */
function pose(x: number, y: number, axisAngle = Math.PI / 2): StaffPose3D {
  return {
    gripPos: new Vector3(x, y, 0),
    axisDir: new Vector3(Math.cos(axisAngle), Math.sin(axisAngle), 0),
  };
}

describe('segmentBeats3D', () => {
  it('finds two held spans separated by motion', () => {
    const frames: StaffPose3D[] = [
      pose(0, 1), pose(0, 1), pose(0, 1), pose(0, 1),
      pose(0.3, 0.9), pose(0.6, 0.6), pose(0.9, 0.3),
      pose(1, 0), pose(1, 0), pose(1, 0), pose(1, 0),
    ];
    const beats = segmentBeats3D(frames, { motionThreshold: 0.05, minHeldFrames: 3 });
    expect(beats.length).toBe(2);
    expect(beats[0]!.gripPos.y).toBeCloseTo(1, 5);
    expect(beats[1]!.gripPos.x).toBeCloseTo(1, 5);
  });

  it('a single held span yields one beat', () => {
    const frames = [pose(0, 1), pose(0, 1), pose(0, 1), pose(0, 1)];
    expect(segmentBeats3D(frames, { motionThreshold: 0.05, minHeldFrames: 3 }).length).toBe(1);
  });
});

describe('accumulateBetween', () => {
  it('sums signed arc angle (CCW positive) and net roll between two frame indices', () => {
    // Grip sweeps N->W (+PI/2 CCW); the staff's facing vector advances +0.2 rad.
    const frames: StaffPose3D[] = [
      pose(0, 1, Math.PI / 2),
      pose(-0.7, 0.7, Math.PI / 2 + 0.1),
      pose(-1, 0, Math.PI / 2 + 0.2),
    ];
    const { arcAngle, propNetRotation } = accumulateBetween(frames, 0, 2);
    expect(arcAngle).toBeCloseTo(Math.PI / 2, 2);
    expect(propNetRotation).toBeCloseTo(0.2, 4);
  });

  it('unwraps prop rotation (axisDir angle) across the +/-PI seam', () => {
    // Facing-vector angle jumps 3.0 -> -3.0: a +0.283 step across PI, not -6.0.
    const frames: StaffPose3D[] = [pose(0, 1, 3.0), pose(0, 1, -3.0)];
    const { propNetRotation } = accumulateBetween(frames, 0, 1);
    expect(propNetRotation).toBeCloseTo((Math.PI - 3.0) * 2, 3);
  });
});
