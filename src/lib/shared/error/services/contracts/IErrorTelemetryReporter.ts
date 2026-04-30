/**
 * IErrorTelemetryReporter - Auto-reports non-blocking errors to Firestore
 *
 * When something goes wrong but the user can keep working (a thumbnail didn't load,
 * audio didn't play), this silently logs it to Firestore. The developer reviews
 * patterns later via a CLI script. No user action needed.
 */

import type { ShowErrorOptions } from "$lib/shared/error/domain/error-models";

export interface IErrorTelemetryReporter {
  /**
   * Report an error to the telemetry collection.
   * Deduplicates by message + module + action - if the same error happened
   * recently, it increments the count instead of creating a new document.
   */
  report(options: ShowErrorOptions): Promise<void>;
}
