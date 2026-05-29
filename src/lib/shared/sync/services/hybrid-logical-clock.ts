/**
 * Hybrid Logical Clock Implementation
 *
 * Provides causal ordering of events across distributed devices without
 * requiring synchronized wall clocks. Based on Kulkarni et al.'s HLC algorithm.
 *
 * @see https://cse.buffalo.edu/tech-reports/2014-04.pdf
 */

import type { HLCTimestamp, SerializedHLC } from '../domain/sync-types';
/**
 * Default maximum allowed drift from wall clock time.
 * If the logical clock drifts more than this, we reset to prevent unbounded drift.
 */
const DEFAULT_MAX_DRIFT_MS = 60000;

/**
 * HybridLogicalClock provides timestamps that:
 * - Stay close to wall-clock time (humans can read them)
 * - Guarantee causal ordering (if A caused B, then HLC(A) < HLC(B))
 * - Handle clock drift gracefully between devices
 * - Provide deterministic tie-breaking for truly concurrent events
 */
export class HybridLogicalClock {
	readonly nodeId: string;
	readonly maxDriftMs: number;

	private lastPhysical: number;
	private lastLogical: number;

	/**
	 * Create a new Hybrid Logical Clock instance.
	 *
	 * @param nodeId - Unique identifier for this node/device
	 * @param maxDriftMs - Maximum allowed drift from physical time before reset (default: 60000ms)
	 */
	constructor(nodeId: string, maxDriftMs: number = DEFAULT_MAX_DRIFT_MS) {
		this.nodeId = nodeId;
		this.maxDriftMs = maxDriftMs;
		this.lastPhysical = 0;
		this.lastLogical = 0;
	}

	/**
	 * Generate a timestamp for a local event.
	 *
	 * Algorithm:
	 * 1. Get current physical time
	 * 2. If physical time advanced, use it and reset logical counter
	 * 3. Otherwise, increment logical counter
	 * 4. Apply drift protection if needed
	 *
	 * @returns A new HLC timestamp for this event
	 */
	now(): HLCTimestamp {
		const physical = Date.now();

		if (physical > this.lastPhysical) {
			// Physical time advanced - use it and reset logical
			this.lastPhysical = physical;
			this.lastLogical = 0;
		} else {
			// Same or earlier physical time - increment logical
			this.lastLogical++;
		}

		// Drift protection: if logical clock has drifted too far from physical time,
		// reset to prevent unbounded drift
		this.applyDriftProtection(physical);

		return {
			wallTime: this.lastPhysical,
			logical: this.lastLogical,
			nodeId: this.nodeId
		};
	}

	/**
	 * Update the local clock after receiving a remote timestamp.
	 *
	 * This ensures causal ordering: if we receive a message with timestamp T,
	 * our next timestamp will be > T.
	 *
	 * Algorithm:
	 * 1. Get current physical time
	 * 2. If physical > both lastPhysical and remote.wallTime: use physical, reset logical
	 * 3. If lastPhysical == remote.wallTime: use max logical + 1
	 * 4. If lastPhysical > remote.wallTime: increment logical
	 * 5. Otherwise (remote.wallTime > lastPhysical): adopt remote's wallTime, logical + 1
	 *
	 * @param remote - The HLC timestamp from the received message
	 * @returns The updated local timestamp
	 */
	receive(remote: HLCTimestamp): HLCTimestamp {
		const physical = Date.now();

		if (physical > this.lastPhysical && physical > remote.wallTime) {
			// Physical time is ahead of everything - use it
			this.lastPhysical = physical;
			this.lastLogical = 0;
		} else if (this.lastPhysical === remote.wallTime) {
			// Same wall time - take max logical + 1
			this.lastLogical = Math.max(this.lastLogical, remote.logical) + 1;
		} else if (this.lastPhysical > remote.wallTime) {
			// Our clock is ahead - just increment logical
			this.lastLogical++;
		} else {
			// Remote clock is ahead - adopt remote's time
			this.lastPhysical = remote.wallTime;
			this.lastLogical = remote.logical + 1;
		}

		// Drift protection
		this.applyDriftProtection(physical);

		return {
			wallTime: this.lastPhysical,
			logical: this.lastLogical,
			nodeId: this.nodeId
		};
	}

