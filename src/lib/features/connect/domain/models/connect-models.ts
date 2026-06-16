/**
 * Connect Module - Domain Models
 *
 * Core types for collaborative sync sessions, invites, and friendships.
 */

/**
 * Display preference for viewing sequences.
 * Each participant can choose their own preference.
 */
export type DisplayPreference = 'animation' | 'pictograph' | 'split';

/**
 * A sync session where multiple users view the same sequence together.
 */
export interface SyncSession {
	/** Unique session identifier */
	sessionId: string;
	/** Firebase UID of the host */
	hostUserId: string;
	/** Display name of the host */
	hostDisplayName: string;
	/** Profile photo URL of the host */
	hostAvatarUrl?: string;
	/** The sequence being shared */
	sequenceId: string;
	/** Human-readable sequence word (e.g., "AΔUSTY-EΘ-N") */
	sequenceWord: string;
	/** PeerJS room code for WebRTC connection */
	peerJsRoomCode: string;
	/** When the session was created */
	createdAt: number;
	/** Current number of participants */
	participantCount: number;
}

/**
 * A participant in a sync session.
 */
export interface SessionParticipant {
	/** Firebase UID */
	userId: string;
	/** Display name */
	displayName: string;
	/** When they joined the session */
	joinedAt: number;
	/** Their display preference (animation/pictograph/split) */
	displayPreference: DisplayPreference;
	/** Whether they're synced with the group (false = solo practice) */
	isSynced: boolean;
}

/**
 * Invite status lifecycle.
 */
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/**
 * An invitation to join a sync session.
 */
export interface Invite {
	/** Unique invite identifier */
	inviteId: string;
	/** Firebase UID of sender */
	fromUserId: string;
	/** Display name of sender */
	fromDisplayName: string;
	/** Firebase UID of recipient */
	toUserId: string;
	/** The session to join */
	sessionId: string;
	/** The sequence being shared */
	sequenceId: string;
	/** Human-readable sequence word */
	sequenceWord: string;
	/** When the invite was sent */
	createdAt: number;
	/** When the invite expires (auto-decline) */
	expiresAt: number;
	/** Current status */
	status: InviteStatus;
}

/**
 * A friend in the user's friend list.
 * This is a follow model (one-way), not mutual friendship.
 */
export interface Friend {
	/** Firebase UID of the friend */
	userId: string;
	/** Their display name */
	displayName: string;
	/** When they were added */
	addedAt: number;
	/** Optional nickname for this friend */
	nickname?: string;
	/** Profile photo URL if available */
	avatarUrl?: string;
}

/**
 * User presence information.
 */
export interface UserPresence {
	/** Firebase UID */
	userId: string;
	/** Whether they're currently online */
	online: boolean;
	/** Their display name */
	displayName: string;
	/** Last activity timestamp */
	lastSeen: number;
	/** Current session ID if in one */
	currentSessionId?: string;
}

/**
 * Result from searching for users.
 */
export interface UserSearchResult {
	/** Firebase UID */
	userId: string;
	/** Display name */
	displayName: string;
	/** Profile photo URL if available */
	photoURL?: string;
	/** Whether they're currently online */
	isOnline: boolean;
	/** Whether they're already a friend */
	isFriend: boolean;
}

/**
 * Firebase RTDB structure for a session.
 * Stored at /sync-sessions/{sessionId}
 */
export interface SessionFirebaseData {
	hostUserId: string;
	hostDisplayName: string;
	sequenceId: string;
	sequenceWord: string;
	peerJsRoomCode: string;
	createdAt: number;
	participants: Record<string, ParticipantFirebaseData>;
}

/**
 * Firebase RTDB structure for a participant.
 */
export interface ParticipantFirebaseData {
	displayName: string;
	joinedAt: number;
	displayPreference: DisplayPreference;
	isSynced: boolean;
}

/**
 * Firebase RTDB structure for an invite.
 * Stored at /invites/{recipientUserId}/{inviteId}
 */
export interface InviteFirebaseData {
	fromUserId: string;
	fromDisplayName: string;
	sessionId: string;
	sequenceId: string;
	sequenceWord: string;
	createdAt: number;
	expiresAt: number;
	status: InviteStatus;
}

/**
 * Firebase RTDB structure for presence.
 * Stored at /presence/{userId}
 */
export interface PresenceFirebaseData {
	online: boolean;
	displayName: string;
	lastSeen: number;
	currentSessionId?: string;
}

/**
 * Firebase RTDB structure for a friend entry.
 * Stored at /friends/{userId}/{friendId}
 */
export interface FriendFirebaseData {
	displayName: string;
	addedAt: number;
	nickname?: string;
	avatarUrl?: string;
}
