// src/lib/features/assemble-lab/services/svg-prop-animator.ts

import { PI } from "$lib/shared/foundation/domain/math-constants";
import type { AnimationParams } from "$lib/shared/assemble-lab/domain/types";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { applyEffort } from "$lib/shared/effort/domain/effort-easing-unified";
import {
  deriveBuilderMotionGeometry,
  lerpAngle,
  normalizeAnglePositive,
} from "./builder-motion-geometry";

// 950x950 SVG coordinate space
const CENTER = 475;
const GRID_RADIUS = 143.1; // distance from center to hand points

/** Apply the user's chosen effort easing, defaulting to linear */
function applyEasing(t: number): number {
  const preset = getAnimationVisibilityManager().getEffortPreset();
  return applyEffort(preset, t);
}

export class SvgPropAnimator {
  private animationFrameId: number | null = null;
  private cancelResolve: (() => void) | null = null;

  async animate(params: AnimationParams): Promise<void> {
    this.cancel(); // cancel any running animation

    const {
      element,
      startPosition,
      endPosition,
      rotationDirection,
      turnCount,
      startOrientation,
      durationMs,
      propCenter,
    } = params;

    // Respect reduced motion
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const duration = prefersReduced ? 0 : durationMs;

    const geometry = deriveBuilderMotionGeometry(
      startPosition,
      endPosition,
      startOrientation,
      rotationDirection,
      turnCount
    );
    const {
      startCenterAngle,
      endCenterAngle,
      startStaffAngle,
      staffRotationDelta,
      isSamePoint,
      isStraightPath: useCartesian,
      startRadius,
      endRadius,
    } = geometry;
    const startX = useCartesian ? Math.cos(startCenterAngle) * startRadius : 0;
    const startY = useCartesian ? Math.sin(startCenterAngle) * startRadius : 0;
    const endX = useCartesian ? Math.cos(endCenterAngle) * endRadius : 0;
    const endY = useCartesian ? Math.sin(endCenterAngle) * endRadius : 0;

    // Instant jump for 0 duration
    if (duration <= 0) {
      this.applyTransform(
        element,
        endCenterAngle,
        useCartesian,
        endX,
        endY,
        normalizeAnglePositive(startStaffAngle + staffRotationDelta),
        propCenter
      );
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
        const staffAngle = normalizeAnglePositive(
          startStaffAngle + staffRotationDelta * t
        );

        this.applyTransform(
          element,
          displayAngle,
          useCartesian,
          cartX,
          cartY,
          staffAngle,
          propCenter
        );

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
    propCenter: { x: number; y: number }
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

    element.style.transform = `translate(${x}px, ${y}px) rotate(${rotDeg}deg) translate(${-propCenter.x}px, ${-propCenter.y}px)`;
  }
}
