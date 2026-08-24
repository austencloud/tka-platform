import { VIEWER3D_INTRO_ENABLED } from "../domain/onboarding-flags";
import { VIEWER3D_INTRO_SEEN_KEY } from "../config/storage-keys";
import { getOnboardingPersister } from "$lib/shared/onboarding/get-onboarding-persister";

/** Synchronous gate — no flash: localStorage is the fast path. */
export function shouldShowViewer3DIntro(): boolean {
  if (!VIEWER3D_INTRO_ENABLED) return false;
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(VIEWER3D_INTRO_SEEN_KEY) !== "true";
  } catch {
    return false;
  }
}

/** Local mark only — used by tests and as the synchronous half. */
export function markViewer3DIntroSeenLocal(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(VIEWER3D_INTRO_SEEN_KEY, "true");
  } catch {
    // Quota — the intro may show once more on this device.
  }
}

/** Full mark: local immediately, cloud in the background. */
export function markViewer3DIntroSeen(): void {
  markViewer3DIntroSeenLocal();
  try {
    const persister = getOnboardingPersister();
    void persister.markViewer3DIntroSeen().catch(() => {});
  } catch {
    // Unauthenticated/persister unavailable — local flag stands.
  }
}
