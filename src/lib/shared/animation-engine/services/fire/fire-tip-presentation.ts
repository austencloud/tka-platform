import type { PropTipData } from "../../domain/types/fire-types";

const EPSILON = 0.000001;

export interface FireTipPresentation {
  directionX: number;
  directionY: number;
  stretch: number;
  breakup: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalize(x: number, y: number): [number, number] {
  const length = Math.hypot(x, y);
  return length > EPSILON ? [x / length, y / length] : [0, 1];
}

/**
 * Turns a tracked prop-tip trajectory into the shape controls used by Natural
 * Fire. A resting flame rises. Motion pulls the flame behind the prop, while a
 * sharp change in direction adds a smaller counter-acceleration bend and more
 * edge breakup.
 */
export function computeFireTipPresentation(
  tip: PropTipData,
  canvasWidth: number,
  canvasHeight: number,
  target: FireTipPresentation = {
    directionX: 0,
    directionY: 1,
    stretch: 1,
    breakup: 0,
  }
): FireTipPresentation {
  const safeWidth = Math.max(canvasWidth, 1);
  const safeHeight = Math.max(canvasHeight, 1);
  const canvasScale = Math.max(safeWidth, safeHeight);

  // Canvas Y points down, while the display shader's UV Y points up.
  const velocityLagX = -tip.velocityX / safeWidth;
  const velocityLagY = tip.velocityY / safeHeight;
  const accelerationLagX = -(tip.accelerationX ?? 0) / safeWidth;
  const accelerationLagY = (tip.accelerationY ?? 0) / safeHeight;
  const [motionX, motionY] = normalize(velocityLagX, velocityLagY);
  const [accelerationX, accelerationY] = normalize(
    accelerationLagX,
    accelerationLagY
  );

  const speed = Math.hypot(tip.velocityX, tip.velocityY);
  const acceleration = Math.hypot(
    tip.accelerationX ?? 0,
    tip.accelerationY ?? 0
  );
  const speedAmount = clamp01(speed / (canvasScale * 1.55));
  const accelerationAmount = clamp01(acceleration / (canvasScale * 12));
  const motionWeight = speedAmount * (0.82 + accelerationAmount * 0.1);
  const accelerationWeight = accelerationAmount * 0.28;

  const [directionX, directionY] = normalize(
    motionX * motionWeight + accelerationX * accelerationWeight,
    1 -
      motionWeight -
      accelerationWeight +
      motionY * motionWeight +
      accelerationY * accelerationWeight
  );

  target.directionX = directionX;
  target.directionY = directionY;
  target.stretch = 1 + speedAmount * 1.35 + accelerationAmount * 0.35;
  target.breakup = clamp01(
    0.12 + speedAmount * 0.42 + accelerationAmount * 0.52
  );
  return target;
}
