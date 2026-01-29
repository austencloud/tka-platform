/**
 * Sync Protocol Message Types
 *
 * Defines the message format for peer-to-peer communication.
 * All messages include an HLC timestamp for causal ordering.
 */

import type { HLCTimestamp, PlaybackIntent, PeerInfo, SyncedRoomState, ViewMode } from './sync-types';
import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';

// ============================================================================
// Message Type Discriminator
// ============================================================================

/**
 * All possible message types in the sync protocol.
 */
export type SyncMessageType =
	| 'JOIN' // New peer joining the room
	| 'WELCOME' // Response to JOIN with full state
	| 'INTENT' // New playback intent (play/pause/seek/speed)
	| 'PEER_UPDATE' // Peer info change (view mode, name)
	| 'PEER_LEAVE' // Peer disconnecting gracefully
	| 'HEARTBEAT' // Keep-alive with RTT measurement
	| 'HEARTBEAT_ACK' // Response to heartbeat (for RTT calculation)
	| 'STATE_REQUEST' // Request full state (after reconnect)
	| 'STATE_RESPONSE'; // Full state response

// ============================================================================
// Base Message Structure
// ============================================================================

/**
 * Base structure for all sync messages.
 */
export interface BaseSyncMessage {
	/** Message type discriminator */
	type: SyncMessageType;

	/** HLC timestamp when this message was created */
	hlc: HLCTimestamp;

	/** Node ID of the sender */
	senderId: string;
}

// ============================================================================
// Individual Message Types
// ============================================================================

/**
 * JOIN - Sent when a peer joins the room.
 */
export interface JoinMessage extends BaseSyncMessage {
	type: 'JOIN';
	payload: {
		/** Display name of the joining peer */
		displayName: string;
		/** Initial view mode */
		viewMode: ViewMode;
	};
}

/**
 * WELCOME - Sent by existing peers in response to JOIN.
 * Contains the full room state including sequence data.
 */
export interface WelcomeMessage extends BaseSyncMessage {
	type: 'WELCOME';
	payload: {
		/** Full room state */
		roomState: SerializableSyncedRoomState;
	};
}

/**
 * INTENT - Sent when playback state changes.
 * This is the primary sync message during active use.
 */
export interface IntentMessage extends BaseSyncMessage {
	type: 'INTENT';
	payload: {
		/** The new playback intent */
		intent: PlaybackIntent;
	};
}

/**
 * PEER_UPDATE - Sent when a peer's info changes.
 */
export interface PeerUpdateMessage extends BaseSyncMessage {
	type: 'PEER_UPDATE';
	payload: {
		/** Updated peer info */
		peerInfo: PeerInfo;
	};
}

/**
 * PEER_LEAVE - Sent when a peer disconnects gracefully.
 */
export interface PeerLeaveMessage extends BaseSyncMessage {
	type: 'PEER_LEAVE';
	payload: {
		/** Reason for leaving (optional) */
		reason?: string;
	};
}

/**
 * HEARTBEAT - Sent periodically to detect disconnection and measure RTT.
 */
export interface HeartbeatMessage extends BaseSyncMessage {
	type: 'HEARTBEAT';
	payload: {
		/** Sequence number for RTT calculation */
		seq: number;
		/** Sender's current playback position (for drift detection) */
		currentStep: number;
	};
}

/**
 * HEARTBEAT_ACK - Response to heartbeat.
 */
export interface HeartbeatAckMessage extends BaseSyncMessage {
	type: 'HEARTBEAT_ACK';
	payload: {
		/** Echo back the sequence number */
		seq: number;
		/** Responder's current playback position */
		currentStep: number;
	};
}

/**
 * STATE_REQUEST - Request full state after reconnection.
 */
export interface StateRequestMessage extends BaseSyncMessage {
	type: 'STATE_REQUEST';
	payload: {
		/** Last known HLC (to detect if state changed) */
		lastKnownHlc?: HLCTimestamp;
	};
}

/**
 * STATE_RESPONSE - Full state in response to STATE_REQUEST.
 */
