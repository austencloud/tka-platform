import type { AuthNudgeTrigger } from "../domain/auth-nudge-trigger";
import { trackAuthSurfaceOpened } from "$lib/shared/analytics/auth-events";
import { createGuestEncoreState } from "./guest-encore-state.svelte";

const guestEncore = createGuestEncoreState(() =>
  typeof window === "undefined" ? null : window.localStorage
);

let _open = $state(false);
let _initialMode = $state<"signin" | "signup">("signup");
// Why the drawer is opening (e.g. "export"), so AuthModal can show that
// trigger's copy instead of the generic "Free. Save your work." subtitle.
// Cleared on every show() call that doesn't pass one, so a reason never
// bleeds into an unrelated later open.
let _reason = $state<AuthNudgeTrigger | null>(null);
let _stepCapAttempts = $state(0);
let _stepCapSequenceId = $state<string | null>(null);

export const authDrawerState = {
  guestEncore,
  get encorePrompt() {
    return _reason === "step-cap-guest"
      ? guestEncore.prompt(_stepCapSequenceId, _stepCapAttempts)
      : null;
  },
  claimEncore() {
    if (!_open || _reason !== "step-cap-guest") return false;
    if (!guestEncore.claim(_stepCapSequenceId, _stepCapAttempts)) return false;
    _open = false;
    return true;
  },
  get open() {
    return _open;
  },
  get initialMode() {
    return _initialMode;
  },
  get reason() {
    return _reason;
  },
  get stepCapAttempts() {
    return _stepCapAttempts;
  },
  show(
    mode: "signin" | "signup" = "signup",
    reason?: AuthNudgeTrigger,
    sequenceId?: string
  ) {
    guestEncore.restore();
    // Count encounters, not duplicate calls while the same dialog is open.
    if (reason === "step-cap-guest" && (!_open || _reason !== reason)) {
      _stepCapAttempts += 1;
    }
    _initialMode = mode;
    _reason = reason ?? null;
    _stepCapSequenceId =
      reason === "step-cap-guest" ? (sequenceId ?? null) : null;
    _open = true;
    trackAuthSurfaceOpened({
      surface: "guest_nudge_modal",
      origin: reason ?? "generic_account_action",
      auth_mode: mode,
    });
  },
  hide() {
    _open = false;
  },
  /**
   * Called by the auth listener whenever the user's authenticated status
   * changes. Forces the drawer back to closed so it doesn't auto-re-open the
   * next time the user signs out (MainApplication re-mounts AuthDrawer with
   * `open={authDrawerState.open}`, so stale truth here becomes a ghost sheet).
   */
  reset() {
    _open = false;
    _initialMode = "signup";
    _reason = null;
    _stepCapAttempts = 0;
    _stepCapSequenceId = null;
  },
};
