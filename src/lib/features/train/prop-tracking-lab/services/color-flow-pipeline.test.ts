import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { endpointPairToPose, trackStaffPoses, notateColorFlow } from './color-flow-pipeline';
import { ScreenToGrid } from './screen-to-grid';
import type { ColorTarget, PixelPoint, EndpointPair } from './color-end-tracker';

const cal = new ScreenToGrid({ x: 100, y: 100 }, 50);
const BLUE: ColorTarget = { r: 0, g: 0, b: 255, tolerance: 60 };
const RED: ColorTarget = { r: 255, g: 0, b: 0, tolerance: 60 };

/** Paint a thick line of `color` from p0 to p1 onto an existing ImageData. */
function paintLine(img: ImageData, p0: PixelPoint, p1: PixelPoint, color: number[], thick = 2) {
  const w = img.width, h = img.height;
  const steps = Math.ceil(Math.hypot(p1.x - p0.x, p1.y - p0.y)) * 2 + 1;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(p0.x + (p1.x - p0.x) * t);
    const cy = Math.round(p0.y + (p1.y - p0.y) * t);
    for (let dy = -thick; dy <= thick; dy++) for (let dx = -thick; dx <= thick; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      img.data[i] = color[0]!; img.data[i + 1] = color[1]!; img.data[i + 2] = color[2]!; img.data[i + 3] = 255;
    }
  }
}

describe('endpointPairToPose', () => {
  it('grip = midpoint, axisDir = unit(thumb - pinky) in grid frame', () => {
    // thumb above center (North, out), pinky toward center. Both at x=100.
    const pair: EndpointPair = { thumb: { x: 100, y: 40 }, pinky: { x: 100, y: 60 }, confidence: 1 };
    const pose = endpointPairToPose(pair, cal);
    expect(pose.gripPos.x).toBeCloseTo(0, 5);
    expect(pose.gripPos.y).toBeCloseTo(1, 5);   // midpoint (100,50) -> North
    expect(pose.axisDir.x).toBeCloseTo(0, 5);
    expect(pose.axisDir.y).toBeCloseTo(1, 5);   // thumb above pinky -> points +North (out)
    expect(pose.rollRad).toBe(0);
  });
});

describe('trackStaffPoses', () => {
  it('produces one pose per frame and holds last pose through a blob dropout', () => {
    const mk = (line: [PixelPoint, PixelPoint] | null) => {
      const img = new ImageData(200, 200);
      if (line) paintLine(img, line[0], line[1], [255, 0, 0]);
      return img;
    };
    const frames = [
      mk([{ x: 100, y: 40 }, { x: 100, y: 60 }]),  // North
      mk(null),                                     // dropout
      mk([{ x: 100, y: 42 }, { x: 100, y: 62 }]),  // North again
    ];
    const { poses, confidence } = trackStaffPoses(frames, RED, cal);
    expect(poses.length).toBe(3);
    expect(confidence[1]).toBe(0);                  // dropout frame flagged
    expect(poses[1]!.gripPos.y).toBeCloseTo(poses[0]!.gripPos.y, 1); // held
  });
});

describe('notateColorFlow', () => {
  it('classifies a blue shift N->E with red static at South from synthetic LED frames', () => {
    const frame = (bluePts: [PixelPoint, PixelPoint], redPts: [PixelPoint, PixelPoint]) => {
      const img = new ImageData(200, 200);
      paintLine(img, bluePts[0], bluePts[1], [0, 0, 255]);
      paintLine(img, redPts[0], redPts[1], [255, 0, 0]);
      return img;
    };
    // Blue grip: held North (~100,50) x3, move, held East (~150,100) x4.
    // Red grip: held South (~100,150) throughout.
    const redLine: [PixelPoint, PixelPoint] = [{ x: 100, y: 140 }, { x: 100, y: 160 }];
    const blueN: [PixelPoint, PixelPoint] = [{ x: 100, y: 40 }, { x: 100, y: 60 }];
    const blueE: [PixelPoint, PixelPoint] = [{ x: 140, y: 100 }, { x: 160, y: 100 }];
    const blueMid: [PixelPoint, PixelPoint] = [{ x: 130, y: 70 }, { x: 150, y: 90 }];
    const frames = [
      frame(blueN, redLine), frame(blueN, redLine), frame(blueN, redLine),
      frame(blueMid, redLine),
      frame(blueE, redLine), frame(blueE, redLine), frame(blueE, redLine), frame(blueE, redLine),
    ];
    const beats = notateColorFlow(frames, BLUE, RED, cal);
    expect(beats.length).toBeGreaterThanOrEqual(1);
    expect(beats[0]!.blue.startLocation).toBe('n');
    expect(beats[0]!.blue.endLocation).toBe('e');
    expect(beats[0]!.blue.handMotion).toBe('shift');
    expect(beats[0]!.red.handMotion).toBe('static');
  });
});
