/**
 * Modal accessibility helper for WCAG-compliant focus management and screen reader announcements.
 *
 * Provides:
 * - Focus trap management (capture trigger, focus first element, restore on close)
 * - Screen reader announcements via aria-live regions
 *
 * Reusable across any modal that needs proper accessibility support.
 */

export interface IModalAccessibilityHelper {
  /**
   * Current announcement text for the aria-live region.
   * Bind this to a visually-hidden element with role="status" aria-live="polite".
   */
  readonly announcement: string;

  /**
   * Capture the currently focused element as the trigger.
   * Call this when the modal opens, before focusing inside the modal.
   */
  captureTrigger(): void;

  /**
   * Focus the first focusable element within a container.
   * Call this after the modal renders.
   */
  focusFirstElement(container: HTMLElement | null): Promise<void>;

  /**
   * Restore focus to the captured trigger element.
   * Call this when the modal closes.
   */
  restoreFocus(): void;

  /**
   * Announce a message to screen readers via aria-live region.
   * @param message The message to announce
   * @param priority "polite" for status updates, "assertive" for important changes
   */
  announce(message: string, priority?: "polite" | "assertive"): void;

  /**
   * Clear any pending announcement.
   */
  clearAnnouncement(): void;
}
