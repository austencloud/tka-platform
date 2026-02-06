/**
 * Activity Tracker
 *
 * Detects actual user interactions (clicks, scrolls, keypresses, touches)
 * to determine if user is actively using the app vs just having it open.
 *
 * Uses debouncing to avoid spamming activity updates.
 */

/** Events that indicate actual user activity */
const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "touchmove",
  "wheel",
  "pointerdown",
  "pointermove",
] as const;

/** Minimum time between activity callbacks (ms) */
const DEBOUNCE_MS = 30_000; // 30 seconds - don't update more than once per 30s

export interface ActivityTrackerCallbacks {
  /** Called when user activity is detected (debounced) */
  onActivity: () => void;
}

export class ActivityTracker {
  private lastActivityCallback = 0;
  private listeners: (() => void)[] = [];
  private callbacks: ActivityTrackerCallbacks;

  constructor(callbacks: ActivityTrackerCallbacks) {
    this.callbacks = callbacks;
  }

  /** Start tracking user activity */
  start(): void {
    if (typeof window === "undefined") return;

    // Bind event handler
    const handleActivity = this.handleActivity.bind(this);

    // Add listeners for all activity events
    for (const eventType of ACTIVITY_EVENTS) {
      window.addEventListener(eventType, handleActivity, { passive: true });
      this.listeners.push(() =>
        window.removeEventListener(eventType, handleActivity)
      );
    }

    // Also track visibility changes (user switched back to tab)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        this.handleActivity();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    this.listeners.push(() =>
      document.removeEventListener("visibilitychange", handleVisibility)
    );

    // Trigger initial activity
    this.handleActivity();
  }

  /** Stop tracking user activity */
  stop(): void {
    for (const cleanup of this.listeners) {
      cleanup();
    }
    this.listeners = [];
  }

  /** Handle an activity event */
  private handleActivity(): void {
    const now = Date.now();

    // Debounce: only trigger callback if enough time has passed
    if (now - this.lastActivityCallback >= DEBOUNCE_MS) {
      this.lastActivityCallback = now;
      this.callbacks.onActivity();
    }
  }

  /** Force an immediate activity update (e.g., on navigation) */
  forceActivityUpdate(): void {
    this.lastActivityCallback = Date.now();
    this.callbacks.onActivity();
  }
}
