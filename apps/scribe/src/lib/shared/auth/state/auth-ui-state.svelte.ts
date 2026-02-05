/**
 * Auth UI State
 *
 * Manages the state of the authentication dialog/sheet.
 * Used to control opening/closing the AuthSheet from anywhere in the app.
 */

// State for auth dialog visibility
let isAuthDialogOpen = $state(false);

/**
 * Open the authentication dialog
 */
export function openAuthDialog(): void {
  isAuthDialogOpen = true;
}

/**
 * Close the authentication dialog
 */
export function closeAuthDialog(): void {
  isAuthDialogOpen = false;
}

/**
 * Get reactive state of auth dialog
 * Use this in components to reactively track dialog state
 */
export function getAuthDialogState() {
  return {
    get isOpen() {
      return isAuthDialogOpen;
    },
    open: openAuthDialog,
    close: closeAuthDialog,
  };
}

// Export reactive getter for direct use
export const authDialogState = {
  get isOpen() {
    return isAuthDialogOpen;
  },
  open: openAuthDialog,
  close: closeAuthDialog,
};
