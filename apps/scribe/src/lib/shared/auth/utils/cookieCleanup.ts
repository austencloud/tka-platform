/**
 * Clean up cookies from old Netlify deployment
 *
 * Problem: User had cookies from tkaflowarts.netlify.app that broke login
 * Solution: Delete them on app load before auth initializes
 */

export async function cleanupOldCookies(): Promise<void> {
  // Delete cookies from old Netlify deployment
  document.cookie =
    "*=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=tkaflowarts.netlify.app; path=/;";
}
