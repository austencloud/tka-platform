/**
 * Degradation tests — synthetic approximations of real-video pathologies.
 *
 * The pipeline has never seen real footage; these tests encode the failure
 * modes we EXPECT real clips to exhibit (speckle noise, same-color
 * reflections, blur lumps, fast spin, dropped frames, foreshortening,
 * mid-swing tracking loss) so the hardening is testable before the first
 * ground-truth clip lands. They are NOT a substitute for real-clip
 * validation.
 */
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  findColorBlobEndpoints,
  assignThumbPinky,
  ColorEndTracker,
  type ColorTarget,
  type PixelPoint,
} from './color-end-tracker';
import { segmentBeatIndices3D } from './beat-segmenter-3d';
import type { StaffPose3D } from '../domain/notation-3d';

const RED: ColorTarget = { r: 255, g: 0, b: 0, tolerance: 60 };

function setPixel(img: ImageData, x: number, y: number, color: number[]) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = color[0]!;
  img.data[i + 1] = color[1]!;
  img.data[i + 2] = color[2]!;
  img.data[i + 3] = 255;
}

function paintLine(img: ImageData, p0: PixelPoint, p1: PixelPoint, color = [255, 0, 0], thick = 2) {
  const steps = Math.ceil(Math.hypot(p1.x - p0.x, p1.y - p0.y)) * 2 + 1;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(p0.x + (p1.x - p0.x) * t);
    const cy = Math.round(p0.y + (p1.y - p0.y) * t);
    for (let dy = -thick; dy <= thick; dy++)
      for (let dx = -thick; dx <= thick; dx++) setPixel(img, cx + dx, cy + dy, color);
  }
}

function paintBlock(img: ImageData, x0: number, y0: number, size: number, color = [255, 0, 0]) {
  for (let y = y0; y < y0 + size; y++)
    for (let x = x0; x < x0 + size; x++) setPixel(img, x, y, color);
}

/** Staff endpoints on a circle: center +/- r at angle theta (screen coords, y down). */
function staffEnds(cx: number, cy: number, r: number, thetaRad: number): [PixelPoint, PixelPoint] {
  const dx = r * Math.cos(thetaRad);
  const dy = r * Math.sin(thetaRad);
  return [
    { x: Math.round(cx + dx), y: Math.round(cy + dy) },
    { x: Math.round(cx - dx), y: Math.round(cy - dy) },
  ];
}

describe('blob segmentation under clutter (connected components)', () => {
  it('ignores scattered same-color speckle noise', () => {
    const img = new ImageData(200, 200);
    paintLine(img, { x: 60, y: 100 }, { x: 140, y: 100 });
    // Deterministic speckle spray, single pixels, far from the line.
    const specks: [number, number][] = [
      [10, 10], [190, 15], [15, 185], [185, 190], [40, 30], [170, 170],
      [25, 160], [175, 40], [90, 10], [110, 190], [10, 95], [195, 105],
    ];
    for (const [x, y] of specks) setPixel(img, x, y, [255, 0, 0]);

    const res = findColorBlobEndpoints(img, RED)!;
    expect(res).not.toBeNull();
    const xs = res.endpoints.map((e) => e.x).sort((a, b) => a - b);
    // Endpoints stay on the line (old full-frame PCA would hand them to the
    // farthest speckles, e.g. the frame corners).
    expect(xs[0]!).toBeGreaterThan(50);
    expect(xs[0]!).toBeLessThan(70);
    expect(xs[1]!).toBeGreaterThan(130);
    expect(xs[1]!).toBeLessThan(150);
    expect(res.endpoints.every((e) => Math.abs(e.y - 100) <= 4)).toBe(true);
  });

  it('a disconnected same-color reflection does not steal the endpoints, but taxes confidence', () => {
    const img = new ImageData(200, 200);
    paintLine(img, { x: 60, y: 100 }, { x: 140, y: 100 }); // the staff (~85x5 px)
    paintBlock(img, 20, 20, 9); // a same-color reflection (81 px, smaller mass)

    const res = findColorBlobEndpoints(img, RED)!;
    expect(res).not.toBeNull();
    // Endpoints belong to the line, not the reflection.
    expect(res.endpoints.every((e) => Math.abs(e.y - 100) <= 4)).toBe(true);
    // The competing component is reported and penalizes confidence.
    expect(res.secondaryMassRatio).toBeGreaterThan(0.1);
    const clean = new ImageData(200, 200);
    paintLine(clean, { x: 60, y: 100 }, { x: 140, y: 100 });
    const cleanRes = findColorBlobEndpoints(clean, RED)!;
    expect(res.confidence).toBeLessThan(cleanRes.confidence);
  });

  it('a blur lump touching one end keeps the principal axis on the staff', () => {
    const img = new ImageData(200, 200);
    paintLine(img, { x: 60, y: 100 }, { x: 140, y: 100 });
    paintBlock(img, 136, 94, 12); // glow/blur lump merged onto the right end

    const res = findColorBlobEndpoints(img, RED)!;
    expect(res).not.toBeNull();
    const [a, b] = res.endpoints;
    const angle = Math.atan2(Math.abs(a.y - b.y), Math.abs(a.x - b.x));
    // Axis within ~20deg of the true staff direction despite the lump.
    expect(angle).toBeLessThan((20 * Math.PI) / 180);
  });
});

