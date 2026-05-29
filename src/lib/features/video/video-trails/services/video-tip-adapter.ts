import type { DetectedEndpoint } from "../domain/types";
import type { PropTipData } from "$lib/shared/animation-engine/domain/types/FireTypes";
import type { LedTipData, LedOverlayConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";
import type { TrailPoint } from "$lib/shared/animation-engine/domain/types/TrailTypes";

// Tracks a single endpoint's last known position and timestamp so we can
// compute instantaneous velocity via finite differencing on the next frame.
interface PreviousPosition {
  x: number;
  y: number;
  time: number;
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
    currentTime: number,
  ): PropTipData[] {
    return endpoints.map((ep) => {
      const key = `${ep.propIndex}-${ep.tipIndex}`;
      const prev = this.previousPositions.get(key);

      // On the first frame for this tip there is no previous position, so velocity
      // is zero. On subsequent frames we use finite differencing: Δposition / Δtime.
      let vx = 0;
      let vy = 0;

      if (prev !== undefined) {
        // Clamp dt so a duplicate timestamp doesn't produce Infinity.
        const dt = Math.max((currentTime - prev.time) / 1000, MIN_DT_SECONDS);
        vx = (ep.x - prev.x) / dt;
        vy = (ep.y - prev.y) / dt;
      }

      this.previousPositions.set(key, { x: ep.x, y: ep.y, time: currentTime });

      return {
        x: ep.x,
        y: ep.y,
        prevX: prev?.x ?? ep.x,
        prevY: prev?.y ?? ep.y,
        velocityX: vx,
        velocityY: vy,
        speed: Math.sqrt(vx * vx + vy * vy),
        propIndex: ep.propIndex,
        tipIndex: ep.tipIndex,
        flameScale: ep.brightness,
        // Jerk (rate of change of acceleration) is not available from a single
        // endpoint snapshot - the fire renderer will derive it internally.
        jerk: 0,
      };
    });
  }

  mapToLedTips(
    endpoints: DetectedEndpoint[],
    _currentTime: number,
    _ledConfig: LedOverlayConfig,
  ): LedTipData[] {
    // Velocity is not needed for the LED renderer, which relies on position and
    // the pattern engine for color. We pass white (1, 1, 1) and let the renderer
    // apply its own color pattern on top.
    return endpoints.map((ep) => ({
      x: ep.x,
      y: ep.y,
      velocityX: 0,
      velocityY: 0,
      speed: 0,
      propIndex: ep.propIndex,
      tipIndex: ep.tipIndex,
      brightness: ep.brightness,
      r: 1,
      g: 1,
      b: 1,
    }));
  }

  mapToTrailPoints(endpoints: DetectedEndpoint[], currentTime: number): TrailPoint[] {
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
