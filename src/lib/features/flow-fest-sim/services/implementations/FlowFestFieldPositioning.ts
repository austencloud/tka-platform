import type {
  FlowFestFieldPositioningError,
  IFlowFestFieldPositioning,
} from "../contracts/IFlowFestFieldPositioning";
import type {
  FlowFestGnssFix,
  FlowFestGnssReplaySample,
} from "../../domain/flow-fest-field-positioning";

export class FlowFestFieldPositioning implements IFlowFestFieldPositioning {
  watchLive(
    onFix: (fix: FlowFestGnssFix) => void,
    onError: (error: FlowFestFieldPositioningError) => void
  ): () => void {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      onError("unavailable");
      return () => undefined;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        onFix({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          timestampMilliseconds: position.timestamp,
          headingDegrees: finiteOrNull(position.coords.heading),
          speedMetersPerSecond: finiteOrNull(position.coords.speed),
        });
      },
      (error) => onError(classifyGeolocationError(error)),
      {
        enableHighAccuracy: true,
        maximumAge: 1_000,
        timeout: 10_000,
      }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }

  replay(
    samples: FlowFestGnssReplaySample[],
    onFix: (fix: FlowFestGnssFix, ordinal: number) => void,
    onComplete: () => void
  ): () => void {
    if (samples.length === 0) {
      onComplete();
      return () => undefined;
    }
    const timers = samples.map((sample, ordinal) =>
      window.setTimeout(() => {
        onFix(
          {
            latitude: sample.latitude,
            longitude: sample.longitude,
            accuracyMeters: sample.accuracyMeters,
            timestampMilliseconds: Date.now(),
            headingDegrees: sample.headingDegrees,
            speedMetersPerSecond: sample.speedMetersPerSecond,
          },
          ordinal
        );
        if (ordinal === samples.length - 1) onComplete();
      }, sample.elapsedMilliseconds)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }
}

function finiteOrNull(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function classifyGeolocationError(
  error: GeolocationPositionError
): FlowFestFieldPositioningError {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.POSITION_UNAVAILABLE) return "unavailable";
  if (error.code === error.TIMEOUT) return "timeout";
  return "unknown";
}
