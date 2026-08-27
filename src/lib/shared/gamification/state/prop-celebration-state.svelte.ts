/**
 * Open/close state for the prop-unlock celebration modal. The manager opens it
 * automatically on the first milestone; the redemption badge opens it on demand.
 */
export const propCelebration = $state<{ isOpen: boolean }>({ isOpen: false });

export function openPropCelebration(): void {
  propCelebration.isOpen = true;
}

export function closePropCelebration(): void {
  propCelebration.isOpen = false;
}
