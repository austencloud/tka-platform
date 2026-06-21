import { describe, it, expect } from 'vitest';
import {
  findColorBlobEndpoints,
  assignThumbPinky,
  ColorEndTracker,
  type ColorTarget,
  type PixelPoint,
} from './color-end-tracker';

const RED: ColorTarget = { r: 255, g: 0, b: 0, tolerance: 60 };

/** Make an ImageData and paint a thick line of `color` from p0 to p1. */
function lineFrame(w: number, h: number, p0: PixelPoint, p1: PixelPoint, color = [255, 0, 0], thick = 2): ImageData {
  const img = new ImageData(w, h);
  const steps = Math.ceil(Math.hypot(p1.x - p0.x, p1.y - p0.y)) * 2;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(p0.x + (p1.x - p0.x) * t);
    const cy = Math.round(p0.y + (p1.y - p0.y) * t);
    for (let dy = -thick; dy <= thick; dy++) {
      for (let dx = -thick; dx <= thick; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        img.data[i] = color[0]!; img.data[i + 1] = color[1]!; img.data[i + 2] = color[2]!; img.data[i + 3] = 255;
      }
    }
  }
  return img;
}

describe('findColorBlobEndpoints', () => {
  it('finds the two ends of a colored line', () => {
    const frame = lineFrame(80, 80, { x: 10, y: 40 }, { x: 70, y: 40 });
    const res = findColorBlobEndpoints(frame, RED);
    expect(res).not.toBeNull();
    const xs = res!.endpoints.map((e) => e.x).sort((a, b) => a - b);
    expect(xs[0]!).toBeLessThan(20);   // near x=10
    expect(xs[1]!).toBeGreaterThan(60); // near x=70
    expect(res!.centroid.x).toBeCloseTo(40, -1);
  });

  it('returns null when the color is absent', () => {
    const frame = lineFrame(40, 40, { x: 5, y: 5 }, { x: 35, y: 35 }, [0, 0, 255]); // blue line
    expect(findColorBlobEndpoints(frame, RED)).toBeNull();
  });

  it('finds a vertical line (principal axis along Y)', () => {
    const frame = lineFrame(60, 80, { x: 30, y: 10 }, { x: 30, y: 70 });
    const res = findColorBlobEndpoints(frame, RED)!;
    const ys = res.endpoints.map((e) => e.y).sort((a, b) => a - b);
    expect(ys[0]!).toBeLessThan(20);
    expect(ys[1]!).toBeGreaterThan(60);
  });
});

describe('assignThumbPinky', () => {
  const a: PixelPoint = { x: 10, y: 10 };
  const b: PixelPoint = { x: 90, y: 90 };
  it('defaults thumb=a when no previous', () => {
    expect(assignThumbPinky(a, b, null)).toEqual({ thumb: a, pinky: b });
  });
  it('labels the endpoint nearest prevThumb as thumb', () => {
    expect(assignThumbPinky(a, b, { x: 85, y: 88 })).toEqual({ thumb: b, pinky: a });
    expect(assignThumbPinky(a, b, { x: 12, y: 9 })).toEqual({ thumb: a, pinky: b });
  });
});

describe('ColorEndTracker', () => {
  it('tracks thumb continuity across frames', () => {
    const tracker = new ColorEndTracker();
    const f1 = lineFrame(80, 80, { x: 10, y: 40 }, { x: 70, y: 40 });
    const r1 = tracker.track(f1, RED)!;
    // First frame: thumb defaults to the min-projection end (~x=10).
    expect(r1.thumb.x).toBeLessThan(20);
    // Next frame the staff has rotated ~180deg: the x=10 end is now at x=70 side.
    const f2 = lineFrame(80, 80, { x: 12, y: 40 }, { x: 72, y: 40 });
    const r2 = tracker.track(f2, RED)!;
    // Thumb should stay near its previous position (continuity), not jump.
    expect(Math.hypot(r2.thumb.x - r1.thumb.x, r2.thumb.y - r1.thumb.y)).toBeLessThan(20);
  });

  it('returns null and preserves prevThumb when the blob is lost', () => {
    const tracker = new ColorEndTracker();
    const f1 = lineFrame(80, 80, { x: 10, y: 40 }, { x: 70, y: 40 });
    tracker.track(f1, RED);
    const blank = new ImageData(80, 80);
    expect(tracker.track(blank, RED)).toBeNull();
  });
});
