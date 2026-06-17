// src/lib/shared/auth/services/guest-identity.ts
import { signInAnonymously } from "firebase/auth";
import { getAuthInstance } from "$lib/shared/auth/firebase";

/**
 * Lazily provision an anonymous Firebase identity. Idempotent and
 * concurrency-safe: a single in-flight sign-in is shared across callers, and a
 * no-op once any user (anonymous or full) is present.
 *
 * Call from every "first persistable action" entry point — committing a first
 * beat, saving, favoriting. Uses getAuthInstance() (HMR-safe) rather than the
 * static `auth` export to avoid the dev-cycle app-rotation argument-error.
 */
let inFlight: Promise<void> | null = null;

export async function ensureGuestIdentity(): Promise<void> {
  const auth = await getAuthInstance();
  if (auth.currentUser) return;
  if (inFlight) return inFlight;
  inFlight = signInAnonymously(auth)
    .then(() => undefined)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