	/**
	 * Compare two timestamps for ordering.
	 *
	 * Ordering is deterministic:
	 * 1. First by wall time
	 * 2. Then by logical counter
	 * 3. Finally by node ID (lexicographic) for true ties
	 *
	 * @param a - First timestamp
	 * @param b - Second timestamp
	 * @returns -1 if a < b, 0 if equal, 1 if a > b
	 */
	compare(a: HLCTimestamp, b: HLCTimestamp): -1 | 0 | 1 {
		// Compare wall time first
		if (a.wallTime !== b.wallTime) {
			return a.wallTime < b.wallTime ? -1 : 1;
		}

		// Same wall time - compare logical counter
		if (a.logical !== b.logical) {
			return a.logical < b.logical ? -1 : 1;
		}

		// Same logical counter - compare node IDs for deterministic tie-breaking
		const nodeComparison = a.nodeId.localeCompare(b.nodeId);
		if (nodeComparison < 0) return -1;
		if (nodeComparison > 0) return 1;
		return 0;
	}

	/**
	 * Check if timestamp A happened before timestamp B.
	 *
	 * @param a - First timestamp
	 * @param b - Second timestamp
	 * @returns true if a < b
	 */
	happenedBefore(a: HLCTimestamp, b: HLCTimestamp): boolean {
		return this.compare(a, b) === -1;
	}

	/**
	 * Check if two timestamps are concurrent.
	 *
	 * In HLC, two timestamps are concurrent if they are from different nodes
	 * and neither causally happened before the other. However, our compare()
	 * function provides total ordering, so "concurrent" here means they have
	 * the same wall time and logical counter but different node IDs.
	 *
	 * @param a - First timestamp
	 * @param b - Second timestamp
	 * @returns true if the timestamps are concurrent
	 */
	areConcurrent(a: HLCTimestamp, b: HLCTimestamp): boolean {
		return a.wallTime === b.wallTime && a.logical === b.logical && a.nodeId !== b.nodeId;
	}

	/**
	 * Serialize a timestamp for network transmission.
	 *
	 * Format: "{wallTime}:{logical}:{nodeId}"
	 *
	 * @param ts - Timestamp to serialize
	 * @returns Colon-separated string representation
	 */
	serialize(ts: HLCTimestamp): SerializedHLC {
		return `${ts.wallTime}:${ts.logical}:${ts.nodeId}`;
	}

	/**
	 * Deserialize a timestamp from network format.
	 *
	 * @param s - Serialized timestamp string
	 * @returns Parsed HLC timestamp
	 * @throws Error if the format is invalid
	 */
	deserialize(s: SerializedHLC): HLCTimestamp {
		const parts = s.split(':');

		if (parts.length < 3) {
			throw new Error(`Invalid HLC format: expected "wallTime:logical:nodeId", got "${s}"`);
		}

		const wallTime = parseInt(parts[0]!, 10);
		const logical = parseInt(parts[1]!, 10);
		// Node ID may contain colons, so join remaining parts
		const nodeId = parts.slice(2).join(':');

		if (isNaN(wallTime) || isNaN(logical)) {
			throw new Error(`Invalid HLC format: wallTime and logical must be numbers, got "${s}"`);
		}

		if (!nodeId) {
			throw new Error(`Invalid HLC format: nodeId is required, got "${s}"`);
		}

		return { wallTime, logical, nodeId };
	}

	/**
	 * Apply drift protection to prevent the logical clock from drifting
	 * too far from physical time.
	 *
	 * If lastPhysical is more than maxDriftMs ahead of actual physical time,
	 * we reset to the current physical time. This can happen if a remote
	 * node has a clock far in the future.
	 *
	 * @param currentPhysical - Current physical time (Date.now())
	 */
	private applyDriftProtection(currentPhysical: number): void {
		const drift = this.lastPhysical - currentPhysical;

		if (drift > this.maxDriftMs) {
			// Clock has drifted too far into the future - reset
			this.lastPhysical = currentPhysical;
			this.lastLogical = 0;
		}
	}
}
