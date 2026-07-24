// src/lib/shared/auth/services/auth-error-messages.ts
//
// Single source of truth for turning a Firebase Auth error code into a
// user-facing message. Extracted from SocialAuthCompact so AccountPopover's
// sidebar sign-in and any other Google sign-in surface show the same wording
// instead of re-deriving the mapping inline.
//
// `null` means "don't toast" — the user cancelled/dismissed the flow
// themselves, which is not an error worth surfacing.

export function getAuthErrorCode(error: unknown): string | undefined {
  return (error as { code?: string } | null | undefined)?.code;
}

/**
 * Provider popups can be blocked, dismissed, or superseded without indicating
 * an application failure. Callers may still show recovery copy, but these
 * outcomes should be measured as interaction events rather than exceptions.
 */
export function isExpectedAuthInterruption(error: unknown): boolean {
  const errorCode = getAuthErrorCode(error);
  return (
    errorCode === "auth/popup-blocked" ||
    errorCode === "auth/popup-closed-by-user" ||
    errorCode === "auth/cancelled-popup-request"
  );
}

/**
 * Map a Firebase Auth error (or error code) to a user-facing message.
 * Returns null when the "error" is really a user-initiated cancellation.
 */
export function mapAuthError(error: unknown): string | null {
  const errorCode = getAuthErrorCode(error);

  switch (errorCode) {
    case "auth/popup-blocked":
      return "Popup was blocked. Please allow popups for this site.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      // Silent - user just clicked away, or a second popup superseded this one.
      return null;
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized for sign-in. Please contact support.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return error instanceof Error && error.message
        ? error.message
        : "Sign-in failed. Please try again.";
  }
}
