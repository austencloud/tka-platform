// Global open/close state for the in-app Support modal.
//
// Two entry points trigger it (the desktop SidebarFooter heart button and the
// mobile ModuleSwitcher drawer's Support row), and it mounts once at the app
// shell (MainApplication). Mirrors auth-drawer-state.svelte.ts: a module-level
// singleton with getters so any caller shares one source of truth.

let _open = $state(false);

export const supportModalState = {
  get open() {
    return _open;
  },
  show() {
    _open = true;
  },
  hide() {
    _open = false;
  },
};
