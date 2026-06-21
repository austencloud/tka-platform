import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { TkaPoseClassifier } from './tka-pose-classifier';

const c = new TkaPoseClassifier();

describe('TkaPoseClassifier.classifyLocation', () => {
  it('maps the four cardinals (X=East, Y=North)', () => {
    expect(c.classifyLocation(new Vector3(0, 1, 0))).toBe('n');
    expect(c.classifyLocation(new Vector3(1, 0, 0))).toBe('e');
    expect(c.classifyLocation(new Vector3(0, -1, 0))).toBe('s');
    expect(c.classifyLocation(new Vector3(-1, 0, 0))).toBe('w');
  });

  it('maps the four intercardinals', () => {
    expect(c.classifyLocation(new Vector3(1, 1, 0))).toBe('ne');
    expect(c.classifyLocation(new Vector3(1, -1, 0))).toBe('se');
    expect(c.classifyLocation(new Vector3(-1, -1, 0))).toBe('sw');
    expect(c.classifyLocation(new Vector3(-1, 1, 0))).toBe('nw');
  });

  it('ignores Z (depth) and small radius noise', () => {
    expect(c.classifyLocation(new Vector3(0.02, 0.98, 0.7))).toBe('n');
  });

  it('snaps near-boundary angles to the nearest 45deg bucket', () => {
    expect(c.classifyLocation(new Vector3(Math.sin(0.35), Math.cos(0.35), 0))).toBe('n');
    expect(c.classifyLocation(new Vector3(Math.sin(0.6), Math.cos(0.6), 0))).toBe('ne');
  });
});
