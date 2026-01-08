/**
 * SpineChain - Core physics for procedural fish animation
 *
 * Based on inverse kinematics chain simulation where:
 * - Each joint follows its predecessor
 * - Distance constraints maintain segment lengths
 * - Angle constraints limit bending between segments
 * - Swimming motion emerges from tail oscillation propagating through chain
 *
 * References:
 * - FABRIK algorithm: http://www.andreasaristidou.com/FABRIK.html
 * - argonaut procedural animation: https://github.com/argonautcode/animal-proc-anim
 */

export interface SpineJoint {
  x: number;
  y: number;
  angle: number; // Direction this segment faces (radians)
  width: number; // Body half-width at this point
  segmentLength: number; // Distance to next joint
}

export interface SpineConfig {
  jointCount: number;
  widthProfile: number[]; // Normalized widths (0-1) at each joint
  angleConstraint: number; // Max bend between segments (radians)
  segmentLength: number; // Base distance between joints
}

export class SpineChain {
  joints: SpineJoint[];
  angleConstraint: number;

  constructor(config: SpineConfig, startX: number, startY: number, direction: 1 | -1) {
    this.angleConstraint = config.angleConstraint;
    this.joints = [];

    // Initialize joints in a straight line
    const baseAngle = direction === 1 ? 0 : Math.PI; // Face right or left

    for (let i = 0; i < config.jointCount; i++) {
      const t = i / (config.jointCount - 1);
      const width = config.widthProfile[i] ?? 0.5;

      this.joints.push({
        x: startX - i * config.segmentLength * direction,
        y: startY,
        angle: baseAngle,
        width,
        segmentLength: config.segmentLength,
      });
    }
  }

