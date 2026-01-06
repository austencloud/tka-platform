/**
 * Google OAuth Configuration
 *
 * The Web Client ID for Google One Tap sign-in.
 * This enables frictionless one-tap authentication without redirects.
 *
 * Configured in Google Cloud Console:
 * https://console.cloud.google.com/apis/credentials?project=the-kinetic-alphabet
 */

export const GOOGLE_CLIENT_ID =
  "664225703033-vkueh7kq400kr63ml7drlr7bppp98pjq.apps.googleusercontent.com";

/**
 * Check if Google One Tap is properly configured
 */
export function isGoogleOneTapConfigured(): boolean {
  return Boolean(
    GOOGLE_CLIENT_ID?.includes(".apps.googleusercontent.com")
  );
}
