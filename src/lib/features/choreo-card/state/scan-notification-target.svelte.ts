/**
 * Scan-notification target.
 *
 * Coordinates a click on an admin QR-scan notification with the Scan Activity
 * tab: the InboxNotificationItem sets the scanned code + coordinates here, then
 * navigates to choreo_card/scan-activity, and ScanActivityTab consumes it to
 * fly the map to the pin and open the card peek. Mirrors the feedback deep-link
 * handoff (notification-action-state).
 */

export interface ScanNotificationTarget {
  /** Short code of the scanned card (latest scan in a digest). */
  code: string;
  /** Scan coordinates, when the scan was geolocated. */
  lat: number | null;
  lng: number | null;
}

let target = $state<ScanNotificationTarget | null>(null);

/** Set the card the Scan Activity tab should fly to and peek. */
export function setScanNotificationTarget(next: ScanNotificationTarget): void {
  target = next;
}

/** Read the current target without clearing it (reactive). */
export const scanNotificationTargetState = {
  get target() {
    return target;
  },
};

/** Read and clear the pending target. */
export function takeScanNotificationTarget(): ScanNotificationTarget | null {
  const t = target;
  target = null;
  return t;
}
