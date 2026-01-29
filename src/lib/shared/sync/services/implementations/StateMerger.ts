/**
 * State Merger Implementation
 *
 * Handles CRDT-based merging of room state from multiple peers.
 * Uses Last-Writer-Wins semantics based on HLC timestamps.
 */

import type { IStateMerger, MergeResult } from '../contracts/IStateMerger';
import type { IHybridLogicalClock } from '../contracts/IHybridLogicalClock';
import type {
	HLCTimestamp,
	PlaybackIntent,
	PeerInfo,
	SyncedRoomState,
	ViewMode
} from '../../domain/sync-types';

/**
 * CRDT-based state merger using Hybrid Logical Clocks for ordering.
 *
 * All operations are immutable - inputs are never mutated.
 */
export class StateMerger implements IStateMerger {
	constructor(private readonly hlc: IHybridLogicalClock) {}

	/**
	 * Merge remote state into local state using CRDT semantics.
	 *
	 * For each field:
	 * - playback: LWW-Register by HLC (latest intent wins)
	 * - sequence: Prefer the one with data, else latest by HLC
	 * - peers: Union merge (all peers from both states)
	 */
	merge(local: SyncedRoomState, remote: SyncedRoomState): MergeResult {
		const updatedFields = new Set<'playback' | 'sequence' | 'peers'>();
		let localChanged = false;

		// Merge playback (LWW by HLC)
		const playbackComparison = this.hlc.compare(
			remote.playback.anchorHlc,
			local.playback.anchorHlc
		);
		const mergedPlayback = playbackComparison > 0 ? remote.playback : local.playback;
		if (playbackComparison > 0) {
			updatedFields.add('playback');
			localChanged = true;
		}

		// Merge sequence
		const mergedSequence = this.mergeSequence(local, remote, updatedFields);
		if (updatedFields.has('sequence')) {
			localChanged = true;
		}

		// Merge peers (union)
		const mergedPeers = this.mergePeers(local.peers, remote.peers);
		if (mergedPeers.size !== local.peers.size || this.peersChanged(local.peers, mergedPeers)) {
			updatedFields.add('peers');
			localChanged = true;
		}

		// Use later createdAt for the merged state
		const createdAtComparison = this.hlc.compare(remote.createdAt, local.createdAt);
		const mergedCreatedAt = createdAtComparison > 0 ? remote.createdAt : local.createdAt;

		return {
			state: {
				playback: mergedPlayback,
				sequence: mergedSequence,
				peers: mergedPeers,
				createdAt: mergedCreatedAt
			},
			localChanged,
			updatedFields
		};
	}

	/**
	 * Merge a single playback intent into the current state.
	 * Returns the same reference if the intent is not newer.
	 */
	mergeIntent(currentState: SyncedRoomState, intent: PlaybackIntent): SyncedRoomState {
		const comparison = this.hlc.compare(intent.anchorHlc, currentState.playback.anchorHlc);

		// Only update if the incoming intent is strictly newer
		if (comparison > 0) {
			return {
				...currentState,
				playback: intent
			};
		}

		// No change - return same reference for optimization
		return currentState;
	}

	/**
	 * Merge a peer info update into the current state.
	 * Only updates if the incoming peer info is newer.
	 */
	mergePeerInfo(currentState: SyncedRoomState, peerInfo: PeerInfo): SyncedRoomState {
		const existingPeer = currentState.peers.get(peerInfo.nodeId);

		// If peer exists, only update if the incoming info is newer
		if (existingPeer) {
			const comparison = this.hlc.compare(peerInfo.lastSeen, existingPeer.lastSeen);
			if (comparison <= 0) {
				// Incoming is not newer - no change
				return currentState;
			}
		}

		// Create new peers map with the updated peer
		const newPeers = new Map(currentState.peers);
		newPeers.set(peerInfo.nodeId, peerInfo);

		return {
			...currentState,
			peers: newPeers
		};
	}

