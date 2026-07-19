import type { AuthNudgeTrigger } from "../domain/auth-nudge-trigger";

let _open = $state(false);
let _initialMode = $state<"signin" | "signup">("signup");
// Why the drawer is opening (e.g. "export"), so AuthModal can show that
// trigger's copy instead of the generic "Free. Save your work." subtitle.
// Cleared on every show() call that doesn't pass one, so a reason never
// bleeds into an unrelated later open.
let _reason = $state<AuthNudgeTrigger | null>(null);

export const authDrawerState = {
  get open() { return _open; },
  get initialMode() { return _initialMode; },
  get reason() { return _reason; },
  show(mode: "signin" | "signup" = "signup", reason?: AuthNudgeTrigger) {
    _initialMode = mode;
    _reason = reason ?? null;
    _open = true;
  },
  hide() { _open = false; },
  /**
   * Called by the auth listener whenever the user's authenticated status
   * changes. Forces the drawer back to closed so it doesn't auto-re-open the
   * next time the user signs out (MainApplication re-mounts AuthDrawer with
   * `open={authDrawerState.open}`, so stale truth here becomes a ghost sheet).
   */
  reset() { _open = false; _initialMode = "signup"; _reason = null; },
};
