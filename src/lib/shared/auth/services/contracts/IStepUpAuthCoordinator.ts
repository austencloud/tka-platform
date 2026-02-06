/**
 * Coordinates step-up authentication for sensitive operations
 *
 * Handles the flow of:
 * 1. Attempting the operation
 * 2. Catching step_up_required errors
 * 3. Optionally trying password re-auth
 * 4. Showing passkey modal if needed
 * 5. Retrying operation after verification
 */
export interface IStepUpAuthCoordinator {
  /**
   * Executes a sensitive action with step-up authentication if required
   * @param action - The sensitive operation to perform
   * @param options - Optional password for re-authentication
   */
  executeSensitive(
    action: () => Promise<void>,
    options?: {
      allowPasswordReauth?: boolean;
      password?: string;
    }
  ): Promise<void>;

  /**
   * Whether the step-up modal should be shown
   */
  readonly showStepUpModal: boolean;

  /**
   * Called when step-up verification succeeds
   * Retries the pending action
   */
  handleSuccess(): Promise<void>;

  /**
   * Called when user cancels step-up verification
   */
  handleCancel(): void;
}
