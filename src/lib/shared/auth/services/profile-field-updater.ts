import {
  updateEmail,
  updateProfile,
  sendEmailVerification,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from "firebase/auth";
import { claimUsername, releaseUsername } from "./username-validator";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirestoreInstance } from "../firebase";

export async function changeEmail(
  user: User,
  newEmail: string,
  currentPassword: string
): Promise<{ success: true; message: string }> {
  if (!user.email) {
    throw new Error("No authenticated user");
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updateEmail(user, newEmail);
    await sendEmailVerification(user);

    return {
      success: true,
      message: "Email updated successfully. Please check your inbox to verify your new email address.",
    };
  } catch (error: unknown) {
    console.error("❌ [authState] Email change error:", error);

    if (error instanceof Error && "code" in error) {
      const firebaseError = error as { code: string; message: string };
      if (firebaseError.code === "auth/wrong-password") {
        throw new Error("Incorrect password. Please try again.");
      } else if (firebaseError.code === "auth/email-already-in-use") {
        throw new Error("This email is already in use by another account.");
      } else if (firebaseError.code === "auth/invalid-email") {
        throw new Error("Invalid email address format.");
      } else if (firebaseError.code === "auth/requires-recent-login") {
        throw new Error("Please sign out and sign in again before changing your email.");
      } else {
        throw new Error(firebaseError.message || "Failed to change email. Please try again.");
      }
    } else {
      const message = error instanceof Error ? error.message : "Failed to change email. Please try again.";
      throw new Error(message);
    }
  }
}

export async function updateDisplayName(
  user: User
, displayName: string): Promise<{ success: true; message: string }> {
  try {
    await updateProfile(user, { displayName: displayName.trim() || null });
    return { success: true, message: "Display name updated successfully." };
  } catch (error: unknown) {
    console.error("❌ [authState] Display name update error:", error);
    const message = error instanceof Error ? error.message : "Failed to update display name. Please try again.";
    throw new Error(message);
  }
}

export async function updateUsername(
  user: User,
  newUsername: string
): Promise<{ success: true; message: string }> {
  try {
    const firestore = await getFirestoreInstance();
    const userDocRef = doc(firestore, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    const currentUsername = userDoc.data()?.username;

    await claimUsername(user.uid, newUsername.trim());

    if (currentUsername && currentUsername.toLowerCase() !== newUsername.toLowerCase()) {
      await releaseUsername(currentUsername);
    }

    return { success: true, message: "Username updated successfully." };
  } catch (error: unknown) {
    console.error("❌ [authState] Username update error:", error);
    const message = error instanceof Error ? error.message : "Failed to update username. Please try again.";
    throw new Error(message);
  }
}

export async function updateInstagramUsername(
  user: User,
  username: string
): Promise<{ success: true; message: string }> {
  try {
    const normalized = username.trim().replace(/^@/, "");
    const valueToStore = normalized || null;

    const firestore = await getFirestoreInstance();
    const userDocRef = doc(firestore, "users", user.uid);
    await setDoc(userDocRef, { instagramUsername: valueToStore }, { merge: true });

    return {
      success: true,
      message: valueToStore ? "Instagram username updated successfully." : "Instagram username cleared.",
    };
  } catch (error: unknown) {
    console.error("❌ [authState] Instagram username update error:", error);
    const message = error instanceof Error ? error.message : "Failed to update Instagram username. Please try again.";
    throw new Error(message);
  }
}

export async function updatePronouns(
  user: User,
  pronouns: string
): Promise<{ success: true; message: string }> {
  try {
    const trimmed = pronouns.trim();
    const valueToStore = trimmed || null;

    const firestore = await getFirestoreInstance();
    const userDocRef = doc(firestore, "users", user.uid);
    await setDoc(userDocRef, { pronouns: valueToStore }, { merge: true });

    return {
      success: true,
      message: valueToStore ? "Pronouns updated successfully." : "Pronouns cleared.",
    };
  } catch (error: unknown) {
    console.error("❌ [authState] Pronouns update error:", error);
    const message = error instanceof Error ? error.message : "Failed to update pronouns. Please try again.";
    throw new Error(message);
  }
}
