import {
  updatePassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth } from "../../firebase";
import { nuclearCacheClear } from "../../utils/nuclearCacheClear";
import type { IAccountManager } from "../contracts/IAccountManager";
import type { IProfileApiClient } from "../contracts/IProfileApiClient";
import type { IStepUpAuthCoordinator } from "../contracts/IStepUpAuthCoordinator";
import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
import { container } from "$lib/shared/di";
import type { IErrorHandler } from "$lib/shared/application/services/contracts/IErrorHandler";

/**
 * Manages user account operations (password changes, deletion, cache clearing)
 */
export class AccountManager implements IAccountManager {
  constructor(
    private apiClient: IProfileApiClient,
    private stepUpCoordinator: IStepUpAuthCoordinator,
    private haptics: IHapticFeedback
  ) {}

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    this.haptics.trigger("selection");

    if (newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (!currentPassword) {
      throw new Error("Current password is required");
    }

    // Verify current password before attempting the change
    const user = auth.currentUser;
    if (!user?.email) {
      throw new Error("No authenticated user found");
    }

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);
    } catch (e: unknown) {
      const code =
        typeof e === "object" && e && "code" in e
          ? (e as { code: string }).code
          : "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        throw new Error("WRONG_PASSWORD");
      }
      throw new Error("WRONG_PASSWORD");
    }

    // Current password verified — now change it
    await this.stepUpCoordinator.executeSensitive(
      async () => {
        await this.apiClient.request("/api/account/update-password", {
          newPassword,
        });

        // Update client auth password so Firebase doesn't immediately desync
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newPassword).catch((error) => {
            try {
              const errorHandler = container.items.errorHandler as IErrorHandler;
              errorHandler.showWarning(
                "Password changed on server, but your session may need a re-login to sync."
              );
            } catch {
              console.warn("Client password sync failed:", error);
            }
          });
        }

        this.haptics.trigger("success");
      },
      { allowPasswordReauth: true, password: currentPassword }
    );
  }

  async deleteAccount(): Promise<void> {
    this.haptics.trigger("warning");

    await this.stepUpCoordinator.executeSensitive(
      async () => {
        await this.apiClient.request("/api/account/delete");
        await signOut(auth).catch((error) => {
          try {
            const errorHandler = container.items.errorHandler as IErrorHandler;
            errorHandler.showWarning(
              "Account deleted, but sign-out failed. Please close and reopen the app."
            );
          } catch {
            console.warn("Sign-out after deletion failed:", error);
          }
        });
        alert("Account deleted successfully.");
      },
      { allowPasswordReauth: true }
    );
  }

  async clearCache(): Promise<void> {
    this.haptics.trigger("selection");

    try {
      await nuclearCacheClear();
      // Intentional: reload must fire after cache clear completes, no cancellation needed
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Failed to clear cache:", error);
      this.haptics.trigger("error");
      throw new Error("Failed to clear cache. Please try again.");
    }
  }
}
