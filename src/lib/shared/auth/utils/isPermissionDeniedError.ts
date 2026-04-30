/**
 * Detects Firestore / RTDB "permission-denied" errors.
 *
 * When a user signs out, any onSnapshot listener that was reading a protected
 * collection will fire its error callback with this code. That's the normal,
 * expected lifecycle - not a broken connection. Error handlers use this helper
 * to suppress scary "Lost connection" toasts in that case.
 */
export function isPermissionDeniedError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: string }).code;
  if (code === "permission-denied" || code === "PERMISSION_DENIED") {
    return true;
  }
  const message = (error as { message?: string }).message ?? "";
  return (
    message.includes("Missing or insufficient permissions") ||
    message.includes("permission-denied") ||
    message.includes("PERMISSION_DENIED")
  );
}
