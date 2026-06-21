import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { framesToNotation } from './notation-pipeline';
import type { StaffPose3D } from '../domain/notation-3d';

function p(x: number, y: number, axis: Vector3, roll = 0): StaffPose3D {
  return { gripPos: new Vector3(x, y, 0), axisDir: axis, rollRad: roll };
}

describe('framesToNotation', () => {
  it('turns held->move->held staff streams into one motion notation per staff', () => {
    const out = new Vector3(0, 1, 0);
    const east = new Vector3(1, 0, 0);
    const blueFrames: StaffPose3D[] = [
      p(0, 1, out), p(0, 1, out), p(0, 1, out),
      p(0.7, 0.7, new Vector3(0.7, 0.7, 0)), p(1, 0, east),
      p(1, 0, east), p(1, 0, east), p(1, 0, east),
    ];
    const redFrames: StaffPose3D[] = [
      p(0, -1, new Vector3(0, -1, 0)), p(0, -1, new Vector3(0, -1, 0)), p(0, -1, new Vector3(0, -1, 0)),
      p(0, -1, new Vector3(0, -1, 0)), p(0, -1, new Vector3(0, -1, 0)),
      p(0, -1, new Vector3(0, -1, 0)), p(0, -1, new Vector3(0, -1, 0)), p(0, -1, new Vector3(0, -1, 0)),
    ];
    const confidences = blueFrames.map(() => 1);

    const beats = framesToNotation(blueFrames, redFrames, confidences, confidences);
    expect(beats.length).toBeGreaterThanOrEqual(1);
    const first = beats[0]!;
    expect(first.blue.startLocation).toBe('n');
    expect(first.blue.endLocation).toBe('e');
    expect(first.blue.handMotion).toBe('shift');
    expect(first.red.handMotion).toBe('static');
  });
});
