/**
 * ISessionManager
 *
 * Manages sync session lifecycle: create, join, leave.
 * Handles participant tracking and session discovery.
 */

import type {
	SyncSession,
	SessionParticipant,
	DisplayPreference
} from '../../domain/models/connect-models';

export interface ISessionManager {
	/** Current session (if in one) */
	readonly currentSession: SyncSession | null;

	/** Whether currently in a session */
	readonly isInSession: boolean;

	/** Whether current user is the host */
	readonly isHost: boolean;

	/** Participants in current session */
	readonly participants: SessionParticipant[];

	/**
	 * Create a new sync session and become the host.
	 * @returns Session ID
	 */
	createSession(sequenceId: string, sequenceWord: string): Promise<string>;

	/**
	 * Join an existing session.
	 * @param sessionId - The session to join
	 * @param displayPreference - Initial display preference
	 */
	joinSession(sessionId: string, displayPreference?: DisplayPreference): Promise<void>;

	/**
	 * Leave the current session.
	 * If host, session is closed for all participants.
	 */
	leaveSession(): Promise<void>;

	/**
	 * Update own display preference in current session.
	 */
	updateDisplayPreference(preference: DisplayPreference): Promise<void>;

	/**
	 * Toggle between synced and solo practice mode.
	 * @returns New sync state (true = synced, false = solo)
	 */
	toggleSyncMode(): Promise<boolean>;

	/**
	 * Get nearby sessions (sessions from other users).
	 * Uses Firebase to browse active sessions.
	 */
	getNearbySessions(): SyncSession[];

	/**
	 * Subscribe to changes in nearby sessions.
	 * Returns unsubscribe function.
	 */
	onNearbySessionsChange(callback: (sessions: SyncSession[]) => void): () => void;

	/**
	 * Subscribe to participant join events.
	 */
	onParticipantJoin(callback: (participant: SessionParticipant) => void): () => void;

	/**
	 * Subscribe to participant leave events.
	 */
	onParticipantLeave(callback: (userId: string) => void): () => void;

	/**
	 * Subscribe to session closed event (host left or disconnected).
	 */
	onSessionClosed(callback: (reason: 'host_left' | 'timeout' | 'error') => void): () => void;

	/**
	 * Get a specific session by ID without joining.
	 */
	getSession(sessionId: string): Promise<SyncSession | null>;

	/**
	 * Clean up all listeners and leave any active session.
	 */
	destroy(): void;
}
