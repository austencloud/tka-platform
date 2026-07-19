import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";

/**
 * Take-it-home gate.
 *
 * Downloading rendered output (sequence animations, choreo cards, print PDFs)
 * requires a full, non-anonymous account. Guests may play with everything —
 * configure export options, preview, render on screen — but pulling the actual
 * file down is the "take it home" step that earns a free signup. Anonymous
 * Firebase sessions don't qualify: they're ephemeral (auto-cleaned) and
 * single-device, so a file saved under one is effectively a dead end.
 *
 * Returns true when the caller may proceed. Otherwise it opens the signup
 * modal and returns false, so the caller should bail; the user re-runs the
 * export once they have an account.
 */
export function ensureFullAccountForExport(): boolean {
  if (authState.isAuthenticated && !authState.isAnonymous) return true;
  authDrawerState.show("signup", "export");
  return false;
}