export interface StateResponseMessage extends BaseSyncMessage {
	type: 'STATE_RESPONSE';
	payload: {
		/** Full room state */
		roomState: SerializableSyncedRoomState;
	};
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * Union of all sync message types.
 */
export type SyncMessage =
	| JoinMessage
	| WelcomeMessage
	| IntentMessage
	| PeerUpdateMessage
	| PeerLeaveMessage
	| HeartbeatMessage
	| HeartbeatAckMessage
	| StateRequestMessage
	| StateResponseMessage;

// ============================================================================
// Serialization Types
// ============================================================================

/**
 * Serializable version of PeerInfo (for JSON transport).
 */
export interface SerializablePeerInfo {
	nodeId: string;
	displayName: string;
	viewMode: ViewMode;
	lastSeen: HLCTimestamp;
}

/**
 * Serializable version of SyncedRoomState.
 * Maps are converted to arrays for JSON serialization.
 */
export interface SerializableSyncedRoomState {
	playback: PlaybackIntent;
	sequence: {
		id: string;
		word: string;
		data?: SequenceData;
	};
	peers: SerializablePeerInfo[];
	createdAt: HLCTimestamp;
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Convert SyncedRoomState to serializable form.
 */
export function serializeRoomState(state: SyncedRoomState): SerializableSyncedRoomState {
	return {
		playback: state.playback,
		sequence: state.sequence,
		peers: Array.from(state.peers.values()),
		createdAt: state.createdAt
	};
}

/**
 * Convert serializable form back to SyncedRoomState.
 */
export function deserializeRoomState(serialized: SerializableSyncedRoomState): SyncedRoomState {
	return {
		playback: serialized.playback,
		sequence: serialized.sequence,
		peers: new Map(serialized.peers.map((p) => [p.nodeId, p])),
		createdAt: serialized.createdAt
	};
}

/**
 * Serialize a SyncMessage to JSON string.
 */
export function serializeMessage(message: SyncMessage): string {
	// Handle WELCOME and STATE_RESPONSE specially (they contain room state)
	if (message.type === 'WELCOME' || message.type === 'STATE_RESPONSE') {
		return JSON.stringify(message);
	}
	return JSON.stringify(message);
}

/**
 * Deserialize a JSON string to SyncMessage.
 */
export function deserializeMessage(json: string): SyncMessage {
	const parsed = JSON.parse(json) as SyncMessage;

	// Reconstitute room state if present
	if (parsed.type === 'WELCOME' || parsed.type === 'STATE_RESPONSE') {
		const msg = parsed as WelcomeMessage | StateResponseMessage;
		// The payload.roomState is already in serializable form from JSON.parse
		// We'll let the coordinator handle the Map conversion when it processes the message
	}

	return parsed;
}

// ============================================================================
// Message Factory Functions
// ============================================================================

/**
 * Create a JOIN message.
 */
export function createJoinMessage(
	hlc: HLCTimestamp,
	senderId: string,
	displayName: string,
	viewMode: ViewMode
): JoinMessage {
	return {
		type: 'JOIN',
		hlc,
		senderId,
		payload: { displayName, viewMode }
	};
}

/**
 * Create a WELCOME message.
 */
export function createWelcomeMessage(
	hlc: HLCTimestamp,
	senderId: string,
	roomState: SyncedRoomState
): WelcomeMessage {
	return {
		type: 'WELCOME',
		hlc,
		senderId,
		payload: { roomState: serializeRoomState(roomState) }
	};
}

/**
 * Create an INTENT message.
 */
export function createIntentMessage(
	hlc: HLCTimestamp,
	senderId: string,
	intent: PlaybackIntent
): IntentMessage {
	return {
		type: 'INTENT',
		hlc,
		senderId,
		payload: { intent }
	};
}

/**
 * Create a PEER_UPDATE message.
 */
export function createPeerUpdateMessage(
	hlc: HLCTimestamp,
	senderId: string,
	peerInfo: PeerInfo
): PeerUpdateMessage {
	return {
		type: 'PEER_UPDATE',
		hlc,
		senderId,
		payload: { peerInfo }
	};
}

/**
 * Create a PEER_LEAVE message.
 */
export function createPeerLeaveMessage(
	hlc: HLCTimestamp,
	senderId: string,
	reason?: string
): PeerLeaveMessage {
	return {
		type: 'PEER_LEAVE',
		hlc,
		senderId,
		payload: { reason }
	};
}

/**
 * Create a HEARTBEAT message.
 */
export function createHeartbeatMessage(
	hlc: HLCTimestamp,
	senderId: string,
	seq: number,
	currentStep: number
): HeartbeatMessage {
	return {
		type: 'HEARTBEAT',
		hlc,
		senderId,
		payload: { seq, currentStep }
	};
}

/**
 * Create a HEARTBEAT_ACK message.
 */
export function createHeartbeatAckMessage(
	hlc: HLCTimestamp,
	senderId: string,
	seq: number,
	currentStep: number
): HeartbeatAckMessage {
	return {
		type: 'HEARTBEAT_ACK',
		hlc,
		senderId,
		payload: { seq, currentStep }
	};
}

/**
 * Create a STATE_REQUEST message.
 */
export function createStateRequestMessage(
	hlc: HLCTimestamp,
	senderId: string,
	lastKnownHlc?: HLCTimestamp
): StateRequestMessage {
	return {
		type: 'STATE_REQUEST',
		hlc,
		senderId,
		payload: { lastKnownHlc }
	};
}

/**
 * Create a STATE_RESPONSE message.
 */
export function createStateResponseMessage(
	hlc: HLCTimestamp,
	senderId: string,
	roomState: SyncedRoomState
): StateResponseMessage {
	return {
		type: 'STATE_RESPONSE',
		hlc,
		senderId,
		payload: { roomState: serializeRoomState(roomState) }
	};
}
