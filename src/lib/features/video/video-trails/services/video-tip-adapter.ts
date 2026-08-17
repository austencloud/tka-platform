import type { DetectedEndpoint } from "../domain/types";
import type { PropTipData } from "$lib/shared/animation-engine/domain/types/fire-types";
import type {
  LedSample,
  LedOverlayConfig,
} from "$lib/shared/animation-engine/domain/types/led-types";
import type { TrailPoint } from "$lib/shared/animation-engine/domain/types/trail-types";

// Tracks a single endpoint's last known position and timestamp so we can
// compute instantaneous velocity via finite differencing on the next frame.
interface PreviousPosition {
  x: number;
  y: number;
  time: number;
  velocityX: number;
  velocityY: number;
}

// Minimum time delta (seconds) used as the denominator in velocity calculations.
// Prevents division by near-zero when two frames arrive at nearly the same time.
const MIN_DT_SECONDS = 0.001;

export class VideoTipAdapter {
  // Keyed by "propIndex-tipIndex" so each tip is tracked independently.
  private previousPositions = new Map<string, PreviousPosition>();

  mapToFireTips(
    endpoints: DetectedEndpoint[],
    canvasSize: number,
    currentTime: number
  ): PropTipData[] {
    return endpoints.map((ep) => {
      const key = `${ep.propIndex}-${ep.tipIndex}`;
      const prev = this.previousPositions.get(key);

      // On the first frame for this tip there is no previous position, so velocity
      // is zero. On subsequent frames we use finite differencing: Δposition / Δtime.
      let vx = 0;
      let vy = 0;
      let accelerationX = 0;
      let accelerationY = 0;

      if (prev !== undefined) {
        // Clamp dt so a duplicate timestamp doesn't produce Infinity.
        const dt = Math.max((currentTime - prev.time) / 1000, MIN_DT_SECONDS);
        vx = (ep.x - prev.x) / dt;
        vy = (ep.y - prev.y) / dt;
        accelerationX = (vx - prev.velocityX) / dt;
        accelerationY = (vy - prev.velocityY) / dt;
      }

      this.previousPositions.set(key, {
        x: ep.x,
        y: ep.y,
        time: currentTime,
        velocityX: vx,
        velocityY: vy,
      });

      return {
        x: ep.x,
        y: ep.y,
        prevX: prev?.x ?? ep.x,
        prevY: prev?.y ?? ep.y,
        velocityX: vx,
        velocityY: vy,
        speed: Math.sqrt(vx * vx + vy * vy),
        accelerationX,
        accelerationY,
        propIndex: ep.propIndex,
        tipIndex: ep.tipIndex,
        flameScale: ep.brightness,
        jerk: Math.hypot(accelerationX, accelerationY),
      };
    });
  }

  mapToLedSamples(
    endpoints: DetectedEndpoint[],
    _currentTime: number,
    _ledConfig: LedOverlayConfig
  ): LedSample[] {
    // A detected endpoint is one capsule LED. Color comes from the renderer's
    // configured pattern, so these carry white and let detection brightness
    // through.
    return endpoints.map((ep) => ({
      x: ep.x,
      y: ep.y,
      propIndex: ep.propIndex,
      ledIndex: ep.tipIndex,
      endpointIndex: ep.tipIndex,
      brightness: ep.brightness,
      r: 1,
      g: 1,
      b: 1,
    }));
  }

  mapToTrailPoints(
    endpoints: DetectedEndpoint[],
    currentTime: number
  ): TrailPoint[] {
    return endpoints.map((ep) => ({
      x: ep.x,
      y: ep.y,
      timestamp: currentTime,
      propIndex: ep.propIndex as 0 | 1,
      tipIndex: ep.tipIndex,
    }));
  }

  reset(): void {
    // Called when the video is seeked or restarted. Clearing the position map
    // means the next frame will have no previous position to diff against,
    // producing zero velocity - exactly what we want after a discontinuity.
    this.previousPositions.clear();
  }
}
