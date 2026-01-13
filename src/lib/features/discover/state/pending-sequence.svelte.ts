/**
 * Pending Sequence Navigation State
 *
 * Handles cross-module navigation to view a specific sequence.
 * Used when navigating from inbox messages to Discover.
 */

let pendingSequenceId = $state<string | null>(null);

/**
 * Set a sequence ID to be viewed when Discover loads
 */
export function setPendingSequenceView(sequenceId: string): void {
  pendingSequenceId = sequenceId;
}

/**
 * Get the pending sequence ID (if any) and clear it
 */
export function consumePendingSequenceView(): string | null {
  const id = pendingSequenceId;
  pendingSequenceId = null;
  return id;
}

/**
 * Check if there's a pending sequence without consuming it
 */
export function hasPendingSequenceView(): boolean {
  return pendingSequenceId !== null;
}
