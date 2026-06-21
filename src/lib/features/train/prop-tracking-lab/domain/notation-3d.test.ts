import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { createMarkerAssignment, DEFAULT_MARKER_ASSIGNMENT } from './notation-3d';
import type { StaffPose3D, DetectedMarker } from './notation-3d';

describe('notation-3d types', () => {
  it('DEFAULT_MARKER_ASSIGNMENT has distinct ids and a positive marker size', () => {
    const a = DEFAULT_MARKER_ASSIGNMENT;
    const ids = new Set([a.centerRefId, a.blueId, a.redId]);
    expect(ids.size).toBe(3);
    expect(a.markerSizeMm).toBeGreaterThan(0);
  });

  it('createMarkerAssignment overrides only provided fields', () => {
    const a = createMarkerAssignment({ blueId: 7 });
    expect(a.blueId).toBe(7);
    expect(a.centerRefId).toBe(DEFAULT_MARKER_ASSIGNMENT.centerRefId);
  });

  it('StaffPose3D / DetectedMarker are usable structurally', () => {
    const marker: DetectedMarker = {
      id: 1, posCam: new Vector3(0, 0, 500), rotCam: [1, 0, 0, 0, 1, 0, 0, 0, 1], corners: [],
    };
    const pose: StaffPose3D = { gripPos: new Vector3(), axisDir: new Vector3(0, 1, 0), rollRad: 0 };
    expect(marker.rotCam).toHaveLength(9);
    expect(pose.axisDir.y).toBe(1);
  });
});
