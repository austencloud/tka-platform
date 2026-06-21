import { describe, it, expect } from 'vitest';
import { Vector3, Matrix4 } from 'three';
import { GridFrameSolver } from './grid-frame-solver';
import type { DetectedMarker } from '../domain/notation-3d';

/** Build a DetectedMarker from a row-major 3x3 rotation + camera translation. */
function marker(id: number, rotRowMajor: number[], pos: Vector3): DetectedMarker {
  return { id, posCam: pos, rotCam: rotRowMajor, corners: [] };
}

const IDENTITY3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe('GridFrameSolver', () => {
  it('with center at camera origin, staff grip maps to its camera translation', () => {
    const center = marker(0, IDENTITY3, new Vector3(0, 0, 0));
    const staff = marker(1, IDENTITY3, new Vector3(0.3, 0.1, 0.4));
    const gridFromCam = GridFrameSolver.gridFromCamera(center);
    const pose = GridFrameSolver.solve(staff, gridFromCam);
    expect(pose.gripPos.x).toBeCloseTo(0.3, 5);
    expect(pose.gripPos.y).toBeCloseTo(0.1, 5);
    expect(pose.gripPos.z).toBeCloseTo(0.4, 5);
  });

  it('reads the shaft axis (marker local +Y) into the grid frame', () => {
    const center = marker(0, IDENTITY3, new Vector3(0, 0, 0));
    const staff = marker(1, IDENTITY3, new Vector3(0, 0, 0.5));
    const pose = GridFrameSolver.solve(staff, GridFrameSolver.gridFromCamera(center));
    expect(pose.axisDir.x).toBeCloseTo(0, 5);
    expect(pose.axisDir.y).toBeCloseTo(1, 5);
    expect(pose.axisDir.z).toBeCloseTo(0, 5);
  });

  it('a staff lying along East has axisDir = grid +X', () => {
    // Row-major rotation mapping marker local +Y -> grid +X: R*(0,1,0)=(1,0,0).
    const rz = [0, 1, 0, -1, 0, 0, 0, 0, 1];
    const center = marker(0, IDENTITY3, new Vector3(0, 0, 0));
    const staff = marker(1, rz, new Vector3(0.3, 0, 0.5));
    const pose = GridFrameSolver.solve(staff, GridFrameSolver.gridFromCamera(center));
    expect(pose.axisDir.x).toBeCloseTo(1, 5);
    expect(pose.axisDir.y).toBeCloseTo(0, 5);
  });

  it('expresses staff pose relative to a rotated/translated center marker', () => {
    const center = marker(0, IDENTITY3, new Vector3(1, 0, 2));
    const staff = marker(1, IDENTITY3, new Vector3(1.3, 0, 2));
    const pose = GridFrameSolver.solve(staff, GridFrameSolver.gridFromCamera(center));
    expect(pose.gripPos.x).toBeCloseTo(0.3, 5);
    expect(pose.gripPos.y).toBeCloseTo(0, 5);
    expect(pose.gripPos.z).toBeCloseTo(0, 5);
  });

  it('roll is 0 for an identity-oriented staff and tracks a twist about the axis', () => {
    const center = marker(0, IDENTITY3, new Vector3(0, 0, 0));
    const staff0 = marker(1, IDENTITY3, new Vector3(0, 0, 0.5));
    expect(GridFrameSolver.solve(staff0, GridFrameSolver.gridFromCamera(center)).rollRad)
      .toBeCloseTo(0, 4);

    // Row-major Ry(90): [0,0,1, 0,1,0, -1,0,0]
    const ry = [0, 0, 1, 0, 1, 0, -1, 0, 0];
    const staffTwisted = marker(1, ry, new Vector3(0, 0, 0.5));
    const roll = GridFrameSolver.solve(staffTwisted, GridFrameSolver.gridFromCamera(center)).rollRad;
    expect(Math.abs(roll)).toBeCloseTo(Math.PI / 2, 3);
  });
});
