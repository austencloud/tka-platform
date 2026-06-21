import { describe, it, expect } from 'vitest';
import { ScreenToGrid, type PixelPoint } from './screen-to-grid';

const center: PixelPoint = { x: 100, y: 100 };
const cal = new ScreenToGrid(center, 50);

describe('ScreenToGrid', () => {
  it('maps the grid center to the origin', () => {
    const v = cal.toGrid({ x: 100, y: 100 });
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.y).toBeCloseTo(0, 6);
    expect(v.z).toBe(0);
  });

  it('maps a point above center (smaller screen-y) to grid North (+Y)', () => {
    const v = cal.toGrid({ x: 100, y: 50 });
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.y).toBeCloseTo(1, 6);
  });

  it('maps a point right of center to grid East (+X)', () => {
    const v = cal.toGrid({ x: 150, y: 100 });
    expect(v.x).toBeCloseTo(1, 6);
    expect(v.y).toBeCloseTo(0, 6);
  });

  it('maps a point below center to grid South (-Y)', () => {
    const v = cal.toGrid({ x: 100, y: 150 });
    expect(v.y).toBeCloseTo(-1, 6);
  });

  it('scales by radiusPx', () => {
    const v = cal.toGrid({ x: 200, y: 100 }); // 100px right = 2 radii
    expect(v.x).toBeCloseTo(2, 6);
  });

  it('toGridDir maps a screen displacement to a grid direction (Y flipped, unscaled-direction)', () => {
    // A screen vector pointing down-right -> grid down-right (x+, y-).
    const d = cal.toGridDir({ x: 10, y: 0 }, { x: 10, y: 20 });
    expect(d.x).toBeCloseTo(0, 6);
    expect(d.y).toBeLessThan(0); // downward screen = -Y grid
    expect(d.z).toBe(0);
  });
});
