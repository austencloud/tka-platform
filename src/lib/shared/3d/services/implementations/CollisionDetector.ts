/**
 * Collision Detector
 *
 * Checks for prop-through-body and limb-through-limb intersections each frame.
 * Logs violations with severity levels (graze / clip / penetrate) so we can
 * prioritize which danger zones to fix first with safe poses.
 *
 * Severity thresholds (in cm of penetration):
 *   graze:     0–2cm  — barely touching, low priority
 *   clip:      2–5cm  — visibly wrong, medium priority
 *   penetrate: 5cm+   — arm through skull, fix immediately
 *
 * Console output is color-coded:
 *   graze     → gray (console.debug, hidden by default)
 *   clip      → yellow (console.warn)
 *   penetrate → red (console.error)
 *
 * Domain: 3D - Collision Avoidance
 */

import { Vector3 } from "three";
import type {
  ICollisionDetector,
  BodySnapshot,
  CollisionEvent,
  CollisionZone,
  CollisionSeverity,
  PropSegment,
} from "../contracts/ICollisionDetector";

// Bounding radii for body parts (meters, scene scale)
const HEAD_RADIUS = 0.09;
const TORSO_RADIUS = 0.12;
const ARM_SEGMENT_RADIUS = 0.04;

// How close a prop can get before we flag it (meters)
const PROP_BODY_THRESHOLD = 0.02;

// How close two arm segments can get before we flag overlap
const ARM_ARM_THRESHOLD = 0.06;

// Severity thresholds (meters of penetration)
const GRAZE_MAX = 0.02;   // 0–2cm
const CLIP_MAX = 0.05;    // 2–5cm
// Above CLIP_MAX = penetrate

// Throttle per severity: grazes log less often than penetrations
const COOLDOWN_MS: Record<CollisionSeverity, number> = {
  graze: 2000,
  clip: 1000,
  penetrate: 500,
};

// Reusable vectors to avoid GC pressure in the per-frame loop
const _tempA = new Vector3();
const _tempB = new Vector3();
const _closest = new Vector3();

// Severity badge for console
const SEVERITY_BADGE: Record<CollisionSeverity, string> = {
  graze: "🟡 GRAZE",
  clip: "🟠 CLIP",
  penetrate: "🔴 PENETRATE",
};

interface ZoneStats {
  beats: Set<number>;
  totalFrames: number;
  worstPenetration: number;
  worstBeat: number;
  severityCounts: Record<CollisionSeverity, number>;
}

export class CollisionDetector implements ICollisionDetector {
  enabled = true;

  /** Filter: only log this severity or worse. "graze" = all, "clip" = skip grazes, "penetrate" = worst only */
  minSeverity: CollisionSeverity = "graze";

  private lastLogTimes = new Map<string, number>();
  private zoneStats = new Map<string, ZoneStats>();
  private summaryInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.summaryInterval = setInterval(() => this.printSummary(), 10_000);

