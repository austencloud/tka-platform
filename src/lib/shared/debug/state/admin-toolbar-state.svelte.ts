/**
 * Admin Toolbar State
 *
 * Manages the admin toolbar visibility and search panel.
 * Triggered by F9 keyboard shortcut.
 *
 * Domain: Debug Tools - Admin Toolbar
 */

let _isOpen = $state(false);
let _isSearchOpen = $state(false);

/**
 * Admin toolbar state
 */
export const adminToolbarState = {
  /** Whether the toolbar is open */
  get isOpen() {
    return _isOpen;
  },

  /** Whether search panel is open */
  get isSearchOpen() {
    return _isSearchOpen;
  },

  /** Toggle the toolbar open/closed */
  toggle() {
    _isOpen = !_isOpen;
    if (!_isOpen) {
      _isSearchOpen = false;
    }
  },

  /** Open the toolbar */
  open() {
    _isOpen = true;
  },

  /** Close the toolbar */
  close() {
    _isOpen = false;
    _isSearchOpen = false;
  },

  /** Toggle search panel */
  toggleSearch() {
    _isSearchOpen = !_isSearchOpen;
  },

  /** Open search */
  openSearch() {
    _isSearchOpen = true;
  },

  /** Close search */
  closeSearch() {
    _isSearchOpen = false;
  },
};
