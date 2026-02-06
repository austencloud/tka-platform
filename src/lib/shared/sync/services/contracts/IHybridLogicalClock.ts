/**
 * Hybrid Logical Clock Contract
 *
 * Provides causal ordering of events across distributed nodes
 * without requiring synchronized wall clocks.
 */

import type { HLCTimestamp, SerializedHLC } from '../../domain/sync-types';

/**
 * Interface for Hybrid Logical Clock operations.
 *
 * HLC combines physical time with logical counters to provide:
 * - Timestamps that stay close to wall-clock time
 * - Guaranteed causal ordering (if A caused B, then HLC(A) < HLC(B))
 * - Deterministic tie-breaking for concurrent events
 */
export interface IHybridLogicalClock {
	/**
	 * The node ID for this clock instance.
	 */
	readonly nodeId: string;

	/**
	 * Generate a timestamp for a local event.
	 * Call this before sending a message or recording a state change.
	 */
	now(): HLCTimestamp;

	/**
	 * Update the local clock after receiving a remote timestamp.
	 * Call this when processing an incoming message.
	 *
	 * @param remote - The HLC timestamp from the received message
	 * @returns The updated local timestamp
	 */
	receive(remote: HLCTimestamp): HLCTimestamp;

	/**
	 * Compare two timestamps for ordering.
	 *
	 * @returns -1 if a < b, 0 if equal, 1 if a > b
	 */
	compare(a: HLCTimestamp, b: HLCTimestamp): -1 | 0 | 1;

	/**
	 * Check if timestamp A happened before timestamp B.
	 */
	happenedBefore(a: HLCTimestamp, b: HLCTimestamp): boolean;

	/**
	 * Check if two timestamps are concurrent (neither happened before the other).
	 */
	areConcurrent(a: HLCTimestamp, b: HLCTimestamp): boolean;

	/**
	 * Serialize a timestamp for network transmission.
	 */
	serialize(ts: HLCTimestamp): SerializedHLC;

	/**
	 * Deserialize a timestamp from network format.
	 */
	deserialize(s: SerializedHLC): HLCTimestamp;

	/**
	 * Get the maximum allowed drift from wall clock (in milliseconds).
	 * If the logical clock drifts too far from physical time, we reset.
	 */
	readonly maxDriftMs: number;
}
