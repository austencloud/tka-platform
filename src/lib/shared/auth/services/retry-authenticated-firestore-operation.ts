import type { User } from "firebase/auth";
import { isPermissionDeniedError } from "../utils/is-permission-denied-error";

/**
 * Account linking can update the Firebase user before Firestore observes the
 * replacement ID token. Retry one owner-scoped operation after forcing that
 * token refresh; a real rules denial still reaches the caller on attempt two.
 */
export async function retryAuthenticatedFirestoreOperation<T>(
  user: User,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isPermissionDeniedError(error)) throw error;
    await user.getIdToken(true);
    return operation();
  }
}
