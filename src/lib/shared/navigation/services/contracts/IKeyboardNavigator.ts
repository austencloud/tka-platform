/**
 * IKeyboardNavigator Contract
 *
 * Manages keyboard navigation within module selection.
 */
export interface IKeyboardNavigator {
  /**
   * Handle arrow key navigation
   */
  handleArrowKey(direction: "up" | "down" | "left" | "right"): void;

  /**
   * Handle Enter key to select current item
   */
  handleEnterKey(): void;

  /**
   * Handle Escape key to close/cancel
   */
  handleEscapeKey(): void;

  /**
   * Handle Tab key navigation
   */
  handleTabKey(shiftPressed: boolean): void;

  /**
   * Set the currently focused element index
   */
  setFocusedIndex(index: number): void;

  /**
   * Get the currently focused element index
   */
  getFocusedIndex(): number;

  /**
   * Enable keyboard navigation
   */
  enable(): void;

  /**
   * Disable keyboard navigation
   */
  disable(): void;

  /**
   * Check if keyboard navigation is enabled
   */
  isEnabled(): boolean;

  /**
   * Subscribe to focus changes
   * @param callback Function to call when focus changes
   * @returns Unsubscribe function
   */
  onFocusChange(callback: (index: number) => void): () => void;
}
