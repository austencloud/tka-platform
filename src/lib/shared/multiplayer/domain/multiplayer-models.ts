/**
 * Multiplayer Domain Models - Generic types for 3D multiplayer experiences
 *
 * Extracted from Gallery multiplayer but made destination-agnostic.
 * Destinations (Gallery, Stage, Worlds) can extend these base types
 * with their specific metadata.
 */

// ============================================================================
// Session Types
// ============================================================================

export type SessionVisibility = "public" | "private" | "friends";

/**
 * Generic multiplayer session
 * Destinations can extend with specific metadata (layoutId, sceneId, etc.)
 */
export interface MultiplayerSession<TMetadata = Record<string, unknown>> {
	id: string;
	destinationId: string; // e.g., "gallery", "stage", "worlds"
	hostId: string;
	name: string;
	visibility: SessionVisibility;
	maxPlayers: number;
	createdAt: number; // Unix timestamp
	playerCount: number;
	metadata?: TMetadata; // Destination-specific data
}

export interface SessionMeta<TMetadata = Record<string, unknown>> {
	destinationId: string;
	hostId: string;
	name: string;
	visibility: SessionVisibility;
	maxPlayers: number;
	createdAt: number;
	metadata?: TMetadata;
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

export type PlayerStatus = "active" | "idle" | "away";

/**
 * Data stored in Firebase for each player in a session
 * Destinations can extend with specific data (focusedExhibitId, performerId, etc.)
 */
export interface RemotePlayerData<TMetadata = Record<string, unknown>> {
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	avatarModelId: string;
	position: PlayerPosition;
	rotation: PlayerRotation;
	locomotion: PlayerLocomotion;
	status: PlayerStatus;
	lastUpdate: number; // Unix timestamp
	metadata?: TMetadata; // Destination-specific data
}

/**
 * Local representation of a remote player with interpolation state
 */
export interface RemotePlayer<TMetadata = Record<string, unknown>> {
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

	status: PlayerStatus;
	lastUpdate: number;

	// Interpolation tracking
	lastNetworkUpdate: number;
	interpolationProgress: number;

	// Destination-specific data
	metadata?: TMetadata;
}

/**
 * Local player state that gets broadcast to the session
 */
export interface LocalPlayerState<TMetadata = Record<string, unknown>> {
	position: PlayerPosition;
	rotation: PlayerRotation;
	locomotion: PlayerLocomotion;
	metadata?: TMetadata; // Destination-specific state
}

// ============================================================================
// Chat Types
// ============================================================================

export type ChatMessageType = "message" | "join" | "leave" | "emote";

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

export interface PublicSessionInfo<TMetadata = Record<string, unknown>> {
	id: string;
	destinationId: string;
	name: string;
	hostDisplayName: string;
	playerCount: number;
	maxPlayers: number;
	createdAt: number;
	metadata?: TMetadata;
}

// ============================================================================
// Events
// ============================================================================

export interface PlayerJoinedEvent<TMetadata = Record<string, unknown>> {
	type: "player_joined";
	player: RemotePlayerData<TMetadata>;
}

export interface PlayerLeftEvent {
	type: "player_left";
	userId: string;
}

export interface PlayerUpdatedEvent<TMetadata = Record<string, unknown>> {
	type: "player_updated";
	player: RemotePlayerData<TMetadata>;
}

export type MultiplayerEvent<TMetadata = Record<string, unknown>> =
	| PlayerJoinedEvent<TMetadata>
	| PlayerLeftEvent
	| PlayerUpdatedEvent<TMetadata>;

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

	/** Distance threshold for "nearby" players */
	NEARBY_DISTANCE: 500,

	/** Firebase path templates (use {destination} placeholder) */
	PATHS: {
		SESSIONS: "multiplayer-sessions/{destination}",
		META: "meta",
		PLAYERS: "players",
		CHAT: "chat",
	},
} as const;

// ============================================================================
// Utility Types
// ============================================================================

export interface CreateSessionOptions<TMetadata = Record<string, unknown>> {
	destinationId: string;
	name: string;
	visibility: SessionVisibility;
	maxPlayers?: number;
	metadata?: TMetadata; // Destination-specific setup
}

export interface JoinSessionOptions {
	sessionId: string;
	destinationId: string;
	displayName: string;
	avatarUrl: string | null;
	avatarModelId: string;
}
