let _open = $state(false);

export const authDrawerState = {
  get open() { return _open; },
  show() { _open = true; },
  hide() { _open = false; },
};
