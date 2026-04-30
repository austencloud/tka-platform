/**
 * DeviceIdService - per-browser stable identifier.
 *
 * Used to group anonymous scans into a "scanner profile" and to link
 * anonymous activity to a signed-in user account after first sign-in.
 *
 * Identifier is stored in localStorage as `tka:deviceId`.
 */
export interface IDeviceIdService {
  /**
   * Get the current device's stable ID. Generates a UUID on first call
   * and persists it. Returns the same value for all subsequent calls
   * in the same browser profile.
   */
  getDeviceId(): string;

  /**
   * Link the current device to a signed-in user. Writes/updates
   * `users/{userId}/devices/{deviceId}` in Firestore with timestamps.
   * Safe to call repeatedly (idempotent last-seen update).
   */
  linkDeviceToUser(userId: string): Promise<void>;
}
