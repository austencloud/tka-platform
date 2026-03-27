/**
 * IGallerySessionManager - Manages gallery multiplayer sessions
 *
 * Handles creating, joining, leaving sessions and retrieving session lists.
 * Uses Firebase Realtime Database for real-time session state.
 */

import type {
	GallerySession,
	PublicSessionInfo,
	CreateSessionOptions,
	JoinSessionOptions,
	RemotePlayerData,
	ChatMessage
} from '../../domain/multiplayer-models';

export interface IGallerySessionManager {
	// =========================================================================
	// Session Lifecycle
	// =========================================================================

	/**
	 * Create a new gallery session
	 * @returns The session ID
	 */
	createSession(options: CreateSessionOptions): Promise<string>;

	/**
	 * Join an existing session
	 * @returns true if successfully joined
	 */
	joinSession(options: JoinSessionOptions): Promise<boolean>;

	/**
	 * Leave the current session
	 * Sets up onDisconnect cleanup automatically
	 */
	leaveSession(): Promise<void>;

	/**
	 * Get the current session ID (null if not in a session)
	 */
	getCurrentSessionId(): string | null;

	/**
	 * Check if currently in a session
	 */
	isInSession(): boolean;

	// =========================================================================
	// Session Discovery
	// =========================================================================

	/**
	 * Get list of public sessions available to join
	 */
	getPublicSessions(): Promise<PublicSessionInfo[]>;

	/**
	 * Subscribe to public sessions list (real-time updates)
	 * @returns Unsubscribe function
	 */
	subscribeToPublicSessions(callback: (sessions: PublicSessionInfo[]) => void): () => void;

	/**
	 * Get session details by ID
	 */
	getSession(sessionId: string): Promise<GallerySession | null>;

	/**
	 * Generate a shareable invite link for the current session
	 */
	getInviteLink(): string | null;

	// =========================================================================
	// Player Management
	// =========================================================================

	/**
	 * Get all players in the current session
	 */
	getPlayers(): Promise<RemotePlayerData[]>;

	/**
	 * Subscribe to player updates (joins, leaves, position changes)
	 * @returns Unsubscribe function
	 */
	subscribeToPlayers(callback: (players: RemotePlayerData[]) => void): () => void;

	/**
	 * Kick a player from the session (host only)
	 */
	kickPlayer(userId: string): Promise<void>;

	// =========================================================================
	// Chat
	// =========================================================================

	/**
	 * Send a chat message to the session
	 */
	sendChatMessage(text: string): Promise<void>;

	/**
	 * Subscribe to chat messages
	 * @returns Unsubscribe function
	 */
	subscribeToChatMessages(callback: (messages: ChatMessage[]) => void): () => void;

	// =========================================================================
	// Session Settings (Host Only)
	// =========================================================================

	/**
	 * Update session visibility (host only)
	 */
	setVisibility(visibility: 'public' | 'private' | 'friends'): Promise<void>;

	/**
	 * Update session name (host only)
	 */
	setSessionName(name: string): Promise<void>;

	/**
	 * Check if current user is the host
	 */
	isHost(): boolean;
}

export const IGallerySessionManager = Symbol.for('IGallerySessionManager');
