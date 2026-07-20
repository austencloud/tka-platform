/**
 * This browser's stable device identity: one random UUID minted on the first
 * visit and kept in localStorage forever.
 *
 * Why it lives here instead of in auth/services/device-id-service.ts (which now
 * re-exports it): that module imports firebase/firestore to write the device
 * doc. Analytics needs this id at PostHog init — long before Firestore is
 * wanted, and from module graphs that crash outright if Firebase gets dragged
 * in (the composition worker, see the note atop analytics/services/posthog.ts).
 * This file has zero imports, so anything can read it.
 */

const STORAGE_KEY = "tka:deviceId";

export function getDeviceId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, fresh);
  return fresh;
}
