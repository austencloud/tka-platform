/**
 * LAN Sync Domain Models
 *
 * Types for peer-to-peer playback synchronization between devices on the same network.
 */

/** Possible states for the peer connection */
export type PeerConnectionStatus =
	| 'disconnected'
	| 'creating-room'
	| 'waiting-for-peer'
	| 'joining-room'
	| 'connected'
	| 'reconnecting'
	| 'error';

/** State of the peer connection */
export interface PeerConnectionState {
	status: PeerConnectionStatus;
	roomCode: string | null;
	peerId: string | null;
	connectedPeerCount: number;
	errorMessage: string | null;
	isHost: boolean;
}

/** Playback state that gets synced between devices */
export interface SyncedPlaybackState {
	isPlaying: boolean;
	currentStep: number;
	speed: number;
	shouldLoop: boolean;
	sequenceId: string | null;
	timestamp: number; // For conflict resolution (last-write-wins)
}

/** Message types for the sync protocol */
export type SyncMessageType =
	| 'REQUEST_FULL_STATE'
	| 'FULL_STATE'
	| 'STATE_UPDATE'
	| 'HEARTBEAT'
	| 'SEQUENCE_MISMATCH_WARNING';

/** Base structure for all sync messages */
export interface BaseSyncMessage {
	type: SyncMessageType;
	timestamp: number;
	senderId: string;
}

/** Request full state from host (sent by joining peer) */
export interface RequestFullStateMessage extends BaseSyncMessage {
	type: 'REQUEST_FULL_STATE';
}

/** Full state response (sent by host to joining peer) */
export interface FullStateMessage extends BaseSyncMessage {
	type: 'FULL_STATE';
	state: SyncedPlaybackState;
	/** The actual sequence data (so the peer doesn't need to load it from a database) */
	sequenceData?: Record<string, unknown>;
}

/** Incremental state update (sent by either peer on playback action) */
export interface StateUpdateMessage extends BaseSyncMessage {
	type: 'STATE_UPDATE';
	state: Partial<SyncedPlaybackState>;
}

/** Heartbeat to detect disconnection */
export interface HeartbeatMessage extends BaseSyncMessage {
	type: 'HEARTBEAT';
}

/** Warning when peers have different sequences loaded */
export interface SequenceMismatchWarningMessage extends BaseSyncMessage {
	type: 'SEQUENCE_MISMATCH_WARNING';
	peerSequenceId: string | null;
}

/** Union of all sync message types */
export type SyncMessage =
	| RequestFullStateMessage
	| FullStateMessage
	| StateUpdateMessage
	| HeartbeatMessage
	| SequenceMismatchWarningMessage;

/** Configuration for the sync system */
export interface LanSyncConfig {
	heartbeatIntervalMs: number; // How often to send heartbeats (default: 5000)
	heartbeatTimeoutMs: number; // How long before considering peer dead (default: 15000)
	reconnectAttempts: number; // How many times to attempt reconnection (default: 3)
	reconnectDelayMs: number; // Delay between reconnection attempts (default: 2000)
}

/** Default configuration values */
export const DEFAULT_LAN_SYNC_CONFIG: LanSyncConfig = {
	heartbeatIntervalMs: 5000,
	heartbeatTimeoutMs: 15000,
	reconnectAttempts: 3,
	reconnectDelayMs: 2000
};

/** Generate a random 4-character room code */
export function generateRoomCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters (I, O, 0, 1)
	let code = '';
	for (let i = 0; i < 4; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return `TKA-${code}`;
}

/** Create initial connection state */
export function createInitialConnectionState(): PeerConnectionState {
	return {
		status: 'disconnected',
		roomCode: null,
		peerId: null,
		connectedPeerCount: 0,
		errorMessage: null,
		isHost: false
	};
}

/** Create initial playback state */
export function createInitialPlaybackState(): SyncedPlaybackState {
	return {
		isPlaying: false,
		currentStep: 0,
		speed: 1,
		shouldLoop: true,
		sequenceId: null,
		timestamp: Date.now()
	};
}

/**
 * Sync room data stored in Firebase RTDB for discovery.
 * Path: /sync-rooms/{uniqueRoomId}
 * uniqueRoomId = `${userId}_${sequenceId}`
 */
export interface SyncRoom {
	/** Firebase auth UID of the host */
	hostUserId: string;
	/** Display name of the host */
	hostDisplayName: string;
	/** Unique session ID for this browser tab (used to filter out own device, not own user) */
	hostSessionId: string;
	/** The sequence being shared */
	sequenceId: string;
	/** Human-readable sequence word for display (e.g., "AΔUSTY-EΘ-N") */
	sequenceWord: string;
	/** Timestamp when room was created */
	createdAt: number;
	/** PeerJS room code derived from sequenceId */
	peerJsRoomCode: string;
}

/**
 * Unique identifier for this browser tab/session.
 * Used to distinguish "my device" from "my other device on the same account."
 * Discovery hides rooms from this session but shows rooms from other sessions,
 * even if they belong to the same Firebase user.
 */
function generateSessionId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	// Fallback for non-secure contexts (e.g. HTTP over LAN IP for mobile dev)
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export const localSyncSessionId = generateSessionId();

/** Sync room with its Firebase key */
export interface SyncRoomWithId extends SyncRoom {
	/** The room ID (key in Firebase) */
	roomId: string;
}