describe('thumb/pinky correspondence under fast spin (predictive assignment)', () => {
  it('nearest-to-previous aliases at a >90deg/frame step (documented failure mode)', () => {
    // Pure geometry, no tracker: staff spinning about a fixed grip. At a
    // 110deg step the WRONG end is nearer to the previous thumb.
    const c = { x: 100, y: 100 };
    const r = 30;
    const prevThumb = staffEnds(c.x, c.y, r, (240 * Math.PI) / 180)[0];
    const [correct, wrong] = staffEnds(c.x, c.y, r, (350 * Math.PI) / 180);
    const { thumb } = assignThumbPinky(correct, wrong, prevThumb);
    expect(thumb).toEqual(wrong); // the old heuristic flips the label
  });

  it('tracks an accelerating spin (30->110deg/frame) without label flips', () => {
    const c = { x: 100, y: 100 };
    const r = 30;
    const steps = [0, 30, 50, 70, 90, 110]; // per-frame deltas, degrees
    const tracker = new ColorEndTracker();

    let theta = 0;
    let expectedThumbAngle: number | null = null;
    for (const step of steps) {
      theta += (step * Math.PI) / 180;
      const [e0, e1] = staffEnds(c.x, c.y, r, theta);
      const img = new ImageData(200, 200);
      paintLine(img, e0, e1, [255, 0, 0]);
      const pair = tracker.track(img, RED)!;
      expect(pair).not.toBeNull();

      const thumbDir = { x: pair.thumb.x - c.x, y: pair.thumb.y - c.y };
      if (expectedThumbAngle === null) {
        // Lock the expectation to whichever end the tracker labeled first.
        expectedThumbAngle = Math.atan2(thumbDir.y, thumbDir.x) - theta;
      }
      const expAngle = expectedThumbAngle + theta;
      const dot = thumbDir.x * Math.cos(expAngle) + thumbDir.y * Math.sin(expAngle);
      // Same end as expected (a flip would make the dot strongly negative).
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('coasts the prediction through dropped frames and re-acquires the right end', () => {
    const c = { x: 100, y: 100 };
    const r = 30;
    const tracker = new ColorEndTracker();
    const frameAt = (thetaDeg: number) => {
      const img = new ImageData(200, 200);
      const [e0, e1] = staffEnds(c.x, c.y, r, (thetaDeg * Math.PI) / 180);
      paintLine(img, e0, e1, [255, 0, 0]);
      return img;
    };
    const blank = new ImageData(200, 200);

    // Spin at 40deg/frame: seen at 0, 40, 80 — two dropped frames — seen at 200.
    const r0 = tracker.track(frameAt(0), RED)!;
    tracker.track(frameAt(40), RED);
    const r2 = tracker.track(frameAt(80), RED)!;
    expect(tracker.track(blank, RED)).toBeNull();
    expect(tracker.track(blank, RED)).toBeNull();
    const r5 = tracker.track(frameAt(200), RED)!;

    // Which end did the tracker lock onto at frame 0? (PCA end order is
    // deterministic but not tied to theta=0.) Expected thumb direction after
    // 200deg of cumulative rotation from wherever it started:
    const startAngle = Math.atan2(r0.thumb.y - c.y, r0.thumb.x - c.x);
    const expAngle = startAngle + (200 * Math.PI) / 180;
    const dir = { x: r5.thumb.x - c.x, y: r5.thumb.y - c.y };
    const dot = dir.x * Math.cos(expAngle) + dir.y * Math.sin(expAngle);
    expect(dot).toBeGreaterThan(0); // correct end after the gap

    // Sanity: nearest-to-previous WOULD have flipped here (120deg swept while
    // dark puts the WRONG end nearer to the pre-dropout thumb).
    const [eA, eB] = staffEnds(c.x, c.y, r, (200 * Math.PI) / 180);
    const naive = assignThumbPinky(eA, eB, r2.thumb);
    const naiveDir = { x: naive.thumb.x - c.x, y: naive.thumb.y - c.y };
    const naiveDot = naiveDir.x * Math.cos(expAngle) + naiveDir.y * Math.sin(expAngle);
    expect(naiveDot).toBeLessThan(0); // it grabs the opposite end
  });

  it('reports low correspondence confidence when the assignment is ambiguous', () => {
    // 90deg step with no velocity history: both hypotheses cost the same.
    const c = { x: 100, y: 100 };
    const r = 30;
    const tracker = new ColorEndTracker();
    const frameAt = (thetaDeg: number) => {
      const img = new ImageData(200, 200);
      const [e0, e1] = staffEnds(c.x, c.y, r, (thetaDeg * Math.PI) / 180);
      paintLine(img, e0, e1, [255, 0, 0]);
      return img;
    };
    tracker.track(frameAt(0), RED);
    const pair = tracker.track(frameAt(90), RED)!;
    // Velocity was zero, prediction = previous position, both ends equidistant.
    expect(pair.detail.correspondence).toBeLessThan(0.3);
  });
});

describe('foreshortening (single-view orientation collapse)', () => {
  it('drops orientation confidence as the projected staff length collapses', () => {
    const tracker = new ColorEndTracker();
    const frameWithLen = (halfLen: number) => {
      const img = new ImageData(200, 200);
      paintLine(img, { x: 100 - halfLen, y: 100 }, { x: 100 + halfLen, y: 100 });
      return img;
    };
    const full = tracker.track(frameWithLen(30), RED)!; // 60 px staff
    expect(full.detail.orientation).toBeGreaterThan(0.9);

    tracker.track(frameWithLen(20), RED); // tilting toward the camera...
    const collapsed = tracker.track(frameWithLen(5), RED)!; // ...nearly end-on
    expect(collapsed.detail.orientation).toBeLessThan(0.15);
  });
});

describe('beat segmentation under mid-swing dropout', () => {
  function pose(x: number, y: number): StaffPose3D {
    return { gripPos: new Vector3(x, y, 0), axisDir: new Vector3(0, 1, 0) };
  }

  it('does not fabricate a beat from held-last-pose dropout frames', () => {
    // Hold at N, swing toward E with a 3-frame dropout mid-swing (the
    // upstream tracker holds the last pose, so the frames are identical),
    // then hold at E.
    const frames: StaffPose3D[] = [
      pose(0, 1), pose(0, 1), pose(0, 1), pose(0, 1),          // hold A: 0-3
      pose(0.2, 0.98), pose(0.4, 0.92),                        // swing: 4-5
      pose(0.4, 0.92), pose(0.4, 0.92), pose(0.4, 0.92),      // dropout: 6-8 (held pose)
      pose(0.8, 0.6), pose(0.95, 0.3),                         // swing: 9-10
      pose(1, 0), pose(1, 0), pose(1, 0), pose(1, 0),          // hold B: 11-14
    ];
    const confidence = frames.map((_, i) => (i >= 6 && i <= 8 ? 0 : 1));
    const config = { motionThreshold: 0.05, minHeldFrames: 3 };

    // WITHOUT the confidence gate the dropout reads as a hold -> 3 beats.
    expect(segmentBeatIndices3D(frames, config).length).toBe(3);
    // WITH it, the dropout is transparent -> the true 2 beats.
    const gated = segmentBeatIndices3D(frames, config, confidence);
    expect(gated.length).toBe(2);
    expect(frames[gated[0]!]!.gripPos.y).toBeCloseTo(1, 5);
    expect(frames[gated[1]!]!.gripPos.x).toBeCloseTo(1, 5);
  });

  it('a dropout inside a genuine hold does not split the beat', () => {
    const frames: StaffPose3D[] = [
      pose(0, 1), pose(0, 1),                                  // hold: 0-1
      pose(0, 1), pose(0, 1),                                  // dropout: 2-3
      pose(0, 1), pose(0, 1),                                  // hold: 4-5
      pose(0.5, 0.7), pose(0.9, 0.2),                          // swing away
      pose(1, 0), pose(1, 0), pose(1, 0),                      // hold B
    ];
    const confidence = frames.map((_, i) => (i === 2 || i === 3 ? 0 : 1));
    const beats = segmentBeatIndices3D(
      frames,
      { motionThreshold: 0.05, minHeldFrames: 3 },
      confidence,
    );
    expect(beats.length).toBe(2); // one beat per true hold, not three
  });
});