	/**
	 * Remove a peer from the state.
	 */
	removePeer(currentState: SyncedRoomState, nodeId: string): SyncedRoomState {
		if (!currentState.peers.has(nodeId)) {
			// Peer doesn't exist - return same reference
			return currentState;
		}

		const newPeers = new Map(currentState.peers);
		newPeers.delete(nodeId);

		return {
			...currentState,
			peers: newPeers
		};
	}

	/**
	 * Create a new playback intent with fresh HLC timestamp.
	 */
	createIntent(
		playing: boolean,
		anchorStep: number,
		speed: number,
		loop: boolean,
		totalSteps: number
	): PlaybackIntent {
		const timestamp = this.hlc.now();

		return {
			intentId: `${timestamp.nodeId}-${timestamp.wallTime}-${timestamp.logical}`,
			playing,
			anchorStep,
			anchorHlc: timestamp,
			anchorWallTime: Date.now(),
			speed,
			loop,
			totalSteps
		};
	}

	/**
	 * Create peer info for this device.
	 */
	createPeerInfo(displayName: string, viewMode: ViewMode): PeerInfo {
		return {
			nodeId: this.hlc.nodeId,
			displayName,
			viewMode,
			lastSeen: this.hlc.now()
		};
	}

	// ============================================================================
	// Private Helpers
	// ============================================================================

	/**
	 * Merge sequence data with preference rules:
	 * - If remote has data and local doesn't, prefer remote
	 * - If IDs differ, prefer the one with later createdAt HLC
	 * - If same ID, prefer the one with data
	 */
	private mergeSequence(
		local: SyncedRoomState,
		remote: SyncedRoomState,
		updatedFields: Set<'playback' | 'sequence' | 'peers'>
	) {
		const localSeq = local.sequence;
		const remoteSeq = remote.sequence;

		// Same ID - prefer the one with data
		if (localSeq.id === remoteSeq.id) {
			if (!localSeq.data && remoteSeq.data) {
				updatedFields.add('sequence');
				return remoteSeq;
			}
			return localSeq;
		}

		// Different IDs - prefer the one with later createdAt
		const createdAtComparison = this.hlc.compare(remote.createdAt, local.createdAt);
		if (createdAtComparison > 0) {
			updatedFields.add('sequence');
			return remoteSeq;
		}

		return localSeq;
	}

	/**
	 * Union merge of peer maps.
	 * For duplicate nodeIds, take the one with later lastSeen HLC.
	 */
	private mergePeers(
		localPeers: Map<string, PeerInfo>,
		remotePeers: Map<string, PeerInfo>
	): Map<string, PeerInfo> {
		const merged = new Map<string, PeerInfo>();

		// Add all local peers
		for (const [nodeId, peer] of localPeers) {
			merged.set(nodeId, peer);
		}

		// Merge in remote peers (only update if newer)
		for (const [nodeId, remotePeer] of remotePeers) {
			const existingPeer = merged.get(nodeId);

			if (!existingPeer) {
				// New peer - add it
				merged.set(nodeId, remotePeer);
			} else {
				// Existing peer - take the one with later lastSeen
				const comparison = this.hlc.compare(remotePeer.lastSeen, existingPeer.lastSeen);
				if (comparison > 0) {
					merged.set(nodeId, remotePeer);
				}
			}
		}

		return merged;
	}

	/**
	 * Check if any peers changed between two maps.
	 */
	private peersChanged(
		oldPeers: Map<string, PeerInfo>,
		newPeers: Map<string, PeerInfo>
	): boolean {
		for (const [nodeId, newPeer] of newPeers) {
			const oldPeer = oldPeers.get(nodeId);
			if (!oldPeer) {
				return true;
			}
			// Check if any field changed (simple reference comparison for lastSeen)
			if (
				oldPeer.displayName !== newPeer.displayName ||
				oldPeer.viewMode !== newPeer.viewMode ||
				oldPeer.lastSeen !== newPeer.lastSeen
			) {
				return true;
			}
		}
		return false;
	}
}
