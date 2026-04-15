let _open = $state(false);
let _initialMode = $state<"signin" | "signup">("signup");

export const authDrawerState = {
  get open() { return _open; },
  get initialMode() { return _initialMode; },
  show(mode: "signin" | "signup" = "signup") { _initialMode = mode; _open = true; },
  hide() { _open = false; },
  /**
   * Called by the auth listener whenever the user's authenticated status
   * changes. Forces the drawer back to closed so it doesn't auto-re-open the
   * next time the user signs out (MainApplication re-mounts AuthDrawer with
   * `open={authDrawerState.open}`, so stale truth here becomes a ghost sheet).
   */
  reset() { _open = false; _initialMode = "signup"; },
};
