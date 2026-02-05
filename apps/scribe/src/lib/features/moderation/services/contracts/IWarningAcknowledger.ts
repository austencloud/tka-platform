/**
 * IWarningAcknowledger
 *
 * Contract for acknowledging moderation warnings.
 */

export interface IWarningAcknowledger {
  /**
   * Acknowledge and clear the current user's active warning.
   * Sets hasActiveWarning to false.
   */
  acknowledgeWarning(): Promise<void>;
}
