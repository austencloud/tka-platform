/**
 * Dismiss contract for the bottom sheet, kept outside the Svelte component so
 * plain TypeScript consumers and tests resolve the same behavior. Escape and
 * an outside pointer press close the sheet. Portalled dialogs can exempt their
 * targets because they live outside the sheet's DOM subtree.
 */
export function createSheetDismiss(
  onClose: () => void,
  getPanel: () => HTMLElement | null = () => null,
  isExempt: (target: EventTarget | null) => boolean = () => false
) {
  return {
    onKeydown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (isExempt(e.target)) return;
      onClose();
    },
    onBackdropPointerDown(e: PointerEvent) {
      const panel = getPanel();
      if (panel && e.target instanceof Node && panel.contains(e.target)) return;
      if (isExempt(e.target)) return;
      onClose();
    },
  };
}
