/**
 * IConnectOrchestrator
 *
 * High-level coordinator for Connect module functionality.
 * Composes PresenceTracker, SessionManager, InviteHandler, and LanSyncCoordinator.
 */

import type {
	SyncSession,
	SessionParticipant,
	Invite,
	Friend,
	DisplayPreference,
	UserSearchResult
} from '../../domain/models/connect-models';

export interface IConnectOrchestrator {
	// ==================== State ====================

	/** Current user's ID */
	readonly currentUserId: string | null;

	/** Whether currently in a sync session */
	readonly isInSession: boolean;

	/** Current session (if in one) */
	readonly currentSession: SyncSession | null;

	/** Whether current user is the host */
	readonly isHost: boolean;

	/** Participants in current session */
	readonly participants: SessionParticipant[];

	/** Whether in solo practice mode (not synced with group) */
	readonly isSoloMode: boolean;

	/** Current display preference */
	readonly displayPreference: DisplayPreference;

	/** Number of pending invites */
	readonly pendingInviteCount: number;

	/** Nearby sessions available to join */
	readonly nearbySessions: SyncSession[];

	/** Online friends */
	readonly onlineFriends: Friend[];

	// ==================== Session Actions ====================

	/**
	 * Start sharing a sequence (create session and become host).
	 * Also goes online if not already.
	 */
	startSharing(sequenceId: string, sequenceWord: string): Promise<string>;

	/**
	 * Join a nearby session.
	 */
	joinSession(sessionId: string): Promise<void>;

	/**
	 * Join a session from an invite (accepts invite and joins).
	 */
	joinFromInvite(inviteId: string): Promise<void>;

	/**
	 * Leave current session.
	 */
	leaveSession(): Promise<void>;

	/**
	 * Toggle between synced and solo practice mode.
	 */
	toggleSoloMode(): Promise<void>;

	/**
	 * Update display preference.
	 */
	setDisplayPreference(preference: DisplayPreference): Promise<void>;

	// ==================== Invite Actions ====================

	/**
	 * Invite a user to current session.
	 * Must be in a session as host or participant.
	 */
	inviteUser(userId: string): Promise<void>;

	/**
	 * Invite a friend by their Friend record.
	 */
	inviteFriend(friend: Friend): Promise<void>;

	/**
	 * Accept a pending invite.
	 */
	acceptInvite(inviteId: string): Promise<void>;

	/**
	 * Decline a pending invite.
	 */
	declineInvite(inviteId: string): Promise<void>;

	/**
	 * Get pending invites.
	 */
	getPendingInvites(): Invite[];

	// ==================== Friend Actions ====================

	/**
	 * Search for users to invite or add as friend.
	 */
	searchUsers(query: string): Promise<UserSearchResult[]>;

	/**
	 * Add a user as friend.
	 */
	addFriend(userId: string, displayName: string): Promise<void>;

	/**
	 * Remove a friend.
	 */
	removeFriend(userId: string): Promise<void>;

	/**
	 * Get all friends.
	 */
	getFriends(): Friend[];

	// ==================== Presence ====================

	/**
	 * Go online (start presence tracking).
	 */
	goOnline(): Promise<void>;

	/**
	 * Go offline (stop presence tracking).
	 */
	goOffline(): Promise<void>;

	// ==================== Events ====================

	/**
	 * Subscribe to new invite notifications.
	 */
	onInviteReceived(callback: (invite: Invite) => void): () => void;

	/**
	 * Subscribe to session closed events.
	 */
	onSessionClosed(callback: (reason: string) => void): () => void;

	/**
	 * Subscribe to participant changes.
	 */
	onParticipantsChanged(callback: (participants: SessionParticipant[]) => void): () => void;

	// ==================== Lifecycle ====================

	/**
	 * Initialize the orchestrator.
	 * Call once when Connect module mounts.
	 */
	initialize(): Promise<void>;

	/**
	 * Clean up all resources.
	 */
	destroy(): void;
}
