/**
 * Multiplayer Virtual Museum - Domain Models
 *
 * Defines types for real-time gallery sessions where multiple users
 * can browse the 3D museum together.
 */

// ============================================================================
// Session Types
// ============================================================================

export type SessionVisibility = 'public' | 'private' | 'friends';

export interface GallerySession {
	id: string;
	hostId: string;
	name: string;
	visibility: SessionVisibility;
	layoutId: string;
	maxPlayers: number;
	createdAt: number; // Unix timestamp
	playerCount: number;
}

export interface GallerySessionMeta {
	hostId: string;
	name: string;
	visibility: SessionVisibility;
	layoutId: string;
	maxPlayers: number;
	createdAt: number;
}

// ============================================================================
// Player Types
// ============================================================================

export interface PlayerPosition {
	x: number;
	y: number;
	z: number;
}

export interface PlayerRotation {
	yaw: number; // Horizontal rotation (radians)
	pitch: number; // Vertical look angle (radians)
}

export interface PlayerLocomotion {
	isMoving: boolean;
	moveDirection: number; // Angle in radians (0 = forward, PI/2 = right)
	moveSpeed: number; // 0-1 normalized speed
}

export type PlayerStatus = 'active' | 'idle' | 'away';

/**
 * Data stored in Firebase for each player in a session
 */
export interface RemotePlayerData {
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	avatarModelId: string;
	position: PlayerPosition;
	rotation: PlayerRotation;
	locomotion: PlayerLocomotion;
	focusedExhibitId: string | null;
	status: PlayerStatus;
	lastUpdate: number; // Unix timestamp
}

/**
 * Local representation of a remote player with interpolation state
 */
export interface RemotePlayer {
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	avatarModelId: string;

	// Current interpolated state (what we render)
	position: PlayerPosition;
	rotation: PlayerRotation;
	locomotion: PlayerLocomotion;

	// Target state from network (what we interpolate towards)
	targetPosition: PlayerPosition;
	targetRotation: PlayerRotation;

	focusedExhibitId: string | null;
	status: PlayerStatus;
	lastUpdate: number;

	// Interpolation tracking
	lastNetworkUpdate: number;
	interpolationProgress: number;
}

/**
 * Local player state that gets broadcast to the session
 */
export interface LocalPlayerState {
	position: PlayerPosition;
	rotation: PlayerRotation;
	locomotion: PlayerLocomotion;
	focusedExhibitId: string | null;
}

// ============================================================================
// Chat Types
// ============================================================================

export type ChatMessageType = 'message' | 'join' | 'leave' | 'emote';

export interface ChatMessage {
	id: string;
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	text: string;
	type: ChatMessageType;
	timestamp: number;
}

// ============================================================================
// Session List Types
// ============================================================================

export interface PublicSessionInfo {
	id: string;
	name: string;
	hostDisplayName: string;
	playerCount: number;
	maxPlayers: number;
	layoutId: string;
	createdAt: number;
}

// ============================================================================
// Events
// ============================================================================

export interface PlayerJoinedEvent {
	type: 'player_joined';
	player: RemotePlayerData;
}

export interface PlayerLeftEvent {
	type: 'player_left';
	userId: string;
}

export interface PlayerUpdatedEvent {
	type: 'player_updated';
	player: RemotePlayerData;
}

export type MultiplayerEvent = PlayerJoinedEvent | PlayerLeftEvent | PlayerUpdatedEvent;

// ============================================================================
// Configuration
// ============================================================================

export const MULTIPLAYER_CONFIG = {
	/** Maximum players per session */
	MAX_PLAYERS: 25,

	/** How often to broadcast position updates (ms) */
	POSITION_BROADCAST_INTERVAL: 100,

	/** How often to check for stale players (ms) */
	STALE_CHECK_INTERVAL: 5000,

	/** Mark player as stale after this many ms without updates */
	STALE_THRESHOLD: 10000,

	/** Interpolation speed factor (higher = snappier, lower = smoother) */
	INTERPOLATION_SPEED: 10,

	/** Distance threshold for "nearby" players (meters) */
	NEARBY_DISTANCE: 10,

	/** Firebase paths */
	PATHS: {
		SESSIONS: 'gallery-sessions',
		META: 'meta',
		PLAYERS: 'players',
		CHAT: 'chat'
	}
} as const;

// ============================================================================
// Utility Types
// ============================================================================

export interface CreateSessionOptions {
	name: string;
	visibility: SessionVisibility;
	layoutId: string;
	maxPlayers?: number;
}

export interface JoinSessionOptions {
	sessionId: string;
	displayName: string;
	avatarUrl: string | null;
	avatarModelId: string;
}
