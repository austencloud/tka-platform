/**
 * Profile Picture Resolver
 *
 * Resolves reliable profile picture URLs from user data.
 * Handles expiring OAuth URLs by constructing fresh URLs from provider IDs.
 */

/**
 * Get a reliable profile picture URL from user data
 *
 * Priority order:
 * 1. Google ID -> construct fresh Google Photos URL
 * 2. Facebook ID -> construct fresh Graph API URL
 * 3. Stored photoURL (may be stale)
 * 4. Avatar field as last resort
 * 5. null if nothing found
 *
 * @remarks
 * Google and Facebook profile picture URLs stored in Firebase Auth can expire.
 * Using the provider ID to construct a fresh URL is more reliable.
 */
export function getReliableProfilePictureURL(
  userData: Record<string, unknown>
): string | null {
  // 1. Try Google ID first - most reliable
  const googleId = userData["googleId"] as string | undefined;
  if (googleId) {
    // Use Google's People API format which doesn't expire
    // The =s96-c suffix requests a 96px circular crop
    return `https://lh3.googleusercontent.com/a/${googleId}=s96-c`;
  }

  // 2. Try Facebook ID
  const facebookId = userData["facebookId"] as string | undefined;
  if (facebookId) {
    // Facebook Graph API URL for profile picture
    return `https://graph.facebook.com/${facebookId}/picture?type=large`;
  }

  // 3. Fall back to stored photoURL (may be stale)
  const photoURL = userData["photoURL"] as string | undefined;
  if (photoURL) {
    return photoURL;
  }

  // 4. Try avatar field as last resort
  const avatar = userData["avatar"] as string | undefined;
  if (avatar) {
    return avatar;
  }

  return null;
}

/**
 * User display details for analytics
 */
export interface UserDisplayDetails {
  displayName: string;
  photoURL: string | null;
  email: string | null;
}

/**
 * Extract user display details from a Firestore user document
 */
export function extractUserDisplayDetails(
  userData: Record<string, unknown>
): UserDisplayDetails {
  const photoURL = getReliableProfilePictureURL(userData);
  const email = (userData["email"] as string) ?? null;

  // Try to get display name, fall back to email prefix
  let displayName = userData["displayName"] as string | undefined;
  if (!displayName && email) {
    displayName = email.split("@")[0];
  }
  displayName = displayName ?? "Unknown User";

  return {
    displayName,
    photoURL,
    email,
  };
}
