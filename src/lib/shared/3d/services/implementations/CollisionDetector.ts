/**
 * Collision Detector
 *
 * Checks for prop-through-body and limb-through-limb intersections each frame.
 * Logs violations to the console with beat index, zone, and penetration depth
 * so we can build a dataset of danger zones for safe-pose authoring.
 *
 * All thresholds are in meters, tuned to a ~1.7m avatar at scene scale.
 * Collision checks use simple sphere/capsule overlap — fast enough for
 * every-frame use without impacting performance.
 *
 * Domain: 3D - Collision Avoidance
 */

import { Vector3 } from "three";
import type {
  ICollisionDetector,
  BodySnapshot,
  CollisionEvent,
  CollisionZone,
} from "../contracts/ICollisionDetector";

// Bounding radii for body parts (meters, scene scale)
// These are generous — we want to catch obvious clipping, not near-misses
const HEAD_RADIUS = 0.09;
const TORSO_RADIUS = 0.12;
const ARM_SEGMENT_RADIUS = 0.04;

// How close a prop can get before we flag it (meters)
const PROP_BODY_THRESHOLD = 0.02;

// How close two arm segments can get before we flag overlap
const ARM_ARM_THRESHOLD = 0.06;

// Throttle: don't spam the same collision zone more than once per beat
// Key = "zone:beatIndex", value = last logged frame timestamp
const LOG_COOLDOWN_MS = 500;

// Reusable vectors to avoid GC pressure in the per-frame loop
const _tempA = new Vector3();
const _tempB = new Vector3();
const _closest = new Vector3();

export class CollisionDetector implements ICollisionDetector {
  enabled = true;
  private lastLogTimes = new Map<string, number>();
  private collisionCounts = new Map<string, number>();
  private summaryInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Print a summary every 10 seconds so the console isn't just a wall of events
    this.summaryInterval = setInterval(() => this.printSummary(), 10_000);

