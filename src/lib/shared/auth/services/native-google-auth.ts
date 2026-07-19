import { GoogleAuthProvider, type OAuthCredential } from "firebase/auth";

/**
 * Obtain a Google OAuth credential via the native Google SDK (Capacitor).
 *
 * Every native Google entry point (sign-in, anonymous-upgrade link, account
 * link, reauth) must use this instead of signInWithPopup: in the Android
 * WebView the popup falls back to a redirect through the auth handler, which
 * both loses sessionStorage ("auth/missing-initial-state") and hits Google's
 * disallowed_useragent wall ("this browser doesn't support sign-in").
 *
 * skipNativeAuth (capacitor.config) keeps the JS Firebase SDK authoritative —
 * callers feed this credential to signInWithCredential / linkWithCredential /
 * reauthenticateWithCredential on the JS side.
 *
 * Lives in its own module because both authenticator.ts and
 * anonymous-upgrade.ts need it, and authenticator already imports from
 * anonymous-upgrade (a shared home avoids the import cycle).
 */
export async function nativeGoogleCredential(): Promise<OAuthCredential> {
  const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) {
    throw new Error("Native Google sign-in did not return an ID token");
  }
  return GoogleAuthProvider.credential(idToken);
}
