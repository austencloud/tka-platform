/**
 * Focus Trap Utility
 * Manages keyboard focus within a modal dialog for accessibility
 */

export interface FocusTrapState {
  firstFocusableElement: HTMLElement | null;
  lastFocusableElement: HTMLElement | null;
  cleanup: () => void;
}

export interface FocusTrapOptions {
  /** The container element to trap focus within */
  container: HTMLElement;
  /** Callback when Escape key is pressed */
  onEscape?: () => void;
  /** Whether to auto-focus the first element */
  autoFocus?: boolean;
}

/**
 * Sets up a focus trap within a container element
 * Returns cleanup function to remove event listeners
 */
export function createFocusTrap(options: FocusTrapOptions): FocusTrapState {
  const { container, onEscape, autoFocus = true } = options;

  // Find all focusable elements
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstFocusableElement = focusableElements[0] as HTMLElement | null;
  const lastFocusableElement = focusableElements[
    focusableElements.length - 1
  ] as HTMLElement | null;

  // Auto-focus first element if requested
  if (autoFocus && firstFocusableElement) {
    firstFocusableElement.focus();
  }

  /**
   * Handle keyboard events for accessibility
   */
  function handleKeyDown(event: KeyboardEvent) {
    // Escape key
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape?.();
      return;
    }

    // Tab key for focus trap
    if (event.key === "Tab") {
      if (event.shiftKey) {
        // Shift+Tab - moving backwards
        if (
          document.activeElement === firstFocusableElement &&
          lastFocusableElement
        ) {
          event.preventDefault();
          lastFocusableElement.focus();
        }
      } else {
        // Tab - moving forwards
        if (
          document.activeElement === lastFocusableElement &&
          firstFocusableElement
        ) {
          event.preventDefault();
          firstFocusableElement.focus();
        }
      }
    }
  }

  // Add event listener
  document.addEventListener("keydown", handleKeyDown);

  // Return state and cleanup function
  return {
    firstFocusableElement,
    lastFocusableElement,
    cleanup: () => {
      document.removeEventListener("keydown", handleKeyDown);
    },
  };
}
