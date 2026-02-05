import type { NightSkyBackgroundSystem } from "@austencloud/backgrounds";

/**
 * UFO status snapshot returned by the poller.
 */
export interface UFOStatusSnapshot {
  active: boolean;
  mood: string | null;
  tiredness: number | null;
  state: string | null;
  position: { x: number; y: number } | null;
  heading: number | null;
  scannedStars: number;
}

/**
 * Polls the UFO system for status updates at a fixed interval.
 * Abstracts polling logic from UI components.
 */
export interface IUFOStatusPoller {
  /**
   * Start polling the background system for UFO status.
   * @param system The NightSkyBackgroundSystem to poll
   * @param onUpdate Callback invoked with each status snapshot
   * @param intervalMs Polling interval in milliseconds (default: 100ms = 10Hz)
   */
  start(
    system: NightSkyBackgroundSystem,
    onUpdate: (status: UFOStatusSnapshot) => void,
    intervalMs?: number
  ): void;

  /**
   * Stop polling.
   */
  stop(): void;

  /**
   * Check if currently polling.
   */
  isPolling(): boolean;
}