  /**
   * Update spine positions - head moves to target, body follows
   * Uses forward reaching: each joint pulls toward its predecessor
   */
  update(targetX: number, targetY: number): void {
    if (this.joints.length === 0) return;

    const head = this.joints[0]!;

    // Move head toward target
    head.x = targetX;
    head.y = targetY;

    // Calculate head angle from movement direction
    if (this.joints.length > 1) {
      const second = this.joints[1]!;
      head.angle = Math.atan2(head.y - second.y, head.x - second.x);
    }

    // Each subsequent joint follows the one ahead (forward reaching)
    for (let i = 1; i < this.joints.length; i++) {
      const prev = this.joints[i - 1]!;
      const curr = this.joints[i]!;

      // Compute direction from curr to prev
      const dx = prev.x - curr.x;
      const dy = prev.y - curr.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        // Calculate angle toward previous joint
        let targetAngle = Math.atan2(dy, dx);

        // Apply angle constraint relative to previous joint's angle
        targetAngle = this.constrainAngle(targetAngle, prev.angle);
        curr.angle = targetAngle;

        // Position joint at correct distance from previous
        curr.x = prev.x - Math.cos(curr.angle) * curr.segmentLength;
        curr.y = prev.y - Math.sin(curr.angle) * curr.segmentLength;
      }
    }
  }

  /**
   * Apply swimming wave through entire spine
   * Creates natural S-curve motion that propagates from tail to head
   * @param amplitude - Max swing at tail (decreases toward head)
   * @param phase - Current phase of oscillation (0-2PI)
   */
  applyTailOscillation(amplitude: number, phase: number): void {
    if (this.joints.length < 3) return;

    // Store original positions for smooth interpolation
    const basePositions = this.joints.map(j => ({ x: j.x, y: j.y, angle: j.angle }));

    // Apply wave to each joint with:
    // - Increasing amplitude toward tail
    // - Phase delay between segments (wave propagation)
    for (let i = 1; i < this.joints.length; i++) {
      const joint = this.joints[i]!;
      const prev = this.joints[i - 1]!;

      // Wave influence increases toward tail (0 at head, 1 at tail)
      const t = i / (this.joints.length - 1);
      const waveInfluence = t * t; // Quadratic for more natural motion

      // Phase delay creates wave propagation (tail leads, head follows)
      const phaseDelay = t * 1.2; // Radians of delay per segment
      const localPhase = phase - phaseDelay;

      // Calculate perpendicular offset
      const perpAngle = prev.angle + Math.PI / 2;
      const offset = Math.sin(localPhase) * amplitude * waveInfluence;

      // Apply offset perpendicular to spine direction
      joint.x = basePositions[i]!.x + Math.cos(perpAngle) * offset;
      joint.y = basePositions[i]!.y + Math.sin(perpAngle) * offset;

      // Adjust angle based on offset direction (creates natural curve)
      const angleAdjust = Math.cos(localPhase) * 0.15 * waveInfluence;
      joint.angle = basePositions[i]!.angle + angleAdjust;
    }
  }

  /**
   * Get position along spine using parametric interpolation
   * @param t - Position from 0 (head) to 1 (tail)
   */
  getPositionAt(t: number): { x: number; y: number; angle: number; width: number } {
    if (this.joints.length === 0) {
      return { x: 0, y: 0, angle: 0, width: 0 };
    }

    if (t <= 0) {
      const head = this.joints[0]!;
      return { x: head.x, y: head.y, angle: head.angle, width: head.width };
    }

    if (t >= 1) {
      const tail = this.joints[this.joints.length - 1]!;
      return { x: tail.x, y: tail.y, angle: tail.angle, width: tail.width };
    }

    // Find which segment we're on
    const segmentIndex = t * (this.joints.length - 1);
    const i = Math.floor(segmentIndex);
    const localT = segmentIndex - i;

    const curr = this.joints[i]!;
    const next = this.joints[i + 1]!;

    // Linear interpolation between joints
    return {
      x: curr.x + (next.x - curr.x) * localT,
      y: curr.y + (next.y - curr.y) * localT,
      angle: this.lerpAngle(curr.angle, next.angle, localT),
      width: curr.width + (next.width - curr.width) * localT,
    };
  }

  /**
   * Get curvature at a specific joint (angle difference from previous)
   * Used for fin deflection
   */
  getCurvatureAt(jointIndex: number): number {
    if (jointIndex <= 0 || jointIndex >= this.joints.length) {
      return 0;
    }

    const prev = this.joints[jointIndex - 1]!;
    const curr = this.joints[jointIndex]!;

    return this.normalizeAngle(curr.angle - prev.angle);
  }

  /**
   * Get the head position
   */
  get head(): { x: number; y: number } {
    const h = this.joints[0];
    return h ? { x: h.x, y: h.y } : { x: 0, y: 0 };
  }

  /**
   * Get the tail position
   */
  get tail(): { x: number; y: number } {
    const t = this.joints[this.joints.length - 1];
    return t ? { x: t.x, y: t.y } : { x: 0, y: 0 };
  }

  /**
   * Get head angle (fish's facing direction)
   */
  get headAngle(): number {
    return this.joints[0]?.angle ?? 0;
  }

  /**
   * Constrain an angle to be within angleConstraint of reference
   */
  private constrainAngle(angle: number, referenceAngle: number): number {
    let diff = this.normalizeAngle(angle - referenceAngle);

    if (diff > this.angleConstraint) {
      diff = this.angleConstraint;
    } else if (diff < -this.angleConstraint) {
      diff = -this.angleConstraint;
    }

    return referenceAngle + diff;
  }

  /**
   * Normalize angle to -PI to PI range
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  /**
   * Interpolate between two angles, handling wraparound
   */
  private lerpAngle(a: number, b: number, t: number): number {
    let diff = this.normalizeAngle(b - a);
    return a + diff * t;
  }

  /**
   * Set body widths from a profile array (for species variation)
   */
  setWidthProfile(profile: number[], maxWidth: number): void {
    for (let i = 0; i < this.joints.length && i < profile.length; i++) {
      this.joints[i]!.width = (profile[i] ?? 0.5) * maxWidth;
    }
  }

  /**
   * Get total length of spine
   */
  get totalLength(): number {
    let length = 0;
    for (let i = 1; i < this.joints.length; i++) {
      length += this.joints[i]!.segmentLength;
    }
    return length;
  }
}