    // Expose toggle on window for easy console access
    if (typeof window !== "undefined") {
      (window as any).__collisionDetector = this;
    }
  }

  detect(
    body: BodySnapshot,
    bluePropPos: Vector3 | null,
    redPropPos: Vector3 | null,
    beatIndex: number,
    beatProgress: number
  ): CollisionEvent[] {
    if (!this.enabled) return [];

    const events: CollisionEvent[] = [];

    // 1. Props through head
    if (bluePropPos) {
      const d = this.pointToSphereOverlap(bluePropPos, body.head, HEAD_RADIUS);
      if (d > 0) {
        events.push(this.makeEvent("prop-through-head", beatIndex, beatProgress, d,
          `Blue prop penetrates head by ${(d * 100).toFixed(1)}cm`));
      }
    }
    if (redPropPos) {
      const d = this.pointToSphereOverlap(redPropPos, body.head, HEAD_RADIUS);
      if (d > 0) {
        events.push(this.makeEvent("prop-through-head", beatIndex, beatProgress, d,
          `Red prop penetrates head by ${(d * 100).toFixed(1)}cm`));
      }
    }

    // 2. Props through torso (check against spine chain: spine1 → spine2 → neck)
    const spineCenters = [body.spine1, body.spine2, body.neck];
    for (const propPos of [bluePropPos, redPropPos]) {
      if (!propPos) continue;
      const label = propPos === bluePropPos ? "Blue" : "Red";
      for (const center of spineCenters) {
        const d = this.pointToSphereOverlap(propPos, center, TORSO_RADIUS);
        if (d > 0) {
          events.push(this.makeEvent("prop-through-torso", beatIndex, beatProgress, d,
            `${label} prop penetrates torso by ${(d * 100).toFixed(1)}cm`));
          break; // One hit per prop is enough
        }
      }
    }

    // 3. Arms through face — check if forearm segment (elbow→hand) passes near head
    const leftArmDist = this.pointToSegmentDistance(body.head, body.leftElbow, body.leftHand);
    if (leftArmDist < HEAD_RADIUS + ARM_SEGMENT_RADIUS + PROP_BODY_THRESHOLD) {
      const penetration = (HEAD_RADIUS + ARM_SEGMENT_RADIUS) - leftArmDist;
      events.push(this.makeEvent("arm-through-face", beatIndex, beatProgress, penetration,
        `Left forearm passes through face (${(leftArmDist * 100).toFixed(1)}cm from head center)`));
    }
    const rightArmDist = this.pointToSegmentDistance(body.head, body.rightElbow, body.rightHand);
    if (rightArmDist < HEAD_RADIUS + ARM_SEGMENT_RADIUS + PROP_BODY_THRESHOLD) {
      const penetration = (HEAD_RADIUS + ARM_SEGMENT_RADIUS) - rightArmDist;
      events.push(this.makeEvent("arm-through-face", beatIndex, beatProgress, penetration,
        `Right forearm passes through face (${(rightArmDist * 100).toFixed(1)}cm from head center)`));
    }

    // 4. Arms through each other — check if left forearm segment intersects right forearm segment
    const armArmDist = this.segmentToSegmentDistance(
      body.leftElbow, body.leftHand,
      body.rightElbow, body.rightHand
    );
    if (armArmDist < ARM_ARM_THRESHOLD) {
      const penetration = ARM_ARM_THRESHOLD - armArmDist;
      events.push(this.makeEvent("arms-through-each-other", beatIndex, beatProgress, penetration,
        `Arms intersect (${(armArmDist * 100).toFixed(1)}cm apart, threshold ${(ARM_ARM_THRESHOLD * 100).toFixed(1)}cm)`));
    }

    // Also check upper arms (shoulder→elbow) crossing through each other
    const upperArmDist = this.segmentToSegmentDistance(
      body.leftShoulder, body.leftElbow,
      body.rightShoulder, body.rightElbow
    );
    if (upperArmDist < ARM_ARM_THRESHOLD) {
      const penetration = ARM_ARM_THRESHOLD - upperArmDist;
      events.push(this.makeEvent("arms-through-each-other", beatIndex, beatProgress, penetration,
        `Upper arms intersect (${(upperArmDist * 100).toFixed(1)}cm apart)`));
    }

    // Log events (throttled)
    for (const event of events) {
      this.logThrottled(event);
    }

    return events;
  }

  /** How far a point penetrates into a sphere. Returns 0 if outside. */
  private pointToSphereOverlap(point: Vector3, center: Vector3, radius: number): number {
    const dist = point.distanceTo(center);
    return Math.max(0, radius - dist);
  }

  /** Shortest distance from a point to a line segment */
  private pointToSegmentDistance(point: Vector3, segA: Vector3, segB: Vector3): number {
    _tempA.subVectors(point, segA);
    _tempB.subVectors(segB, segA);
    const segLenSq = _tempB.lengthSq();
    if (segLenSq < 0.0001) return point.distanceTo(segA);

    const t = Math.max(0, Math.min(1, _tempA.dot(_tempB) / segLenSq));
    _closest.copy(segA).addScaledVector(_tempB, t);
    return point.distanceTo(_closest);
  }

  /** Shortest distance between two line segments */
  private segmentToSegmentDistance(a0: Vector3, a1: Vector3, b0: Vector3, b1: Vector3): number {
    // Sample-based approach: check 4 points on each segment.
    // Not mathematically exact but plenty accurate for our thresholds
    // and avoids the 20-line analytic segment-segment formula.
    let minDist = Infinity;
    for (let i = 0; i <= 3; i++) {
      const t = i / 3;
      _tempA.lerpVectors(a0, a1, t);
      const d = this.pointToSegmentDistance(_tempA, b0, b1);
      if (d < minDist) minDist = d;
    }
    for (let i = 0; i <= 3; i++) {
      const t = i / 3;
      _tempA.lerpVectors(b0, b1, t);
      const d = this.pointToSegmentDistance(_tempA, a0, a1);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  private makeEvent(
    zone: CollisionZone,
    beatIndex: number,
    beatProgress: number,
    penetrationDepth: number,
    description: string
  ): CollisionEvent {
    return { zone, beatIndex, beatProgress, penetrationDepth, description };
  }

  private logThrottled(event: CollisionEvent): void {
    const key = `${event.zone}:${event.beatIndex}`;
    const now = performance.now();
    const lastTime = this.lastLogTimes.get(key) ?? 0;

    // Track counts regardless of throttle
    this.collisionCounts.set(key, (this.collisionCounts.get(key) ?? 0) + 1);

    if (now - lastTime > LOG_COOLDOWN_MS) {
      this.lastLogTimes.set(key, now);
      const count = this.collisionCounts.get(key) ?? 1;
      console.warn(
        `[Collision] Beat ${event.beatIndex} (${(event.beatProgress * 100).toFixed(0)}%) | ` +
        `${event.zone} | ${event.description}` +
        (count > 1 ? ` (${count}× this beat)` : "")
      );
    }
  }

  private printSummary(): void {
    if (!this.enabled || this.collisionCounts.size === 0) return;

    // Aggregate by zone
    const byZone = new Map<CollisionZone, { beats: Set<number>; totalFrames: number }>();
    for (const [key, count] of this.collisionCounts) {
      const [zone, beatStr] = key.split(":") as [CollisionZone, string];
      const beatIndex = parseInt(beatStr, 10);
      if (!byZone.has(zone)) {
        byZone.set(zone, { beats: new Set(), totalFrames: 0 });
      }
      const entry = byZone.get(zone)!;
      entry.beats.add(beatIndex);
      entry.totalFrames += count;
    }

    const lines = ["[Collision Summary]"];
    for (const [zone, data] of byZone) {
      const beats = Array.from(data.beats).sort((a, b) => a - b);
      lines.push(
        `  ${zone}: ${data.totalFrames} frames across beats [${beats.join(", ")}]`
      );
    }
    console.log(lines.join("\n"));

    // Reset counts for next interval
    this.collisionCounts.clear();
  }

  dispose(): void {
    if (this.summaryInterval) {
      clearInterval(this.summaryInterval);
      this.summaryInterval = null;
    }
    if (typeof window !== "undefined") {
      delete (window as any).__collisionDetector;
    }
  }
}