    if (typeof window !== "undefined") {
      (window as any).__collisionDetector = this;
    }
  }

  detect(
    body: BodySnapshot,
    blueProp: PropSegment | null,
    redProp: PropSegment | null,
    beatIndex: number,
    beatProgress: number
  ): CollisionEvent[] {
    if (!this.enabled) return [];

    const events: CollisionEvent[] = [];
    const propPairs: Array<{ label: "Blue" | "Red"; seg: PropSegment }> = [];
    if (blueProp) propPairs.push({ label: "Blue", seg: blueProp });
    if (redProp) propPairs.push({ label: "Red", seg: redProp });

    // 1. Props through head — segment (staff shaft) vs sphere (head).
    //    Catches the common case where the grip is above the head but the
    //    staff shaft passes through it.
    for (const { label, seg } of propPairs) {
      const closest = this.pointToSegmentDistance(body.head, seg.a, seg.b);
      const threshold = HEAD_RADIUS + seg.radius;
      if (closest < threshold) {
        const depth = threshold - closest;
        events.push(this.makeEvent("prop-through-head", beatIndex, beatProgress, depth,
          `${label} staff shaft → head (${(closest * 100).toFixed(1)}cm clearance, ${(depth * 100).toFixed(1)}cm deep)`));
      }
    }

    // 2. Props through torso — segment (staff) vs each spine sphere.
    //    Torso is approximated as a chain of spheres along the spine so
    //    the check works regardless of body yaw/tilt.
    const spineCenters = [body.hips, body.spine1, body.spine2, body.neck];
    for (const { label, seg } of propPairs) {
      let worstDepth = 0;
      for (const center of spineCenters) {
        const closest = this.pointToSegmentDistance(center, seg.a, seg.b);
        const threshold = TORSO_RADIUS + seg.radius;
        if (closest < threshold) {
          const depth = threshold - closest;
          if (depth > worstDepth) worstDepth = depth;
        }
      }
      if (worstDepth > 0) {
        events.push(this.makeEvent("prop-through-torso", beatIndex, beatProgress, worstDepth,
          `${label} staff shaft → torso (${(worstDepth * 100).toFixed(1)}cm deep)`));
      }
    }

    // 2b. Props through arms — segment (staff) vs segment (upper arm and forearm).
    //     Catches the case where the staff passes through the OTHER arm.
    const armSegments: Array<{ name: string; a: Vector3; b: Vector3 }> = [
      { name: "L upper arm", a: body.leftShoulder, b: body.leftElbow },
      { name: "L forearm",   a: body.leftElbow,    b: body.leftHand },
      { name: "R upper arm", a: body.rightShoulder, b: body.rightElbow },
      { name: "R forearm",   a: body.rightElbow,    b: body.rightHand },
    ];
    for (const { label, seg } of propPairs) {
      for (const arm of armSegments) {
        const closest = this.segmentToSegmentDistance(seg.a, seg.b, arm.a, arm.b);
        const threshold = ARM_SEGMENT_RADIUS + seg.radius;
        if (closest < threshold) {
          const depth = threshold - closest;
          events.push(this.makeEvent("prop-through-arm", beatIndex, beatProgress, depth,
            `${label} staff → ${arm.name} (${(depth * 100).toFixed(1)}cm deep)`));
          break; // one arm hit per prop is enough
        }
      }
    }

    // 2c. Prop through prop — two staves crossing each other mid-shaft.
    //     Common collision when both hands reach across the body.
    if (blueProp && redProp) {
      const closest = this.segmentToSegmentDistance(
        blueProp.a, blueProp.b,
        redProp.a,  redProp.b
      );
      const threshold = blueProp.radius + redProp.radius + PROP_BODY_THRESHOLD;
      if (closest < threshold) {
        const depth = threshold - closest;
        events.push(this.makeEvent("prop-through-prop", beatIndex, beatProgress, depth,
          `Staffs cross (${(closest * 100).toFixed(1)}cm gap, ${(depth * 100).toFixed(1)}cm overlap)`));
      }
    }

    // 3. Arms through face — forearm segment (elbow→hand) vs head sphere
    const leftArmDist = this.pointToSegmentDistance(body.head, body.leftElbow, body.leftHand);
    const leftArmThreshold = HEAD_RADIUS + ARM_SEGMENT_RADIUS + PROP_BODY_THRESHOLD;
    if (leftArmDist < leftArmThreshold) {
      const penetration = leftArmThreshold - leftArmDist;
      events.push(this.makeEvent("arm-through-face", beatIndex, beatProgress, penetration,
        `L forearm → face (${(leftArmDist * 100).toFixed(1)}cm from center, ${(penetration * 100).toFixed(1)}cm deep)`));
    }
    const rightArmDist = this.pointToSegmentDistance(body.head, body.rightElbow, body.rightHand);
    const rightArmThreshold = HEAD_RADIUS + ARM_SEGMENT_RADIUS + PROP_BODY_THRESHOLD;
    if (rightArmDist < rightArmThreshold) {
      const penetration = rightArmThreshold - rightArmDist;
      events.push(this.makeEvent("arm-through-face", beatIndex, beatProgress, penetration,
        `R forearm → face (${(rightArmDist * 100).toFixed(1)}cm from center, ${(penetration * 100).toFixed(1)}cm deep)`));
    }

    // 4. Arms through each other — forearm segments
    const armArmDist = this.segmentToSegmentDistance(
      body.leftElbow, body.leftHand,
      body.rightElbow, body.rightHand
    );
    if (armArmDist < ARM_ARM_THRESHOLD) {
      const penetration = ARM_ARM_THRESHOLD - armArmDist;
      events.push(this.makeEvent("arms-through-each-other", beatIndex, beatProgress, penetration,
        `Forearms intersect (${(armArmDist * 100).toFixed(1)}cm gap, ${(penetration * 100).toFixed(1)}cm overlap)`));
    }

    // Upper arms crossing
    const upperArmDist = this.segmentToSegmentDistance(
      body.leftShoulder, body.leftElbow,
      body.rightShoulder, body.rightElbow
    );
    if (upperArmDist < ARM_ARM_THRESHOLD) {
      const penetration = ARM_ARM_THRESHOLD - upperArmDist;
      events.push(this.makeEvent("arms-through-each-other", beatIndex, beatProgress, penetration,
        `Upper arms intersect (${(upperArmDist * 100).toFixed(1)}cm gap, ${(penetration * 100).toFixed(1)}cm overlap)`));
    }

    // Log and track
    for (const event of events) {
      this.trackStats(event);
      this.logThrottled(event);
    }

    return events;
  }

  private classifySeverity(penetrationDepth: number): CollisionSeverity {
    if (penetrationDepth <= GRAZE_MAX) return "graze";
    if (penetrationDepth <= CLIP_MAX) return "clip";
    return "penetrate";
  }

  private severityRank(s: CollisionSeverity): number {
    return s === "graze" ? 0 : s === "clip" ? 1 : 2;
  }

  private pointToSphereOverlap(point: Vector3, center: Vector3, radius: number): number {
    const dist = point.distanceTo(center);
    return Math.max(0, radius - dist);
  }

  private pointToSegmentDistance(point: Vector3, segA: Vector3, segB: Vector3): number {
    _tempA.subVectors(point, segA);
    _tempB.subVectors(segB, segA);
    const segLenSq = _tempB.lengthSq();
    if (segLenSq < 0.0001) return point.distanceTo(segA);

    const t = Math.max(0, Math.min(1, _tempA.dot(_tempB) / segLenSq));
    _closest.copy(segA).addScaledVector(_tempB, t);
    return point.distanceTo(_closest);
  }

  private segmentToSegmentDistance(a0: Vector3, a1: Vector3, b0: Vector3, b1: Vector3): number {
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
    const severity = this.classifySeverity(penetrationDepth);
    return { zone, severity, beatIndex, beatProgress, penetrationDepth, description };
  }

  private trackStats(event: CollisionEvent): void {
    const key = event.zone;
    if (!this.zoneStats.has(key)) {
      this.zoneStats.set(key, {
        beats: new Set(),
        totalFrames: 0,
        worstPenetration: 0,
        worstBeat: 0,
        severityCounts: { graze: 0, clip: 0, penetrate: 0 },
      });
    }
    const stats = this.zoneStats.get(key)!;
    stats.beats.add(event.beatIndex);
    stats.totalFrames++;
    stats.severityCounts[event.severity]++;
    if (event.penetrationDepth > stats.worstPenetration) {
      stats.worstPenetration = event.penetrationDepth;
      stats.worstBeat = event.beatIndex;
    }
  }

  private logThrottled(event: CollisionEvent): void {
    // Filter by minimum severity
    if (this.severityRank(event.severity) < this.severityRank(this.minSeverity)) return;

    const key = `${event.zone}:${event.beatIndex}:${event.severity}`;
    const now = performance.now();
    const lastTime = this.lastLogTimes.get(key) ?? 0;
    const cooldown = COOLDOWN_MS[event.severity];

    if (now - lastTime > cooldown) {
      this.lastLogTimes.set(key, now);
      const badge = SEVERITY_BADGE[event.severity];
      const msg = `[Collision] ${badge} | Beat ${event.beatIndex} (${(event.beatProgress * 100).toFixed(0)}%) | ${event.zone} | ${event.description}`;

      switch (event.severity) {
        case "graze":
          console.debug(msg);
          break;
        case "clip":
          console.warn(msg);
          break;
        case "penetrate":
          console.error(msg);
          break;
      }
    }
  }

  private printSummary(): void {
    if (!this.enabled || this.zoneStats.size === 0) return;

    const lines = [
      "%c[Collision Summary]",
      "",
    ];
    const styleArgs: string[] = ["font-weight: bold; font-size: 13px;"];

    // Sort zones by worst penetration (most severe first)
    const sorted = Array.from(this.zoneStats.entries())
      .sort((a, b) => b[1].worstPenetration - a[1].worstPenetration);

    for (const [zone, stats] of sorted) {
      const beats = Array.from(stats.beats).sort((a, b) => a - b);
      const worstCm = (stats.worstPenetration * 100).toFixed(1);
      const worstSeverity = this.classifySeverity(stats.worstPenetration);
      const badge = SEVERITY_BADGE[worstSeverity];

      lines.push(
        `  ${badge} ${zone}` +
        `\n    ${stats.totalFrames} frames | beats [${beats.join(", ")}]` +
        `\n    worst: ${worstCm}cm deep at beat ${stats.worstBeat}` +
        `\n    breakdown: ${stats.severityCounts.penetrate} penetrate, ${stats.severityCounts.clip} clip, ${stats.severityCounts.graze} graze` +
        `\n`
      );
    }

    console.log(lines.join("\n"), ...styleArgs);

    // Reset for next interval
    this.zoneStats.clear();
    this.lastLogTimes.clear();
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
