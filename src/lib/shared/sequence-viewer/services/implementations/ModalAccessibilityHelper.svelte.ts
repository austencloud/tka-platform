import { tick } from "svelte";

/**
 * Creates a modal accessibility helper for WCAG-compliant focus management and screen reader announcements.
 *
 * Uses Svelte 5 runes for reactivity - the announcement property will trigger re-renders.
 *
 * Usage:
 * 1. Create instance when modal mounts: const helper = createModalAccessibilityHelper()
 * 2. Call captureTrigger() when modal opens
 * 3. Call focusFirstElement(container) after modal renders
 * 4. Use announce() for dynamic content changes
 * 5. Call restoreFocus() when modal closes
 * 6. Bind {helper.announcement} to an aria-live region in your template
 */
export function createModalAccessibilityHelper() {
  let announcement = $state("");
  let triggerElement: HTMLElement | null = null;

  return {
    get announcement(): string {
      return announcement;
    },

    captureTrigger(): void {
      if (typeof document !== "undefined") {
        triggerElement = document.activeElement as HTMLElement | null;
      }
    },

    async focusFirstElement(container: HTMLElement | null): Promise<void> {
      await tick();
      if (!container) return;

      const focusableSelectors = [
        "button:not([disabled])",
        "[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ].join(", ");

      const focusable = container.querySelectorAll<HTMLElement>(focusableSelectors);
      const firstElement = focusable[0];
      if (firstElement) {
        firstElement.focus();
      }
    },

    restoreFocus(): void {
      if (triggerElement && typeof triggerElement.focus === "function") {
        triggerElement.focus();
      }
    },

    announce(message: string, _priority: "polite" | "assertive" = "polite"): void {
      // Clear first to ensure repeated announcements are read
      announcement = "";

      // Use tick to ensure the DOM updates between clear and set
      tick().then(() => {
        announcement = message;
      });
    },

    clearAnnouncement(): void {
      announcement = "";
    },
  };
}
