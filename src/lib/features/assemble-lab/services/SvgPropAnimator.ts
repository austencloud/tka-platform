// src/lib/features/assemble-lab/services/SvgPropAnimator.ts

import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  HALF_PI,
  LOCATION_ANGLES,
  PI,
  TWO_PI,
} from "$lib/shared/foundation/domain/math-constants";
import type { AnimationParams } from "$lib/shared/assemble-lab/domain/types";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { applyEffort } from "$lib/shared/effort/domain/effort-easing-unified";

// 950x950 SVG coordinate space
const CENTER = 475;
const GRID_RADIUS = 143.1; // distance from center to hand points

/** Normalize angle to [0, 2*PI) */
function normPos(angle: number): number {
  const n = angle % TWO_PI;
  return n < 0 ? n + TWO_PI : n;
}

/** Normalize angle to (-PI, PI] - shortest signed delta */
function normSigned(angle: number): number {
  const n = normPos(angle);
  return n > PI ? n - TWO_PI : n;
}

/** Map grid location to polar angle (radians) */
function locToAngle(loc: GridLocation): number {
  return LOCATION_ANGLES[loc];
}

/** Map orientation to staff angle given a center path angle */
function oriToStaffAngle(ori: Orientation, centerAngle: number): number {
  switch (ori) {
    case Orientation.IN: return normPos(centerAngle + PI);
    case Orientation.OUT: return normPos(centerAngle);
    case Orientation.CLOCK: return normPos(centerAngle + HALF_PI);
    case Orientation.COUNTER: return normPos(centerAngle - HALF_PI);
    default: return normPos(centerAngle + PI); // default to IN
  }
}

/** Shortest-path angular interpolation */
function lerpAngle(a: number, b: number, t: number): number {
  const d = normSigned(b - a);
  return normPos(a + d * t);
}

/** Apply the user's chosen effort easing, defaulting to linear */
function applyEasing(t: number): number {
  const preset = getAnimationVisibilityManager().getEffortPreset();
  return applyEffort(preset, t);
}

/** Determine if motion is a dash (opposite points) vs shift (adjacent) vs static (same) */
function isOpposite(a: GridLocation, b: GridLocation): boolean {
  // Center is never opposite to anything
  if (a === GridLocation.CENTER || b === GridLocation.CENTER) return false;
  const angleA = locToAngle(a);
  const angleB = locToAngle(b);
  const delta = Math.abs(normSigned(angleB - angleA));
  return Math.abs(delta - PI) < 0.01;
}

/** Check if a location is the center point */
function isCenter(loc: GridLocation): boolean {
  return loc === GridLocation.CENTER;
}

export class SvgPropAnimator {
  private animationFrameId: number | null = null;
  private cancelResolve: (() => void) | null = null;

