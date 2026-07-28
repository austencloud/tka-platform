import { registerNativeShareTarget } from "./services/native-share-adapter";

let registration: Promise<void> | null = null;

/**
 * Idempotent registration - safe to call from more than one boot path, and
 * every caller awaits the SAME promise.
 */
export function ensureShareTargetRegistered(): Promise<void> {
  registration ??= registerNativeShareTarget();
  return registration;
}
