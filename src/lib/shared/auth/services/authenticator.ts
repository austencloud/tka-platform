/**
 * Firebase authentication operations:
 * - Social auth (Google, Facebook)
 * - Email/password auth
 * - Account linking/unlinking
 * - Email verification utilities
 */

import {
  EmailAuthProvider,
  FacebookAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  indexedDBLocalPersistence,
  linkWithCredential,
  linkWithPopup,
  sendEmailVerification,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  unlink,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";

// Dev-only breadcrumb. Google's popup auth handler ships a report-only COOP
// header, so Chrome logs a browser-level "Cross-Origin-Opener-Policy policy
// would block the window.close call" warning when Firebase closes the popup.
// That warning is browser-emitted and cannot be intercepted from page JS, so
// we print an adjacent note explaining it's benign. Sign-in still completes.
// firebase-js-sdk#8541 / #8295. Fully removed in prod via tree-shaking.
export function notePopupCoop(): void {
  if (!import.meta.env.DEV) return;
  console.info(
    "%c[auth]%c Opening Google/Facebook popup — a “Cross-Origin-Opener-Policy … window.close” warning may follow. It's benign (Google's popup header) and sign-in still works.",
    "color:#7dd3fc;font-weight:bold",
    "color:inherit",
  );
}

export async function signInWithGoogle(): Promise<void> {
  const { isDesktop } = await import("$lib/shared/desktop/is-desktop");
  if (isDesktop()) {
    const { signInWithDesktopOAuth } = await import("$lib/shared/desktop/tauri-auth-bridge");
    await signInWithDesktopOAuth();
    return;
  }
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  notePopupCoop();
  await signInWithPopup(auth, provider);
}

export async function signInWithGoogleCredential(idToken: string): Promise<void> {
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, credential);
}

export async function signInWithFacebook(): Promise<void> {
  const provider = new FacebookAuthProvider();
  provider.addScope("email");
  provider.addScope("public_profile");
  notePopupCoop();
  await signInWithPopup(auth, provider);
}

async function setAuthPersistence(): Promise<void> {
  try {
    await setPersistence(auth, indexedDBLocalPersistence);
  } catch {
    await setPersistence(auth, browserLocalPersistence);
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await setAuthPersistence();
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string,
): Promise<void> {
  await setAuthPersistence();
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  if (name?.trim()) {
    await updateProfile(userCredential.user, { displayName: name.trim() });
  }

  await sendEmailVerification(userCredential.user);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function linkGoogleAccount(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("No user is currently signed in");

  const isAlreadyLinked = currentUser.providerData.some((p) => p.providerId === "google.com");
  if (isAlreadyLinked) throw new Error("Google account is already linked");

  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  notePopupCoop();
  await linkWithPopup(currentUser, provider);
}

export async function linkFacebookAccount(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("No user is currently signed in");

  const isAlreadyLinked = currentUser.providerData.some((p) => p.providerId === "facebook.com");
  if (isAlreadyLinked) throw new Error("Facebook account is already linked");

  const provider = new FacebookAuthProvider();
  provider.addScope("email");
  provider.addScope("public_profile");
  notePopupCoop();
  await linkWithPopup(currentUser, provider);
}

export function getLinkedProviders(): string[] {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];
  return currentUser.providerData
    .map((p) => p.providerId)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
}

export async function unlinkProvider(providerId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("No user is currently signed in");
  await unlink(currentUser, providerId);
}

export async function linkEmailPassword(email: string, password: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("No user is currently signed in");

  if (!email?.trim()) throw new Error("Email is required");
  if (!password) throw new Error("Password is required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const credential = EmailAuthProvider.credential(email.trim(), password);
  await linkWithCredential(currentUser, credential);
}

export async function resendVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No user is currently signed in");
  await sendEmailVerification(user);
}

export async function reloadUser(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) throw new Error("No user is currently signed in");
  await user.reload();
  return !!auth.currentUser?.emailVerified;
}

export function isEmailVerified(): boolean {
  return !!auth.currentUser?.emailVerified;
}
