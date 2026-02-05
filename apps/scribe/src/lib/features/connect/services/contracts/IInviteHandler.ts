/**
 * IInviteHandler
 *
 * Sends and receives invitations to join sync sessions.
 * Handles invite lifecycle: send, accept, decline, expire.
 */

import type { Invite } from '../../domain/models/connect-models';

export interface IInviteHandler {
	/** Pending invites received by current user */
	readonly pendingInvites: Invite[];

	/** Number of pending invites */
	readonly pendingCount: number;

	/** Invites sent by current user that are still pending */
	readonly sentInvites: Invite[];

	/**
	 * Send an invite to a user.
	 * @param toUserId - Firebase UID of recipient
	 * @param sessionId - Session to invite them to
	 * @param sequenceId - The sequence being shared
	 * @param sequenceWord - Human-readable sequence word
	 * @returns Invite ID
	 */
	sendInvite(
		toUserId: string,
		sessionId: string,
		sequenceId: string,
		sequenceWord: string
	): Promise<string>;

	/**
	 * Cancel a sent invite (before it's accepted/declined).
	 */
	cancelInvite(inviteId: string): Promise<void>;

	/**
	 * Accept a received invite.
	 * Returns the session ID to join.
	 */
	acceptInvite(inviteId: string): Promise<string>;

	/**
	 * Decline a received invite.
	 */
	declineInvite(inviteId: string): Promise<void>;

	/**
	 * Dismiss an invite without accepting or declining.
	 * Used for expired invites or to clear the UI.
	 */
	dismissInvite(inviteId: string): void;

	/**
	 * Check if we can send an invite to a user.
	 * Returns false if cooldown active or max pending reached.
	 */
	canInvite(toUserId: string): boolean;

	/**
	 * Get reason why we can't invite (for UI feedback).
	 */
	getInviteBlockReason(toUserId: string): 'cooldown' | 'max_pending' | 'already_invited' | null;

	/**
	 * Subscribe to new invite received events.
	 * Fires when someone sends us an invite.
	 */
	onInviteReceived(callback: (invite: Invite) => void): () => void;

	/**
	 * Subscribe to invite response events.
	 * Fires when someone accepts/declines our invite.
	 */
	onInviteResponse(callback: (inviteId: string, accepted: boolean, byUserId: string) => void): () => void;

	/**
	 * Subscribe to invite expiry events.
	 * Fires when a pending invite expires.
	 */
	onInviteExpired(callback: (inviteId: string) => void): () => void;

	/**
	 * Start listening for invites.
	 * Called on app startup for signed-in users.
	 */
	startListening(): void;

	/**
	 * Stop listening for invites.
	 */
	stopListening(): void;

	/**
	 * Clean up all listeners.
	 */
	destroy(): void;
}