  async animate(params: AnimationParams): Promise<void> {
    this.cancel(); // cancel any running animation

    const {
      element, startPosition, endPosition,
      rotationDirection, turnCount, startOrientation,
      durationMs, propCenter,
    } = params;

    // Respect reduced motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReduced ? 0 : durationMs;

    // Calculate endpoints
    const startCenterAngle = locToAngle(startPosition);
    const endCenterAngle = locToAngle(endPosition);
    const startStaffAngle = oriToStaffAngle(startOrientation, startCenterAngle);

    const isSamePoint = startPosition === endPosition;
    const isDash = !isSamePoint && isOpposite(startPosition, endPosition);
    // Hash motions: one end is center, the other is on the perimeter
    const isHash = !isSamePoint && (isCenter(startPosition) || isCenter(endPosition));

    // Calculate staff rotation delta
    // For shifts: staff moves with (pro) or against (anti) the arc
    // For dashes/static at 0 turns: no rotation
    const centerMovement = normSigned(endCenterAngle - startCenterAngle);
    const dirSign = rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
    const turnRotation = dirSign * turnCount * PI; // 1 turn = 180deg

    let staffRotationDelta: number;
    if (isSamePoint) {
      // Static: just turn rotation
      staffRotationDelta = turnRotation;
    } else if (isDash || isHash) {
      // Dash/hash: only turn rotation (no arc component)
      staffRotationDelta = turnRotation;
    } else {
      // Shift: arc component + turn rotation
      // Pro = staff moves WITH arc, Anti = staff moves AGAINST arc
      // Since the user sets CW/CCW and we derive pro/anti from hand path direction,
      // we need to check if userDir matches the arc direction
      const arcDir = centerMovement > 0 ? 1 : -1; // positive = CCW, negative = CW
      const userDir = dirSign; // +1 = CCW, -1 = CW
      const isPro = (arcDir === userDir) || (Math.abs(centerMovement) < 0.01);
      const staffArcComponent = isPro ? centerMovement : -centerMovement;
      staffRotationDelta = staffArcComponent + turnRotation;
    }

    // For dash or hash: use Cartesian interpolation (straight line)
    const useCartesian = isDash || isHash;
    const startRadius = isCenter(startPosition) ? 0 : 1;
    const endRadius = isCenter(endPosition) ? 0 : 1;
    const startX = useCartesian ? Math.cos(startCenterAngle) * startRadius : 0;
    const startY = useCartesian ? Math.sin(startCenterAngle) * startRadius : 0;
    const endX = useCartesian ? Math.cos(endCenterAngle) * endRadius : 0;
    const endY = useCartesian ? Math.sin(endCenterAngle) * endRadius : 0;

    // Instant jump for 0 duration
    if (duration <= 0) {
      this.applyTransform(element, endCenterAngle, useCartesian, endX, endY,
        normPos(startStaffAngle + staffRotationDelta), propCenter);
      return;
    }

    return new Promise<void>((resolve) => {
      this.cancelResolve = resolve;
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const rawProgress = Math.min(elapsed / duration, 1);
        const t = applyEasing(rawProgress);

        // Interpolate center position
        let displayAngle: number;
        let cartX = 0;
        let cartY = 0;

        if (useCartesian) {
          // Cartesian lerp (straight line - for dashes and hash motions)
          cartX = startX + (endX - startX) * t;
          cartY = startY + (endY - startY) * t;
          displayAngle = Math.atan2(cartY, cartX);
        } else if (isSamePoint) {
          displayAngle = startCenterAngle;
        } else {
          // Angular lerp (arc path)
          displayAngle = lerpAngle(startCenterAngle, endCenterAngle, t);
        }

        // Interpolate staff rotation
        const staffAngle = normPos(startStaffAngle + staffRotationDelta * t);

        this.applyTransform(element, displayAngle, useCartesian, cartX, cartY,
          staffAngle, propCenter);

        if (rawProgress < 1) {
          this.animationFrameId = requestAnimationFrame(tick);
        } else {
          this.animationFrameId = null;
          this.cancelResolve = null;
          resolve();
        }
      };

      this.animationFrameId = requestAnimationFrame(tick);
    });
  }

  cancel(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.cancelResolve) {
      this.cancelResolve();
      this.cancelResolve = null;
    }
  }

  /** Apply transform to SVG element in 950x950 space */
  private applyTransform(
    element: SVGGElement,
    centerAngle: number,
    isDash: boolean,
    cartX: number,
    cartY: number,
    staffAngle: number,
    propCenter: { x: number; y: number },
  ): void {
    let x: number;
    let y: number;

    if (isDash) {
      x = CENTER + cartX * GRID_RADIUS;
      y = CENTER + cartY * GRID_RADIUS;
    } else {
      x = CENTER + Math.cos(centerAngle) * GRID_RADIUS;
      y = CENTER + Math.sin(centerAngle) * GRID_RADIUS;
    }

    // Convert staff angle from radians to degrees for SVG transform
    const rotDeg = (staffAngle * 180) / PI;

    element.style.transform =
      `translate(${x}px, ${y}px) rotate(${rotDeg}deg) translate(${-propCenter.x}px, ${-propCenter.y}px)`;
  }
}
