let _open = $state(false);
let _initialMode = $state<"signin" | "signup">("signup");

export const authDrawerState = {
  get open() { return _open; },
  get initialMode() { return _initialMode; },
  show(mode: "signin" | "signup" = "signup") { _initialMode = mode; _open = true; },
  hide() { _open = false; },
};
