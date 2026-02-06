/**
 * Core Types for Multi-Device Synchronization
 *
 * These types define the fundamental data structures for the sync protocol.
 * The design is based on:
 * - Hybrid Logical Clocks (HLC) for causal ordering without clock drift
 * - CRDT principles for conflict-free state merging
 * - Deterministic playback equations for frame-accurate sync
 */

import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';

// ============================================================================
// Hybrid Logical Clock Types
// ============================================================================

/**
 * A Hybrid Logical Clock timestamp.
 *
 * HLC combines wall-clock time with a logical counter to provide:
 * - Timestamps that stay close to real time (humans can read them)
 * - Guaranteed causal ordering (no "future" overwrites "past")
 * - Graceful handling of clock drift between devices
 *
 * @see https://cse.buffalo.edu/tech-reports/2014-04.pdf
 */
export interface HLCTimestamp {
	/** Wall clock time in milliseconds (best effort) */
	wallTime: number;

	/** Logical counter for same-millisecond disambiguation */
	logical: number;

	/** Node ID for deterministic tie-breaking of truly concurrent events */
	nodeId: string;
}

/**
 * Serialized form of HLCTimestamp for network transmission.
 * Format: "{wallTime}:{logical}:{nodeId}"
 */
export type SerializedHLC = string;

// ============================================================================
// Playback Intent Types
// ============================================================================

/**
 * A playback intent - the atomic unit of synchronization.
 *
 * Instead of syncing "currentStep = 5" continuously, we sync the equation:
 * currentStep = anchorStep + ((now - anchorWallTime) / beatDuration) * speed
 *
 * Each device locally calculates its position from this intent.
 * This eliminates the need for constant sync messages during playback.
 */
export interface PlaybackIntent {
	/** Unique ID for this intent (for deduplication) */
	intentId: string;

	/** Is playback active? */
	playing: boolean;

	/** The step we were at when this intent was created */
	anchorStep: number;

	/** HLC timestamp when this intent was created (for CRDT merging) */
	anchorHlc: HLCTimestamp;

	/** Wall time (ms) at anchor - for local position calculation */
	anchorWallTime: number;

	/** Playback speed multiplier (1.0 = normal) */
	speed: number;

	/** Should playback loop when reaching the end? */
	loop: boolean;

	/** Total steps in the sequence (for loop calculation and bounds) */
	totalSteps: number;
}

// ============================================================================
// Room State Types
// ============================================================================

/**
 * Information about a connected peer.
 */
export interface PeerInfo {
	/** Unique node ID (same as HLC nodeId) */
	nodeId: string;

	/** Display name for UI */
	displayName: string;

	/** What this peer is currently viewing */
	viewMode: ViewMode;

	/** Last time we heard from this peer */
	lastSeen: HLCTimestamp;
}

/**
 * View modes for displaying the sequence.
 * Each device chooses independently - this is NOT synced.
 */
export type ViewMode = 'animation' | 'grid' | 'both';

/**
 * Sequence reference with optional embedded data.
 * When a peer joins, they receive the full sequence data to avoid Firebase fetch latency.
 */
export interface SyncedSequence {
	/** Sequence document ID */
	id: string;

	/** Human-readable word (e.g., "CAKE") */
	word: string;

	/** Full sequence data - included in WELCOME messages for instant load */
	data?: SequenceData;
}

/**
 * The complete synced state for a room.
 * This is the authoritative state that all peers converge to via CRDT merging.
 */
export interface SyncedRoomState {
	/** Current playback intent (CRDT: Last-Writer-Wins by HLC) */
	playback: PlaybackIntent;

	/** Sequence being viewed */
	sequence: SyncedSequence;

	/** Connected peers (for UI display) */
	peers: Map<string, PeerInfo>;

	/** Room creation timestamp (for debugging/analytics) */
	createdAt: HLCTimestamp;
}

// ============================================================================
// Connection State Types
// ============================================================================

/**
 * Connection quality levels based on round-trip time.
 */
export type ConnectionQuality = 'excellent' | 'good' | 'degraded' | 'poor' | 'disconnected';

/**
 * Thresholds for connection quality (RTT in milliseconds).
 */
export const CONNECTION_QUALITY_THRESHOLDS: Record<
	Exclude<ConnectionQuality, 'disconnected'>,
	number
> = {
	excellent: 50,
	good: 150,
	degraded: 500,
	poor: 2000
};

/**
 * Extended peer connection state with quality metrics.
 */
export interface SyncConnectionState {
	/** Basic connection status */
	status: SyncConnectionStatus;

	/** Room code (if in a room) */
	roomCode: string | null;

	/** This device's node ID */
	nodeId: string | null;

	/** Number of connected peers */
	peerCount: number;

	/** Connection quality based on RTT */
	quality: ConnectionQuality;

	/** Last measured RTT in milliseconds */
	lastRttMs: number | null;

