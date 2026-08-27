import { signInAnonymously } from "firebase/auth";
import { getAuthInstance } from "$lib/shared/auth/firebase";
import {
  captureExceptionWhenReady,
  captureWhenReady,
} from "$lib/shared/analytics/services/posthog";

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
let warnedDisabled = false;
let restoredRecorded = false;
let createdRecorded = false;

export async function ensureGuestIdentity(): Promise<void> {
  const auth = await getAuthInstance();
  if (auth.currentUser) {
    if (auth.currentUser.isAnonymous && !restoredRecorded) {
      restoredRecorded = true;
      captureWhenReady("guest_identity_restored", {
        source: "first_persistable_action",
      });
    }
    return;
  }
  if (inFlight) return inFlight;
  inFlight = signInAnonymously(auth)
    .then(() => {
      if (!createdRecorded) {
        createdRecorded = true;
        captureWhenReady("guest_identity_created", {
          source: "first_persistable_action",
        });
      }
    })
    .catch((err: unknown) => {
      // Anonymous auth provider may be disabled in the Firebase console
      // (auth/admin-restricted-operation), or sign-in may fail offline. Swallow
      // so a guest's first persistable action doesn't surface an uncaught
      // rejection on every page — log once. Guest continuity stays inert until
      // the provider is enabled; nothing downstream should hard-depend on a uid.
      if (!warnedDisabled) {
        warnedDisabled = true;
        const failureCode =
          typeof (err as { code?: unknown } | null)?.code === "string"
            ? String((err as { code: string }).code).slice(0, 80)
            : "unknown";
        captureWhenReady("guest_identity_failed", {
          source: "first_persistable_action",
          failure_code: failureCode,
        });
        captureExceptionWhenReady(err, {
          auth_error_code: failureCode,
          auth_action: "ensure_guest_identity",
        });
        console.warn("[guest-identity] anonymous sign-in unavailable:", err);
      }
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
