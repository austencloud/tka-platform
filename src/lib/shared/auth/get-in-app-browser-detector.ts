import { InAppBrowserDetector } from "./services/in-app-browser-detector";

let instance: InAppBrowserDetector | null = null;

/**
 * Shared detector instance.
 *
 * Three call sites now need the same answer — the banner, the auth modal, and
 * Firestore's cache choice — and each `new InAppBrowserDetector()` carries its
 * own memoization, so separate instances would re-run detection and could
 * disagree if one of them ran before Capacitor finished registering.
 *
 * No `browser` guard here, unlike getAccountManager: detect() already handles
 * `typeof navigator === "undefined"`, and callers may reasonably ask during SSR.
 */
export function getInAppBrowserDetector(): InAppBrowserDetector {
  return (instance ??= new InAppBrowserDetector());
}
