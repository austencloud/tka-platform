import {
  updatePassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import { auth, getFirestoreInstance } from "../../firebase";
import { nuclearCacheClear } from "../../utils/nuclearCacheClear";
import type { HapticFeedback } from "../../../application/services/haptic-feedback";

/**
 * Manages user account operations using Firebase client SDK directly.
 * No server routes needed - all operations go through Firebase Auth
 * and Firestore client libraries, which work with adapter-static.
 */
export class AccountManager {
  constructor(private haptics: HapticFeedback) {}

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

    const user = auth.currentUser;
    if (!user?.email) {
      throw new Error("No authenticated user found");
    }

    // Re-authenticate to prove identity
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    try {
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

    // Update password via Firebase client SDK
    await updatePassword(user, newPassword);
    this.haptics.trigger("success");
  }

  async deleteAccount(currentPassword: string): Promise<void> {
    this.haptics.trigger("warning");

    const user = auth.currentUser;
    if (!user?.email) {
      throw new Error("No authenticated user found");
    }

    if (!currentPassword) {
      throw new Error("Password is required to delete your account");
    }

    // Re-authenticate to prove identity
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    try {
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
        throw new Error("Incorrect password");
      }
      throw new Error("Authentication failed");
    }

    // Best-effort cleanup: delete the user's Firestore document
    try {
      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, "users", user.uid);
      await deleteDoc(userDocRef);
    } catch {
      // Non-fatal - the auth account is the important deletion
      console.warn("Could not delete user Firestore document");
    }

    // Delete the Firebase Auth account
    await deleteUser(user);

    // Sign out locally (belt-and-suspenders - deleteUser should invalidate session)
    await signOut(auth).catch(() => {});

    this.haptics.trigger("success");
  }

  async clearCache(): Promise<void> {
    this.haptics.trigger("selection");

    try {
      await nuclearCacheClear();
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
