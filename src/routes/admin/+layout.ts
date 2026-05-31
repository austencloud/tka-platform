/**
 * Admin Route Guard
 *
 * Client-side guard that prevents non-admin users from loading admin pages.
 * Waits for Firebase Auth to initialize, then checks admin status.
 * Redirects non-admins to the home page.
 *
 * Note: This is a defense-in-depth measure. All admin operations are also
 * protected server-side by Firestore rules and API endpoint guards (requireAdmin).
 */

import { redirect } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async () => {
  // Only run in browser (SSR has no Firebase auth context)
  if (typeof window === "undefined") {
    return {};
  }

  const { isInitialized, isAdmin } = await import(
    "$lib/shared/auth/state/auth-state.svelte"
  );

  // Wait for auth to initialize (Firebase needs to resolve the token)
  if (!isInitialized()) {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (isInitialized()) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      // Timeout after 5 seconds - if auth hasn't initialized, reject
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 5000);
    });
  }

  if (!isAdmin()) {
    throw redirect(303, "/");
  }

  return {};
};
