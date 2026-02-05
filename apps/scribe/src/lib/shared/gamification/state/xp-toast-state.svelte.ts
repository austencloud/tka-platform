/**
 * XP Toast State - Svelte 5 Runes
 *
 * Lightweight reactive state for quick XP gain notifications.
 * Separate from achievement notifications for faster, non-blocking display.
 */

export interface XPToast {
  id: string;
  amount: number;
  reason?: string;
  timestamp: number;
}

// Reactive toast queue
export const xpToastQueue = $state<XPToast[]>([]);

/**
 * Add a new XP toast to the queue
 */
export function addXPToast(amount: number, reason?: string): void {
  const toast: XPToast = {
    id: `xp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    amount,
    reason,
    timestamp: Date.now(),
  };
  xpToastQueue.push(toast);
}

/**
 * Remove a specific toast by ID
 */
export function removeXPToast(id: string): void {
  const index = xpToastQueue.findIndex((t) => t.id === id);
  if (index !== -1) {
    xpToastQueue.splice(index, 1);
  }
}

/**
 * Clear all XP toasts
 */
export function clearXPToasts(): void {
  xpToastQueue.length = 0;
}
