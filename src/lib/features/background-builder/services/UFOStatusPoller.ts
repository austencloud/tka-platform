import type { CosmicBackgroundSystem } from "@austencloud/backgrounds";
import type { UFOStatusSnapshot } from "./types";

const DEFAULT_POLL_INTERVAL_MS = 100; // 10Hz polling

/**
 * Polls the CosmicBackgroundSystem for UFO status at regular intervals.
 * Used by UFO Lab mode to display live status updates.
 */
export class UFOStatusPoller {
  private intervalId: number | null = null;
  private system: CosmicBackgroundSystem | null = null;
  private callback: ((status: UFOStatusSnapshot) => void) | null = null;

  start(
    system: CosmicBackgroundSystem,
    onUpdate: (status: UFOStatusSnapshot) => void,
    intervalMs: number = DEFAULT_POLL_INTERVAL_MS
  ): void {
    // Stop any existing polling first
    this.stop();

    this.system = system;
    this.callback = onUpdate;

    this.intervalId = window.setInterval(() => {
      this.poll();
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.system = null;
    this.callback = null;
  }

  isPolling(): boolean {
    return this.intervalId !== null;
  }

  private poll(): void {
    if (!this.system || !this.callback) return;

    const snapshot: UFOStatusSnapshot = {
      active: this.system.isUFOActive() ?? false,
      mood: this.system.getUFOMood() ?? null,
      tiredness: this.system.getUFOTiredness() ?? null,
      state: this.system.getUFOState() ?? null,
      position: this.system.getUFOPosition() ?? null,
      heading: this.system.getUFOHeading() ?? null,
      scannedStars: this.system.getUFOScannedStarsCount() ?? 0,
    };

    this.callback(snapshot);
  }
}
