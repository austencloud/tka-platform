import { describe, it, expect } from 'vitest';
import { ArucoStaffTracker } from './aruco-staff-tracker';
import { DEFAULT_MARKER_ASSIGNMENT } from '../domain/notation-3d';

describe('ArucoStaffTracker (smoke)', () => {
  it('constructs the detector + posit without throwing', () => {
    const tracker = new ArucoStaffTracker(DEFAULT_MARKER_ASSIGNMENT, 640);
    expect(tracker).toBeInstanceOf(ArucoStaffTracker);
  });

  it('returns an empty array on a blank frame', () => {
    const tracker = new ArucoStaffTracker(DEFAULT_MARKER_ASSIGNMENT, 640);
    const blank = new ImageData(64, 64);
    expect(tracker.detect(blank)).toEqual([]);
  });
});