	/** Error message (if status is 'error') */
	errorMessage: string | null;
}

/**
 * Possible connection statuses.
 */
export type SyncConnectionStatus =
	| 'disconnected'
	| 'creating-room'
	| 'waiting-for-peer'
	| 'joining-room'
	| 'connected'
	| 'reconnecting'
	| 'error';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for the sync system.
 */
export interface SyncConfig {
	/** Heartbeat interval in milliseconds */
	heartbeatIntervalMs: number;

	/** Time before considering a peer dead */
	heartbeatTimeoutMs: number;

	/** Number of reconnection attempts */
	reconnectAttempts: number;

	/** Delay between reconnection attempts */
	reconnectDelayMs: number;

	/** Maximum drift (in steps) before snapping instead of easing */
	maxDriftBeforeSnap: number;

	/** Maximum correction per frame (in steps) for smooth drift correction */
	maxCorrectionPerFrame: number;

	/** Beat duration in milliseconds (for position calculation) */
	beatDurationMs: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
	heartbeatIntervalMs: 5000,
	heartbeatTimeoutMs: 15000,
	reconnectAttempts: 3,
	reconnectDelayMs: 2000,
	maxDriftBeforeSnap: 1.0,
	maxCorrectionPerFrame: 0.1,
	beatDurationMs: 1000 // Will be overridden by actual sequence BPM
};

// ============================================================================
// Adaptive Heartbeat Configuration (Mobile Optimization)
// ============================================================================

/**
 * Configuration for adaptive heartbeat timing.
 * Adjusts heartbeat frequency based on connection quality and battery state.
 */
export interface AdaptiveHeartbeatConfig {
	/** Minimum heartbeat interval in ms (when connection is unstable) */
	minIntervalMs: number;

	/** Maximum heartbeat interval in ms (when connection is stable, for battery saving) */
	maxIntervalMs: number;

	/** Default/starting interval in ms */
	defaultIntervalMs: number;

	/** Interval for verifying connection quality (fast heartbeats) */
	verifyIntervalMs: number;

	/** How many consecutive good heartbeats before increasing interval */
	stabilityThreshold: number;

	/** How many consecutive missed heartbeats before decreasing interval */
	degradationThreshold: number;

	/** Multiplier for interval increase (e.g., 1.5 = 50% longer) */
	increaseMultiplier: number;

	/** Multiplier for interval decrease (e.g., 0.5 = 50% shorter) */
	decreaseMultiplier: number;

	/** Whether to reduce heartbeat frequency when battery is low */
	batteryAware: boolean;

	/** Battery threshold (0-1) below which to use battery-saving mode */
	lowBatteryThreshold: number;

	/** Interval multiplier when battery is low */
	lowBatteryMultiplier: number;
}

/**
 * Default adaptive heartbeat configuration.
 */
export const DEFAULT_ADAPTIVE_HEARTBEAT_CONFIG: AdaptiveHeartbeatConfig = {
	minIntervalMs: 2000,
	maxIntervalMs: 30000,
	defaultIntervalMs: 5000,
	verifyIntervalMs: 1000,
	stabilityThreshold: 5,
	degradationThreshold: 2,
	increaseMultiplier: 1.5,
	decreaseMultiplier: 0.5,
	batteryAware: true,
	lowBatteryThreshold: 0.2,
	lowBatteryMultiplier: 2.0
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Generate a unique node ID for this device.
 * Uses crypto.randomUUID if available, falls back to timestamp + random.
 */
export function generateNodeId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID().slice(0, 8);
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Create an initial HLC timestamp.
 */
export function createInitialHLC(nodeId: string): HLCTimestamp {
	return {
		wallTime: Date.now(),
		logical: 0,
		nodeId
	};
}

/**
 * Create an initial playback intent (paused at step 0).
 */
export function createInitialPlaybackIntent(nodeId: string, totalSteps: number): PlaybackIntent {
	const hlc = createInitialHLC(nodeId);
	return {
		intentId: `${nodeId}-${hlc.wallTime}-${hlc.logical}`,
		playing: false,
		anchorStep: 0,
		anchorHlc: hlc,
		anchorWallTime: Date.now(),
		speed: 1.0,
		loop: true,
		totalSteps
	};
}

/**
 * Create an initial room state.
 */
export function createInitialRoomState(
	nodeId: string,
	sequence: SyncedSequence,
	totalSteps: number
): SyncedRoomState {
	return {
		playback: createInitialPlaybackIntent(nodeId, totalSteps),
		sequence,
		peers: new Map(),
		createdAt: createInitialHLC(nodeId)
	};
}

/**
 * Create initial connection state.
 */
export function createInitialConnectionState(): SyncConnectionState {
	return {
		status: 'disconnected',
		roomCode: null,
		nodeId: null,
		peerCount: 0,
		quality: 'disconnected',
		lastRttMs: null,
		errorMessage: null
	};
}
