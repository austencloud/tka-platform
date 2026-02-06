import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../../firebase";
import type { IStepUpAuthCoordinator } from "../contracts/IStepUpAuthCoordinator";

/**
 * Checks if user has password provider
 */
function hasPasswordProvider(): boolean {
  return (
    auth.currentUser?.providerData?.some((p) => p?.providerId === "password") ??
    false
  );
}

/**
 * Attempts password re-authentication if possible
 */
async function passwordReauthIfPossible(
  password: string | null | undefined
): Promise<boolean> {
  const user = auth.currentUser;
  if (!password) return false;
  if (!user?.email) return false;
  if (!hasPasswordProvider()) return false;

  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
  await user.getIdToken(true);
  return true;
}

/**
 * Coordinates step-up authentication for sensitive operations
 */
export class StepUpAuthCoordinator implements IStepUpAuthCoordinator {
  private _showStepUpModal = $state(false);
  private _pendingAction = $state<(() => Promise<void>) | null>(null);

  get showStepUpModal(): boolean {
    return this._showStepUpModal;
  }

  async executeSensitive(
    action: () => Promise<void>,
    options?: {
      allowPasswordReauth?: boolean;
      password?: string;
    }
  ): Promise<void> {
    try {
      await action();
      return;
    } catch (e: unknown) {
      const code =
        typeof e === "object" && e && "code" in e ? (e as { code: string }).code : null;
      if (code !== "step_up_required") throw e;
    }

    // Try password re-auth if allowed
    if (options?.allowPasswordReauth) {
      const did = await passwordReauthIfPossible(options.password).catch(
        () => false
      );
      if (did) {
        await action();
        return;
      }
    }

    // Show step-up modal
    this._pendingAction = action;
    this._showStepUpModal = true;
  }

  async handleSuccess(): Promise<void> {
    const action = this._pendingAction;
    this._pendingAction = null;
    this._showStepUpModal = false;

    if (!action) return;

    try {
      await action();
    } catch (e) {
      console.error("Sensitive action failed after verification:", e);
      alert(
        "Verification succeeded, but the action still failed. Please try again."
      );
    }
  }

  handleCancel(): void {
    this._pendingAction = null;
    this._showStepUpModal = false;
  }
}
