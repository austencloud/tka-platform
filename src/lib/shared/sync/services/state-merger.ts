import type { MergeResult } from "../contracts/types";
import type { HybridLogicalClock } from './HybridLogicalClock';
import type {
	PlaybackIntent,
	PeerInfo,
	SyncedRoomState,
	ViewMode
} from '../../domain/sync-types';

/**
 * All operations are immutable - inputs are never mutated.
 */
export class StateMerger {
	constructor(private readonly hlc: HybridLogicalClock) {}

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

		const playbackComparison = this.hlc.compare(
			remote.playback.anchorHlc,
			local.playback.anchorHlc
		);
		const mergedPlayback = playbackComparison > 0 ? remote.playback : local.playback;
		if (playbackComparison > 0) {
			updatedFields.add('playback');
			localChanged = true;
		}

		const mergedSequence = this.mergeSequence(local, remote, updatedFields);
		if (updatedFields.has('sequence')) {
			localChanged = true;
		}

		const mergedPeers = this.mergePeers(local.peers, remote.peers);
		if (mergedPeers.size !== local.peers.size || this.peersChanged(local.peers, mergedPeers)) {
			updatedFields.add('peers');
			localChanged = true;
		}

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

		if (comparison > 0) {
			return {
				...currentState,
				playback: intent
			};
		}

		return currentState;
	}

	mergePeerInfo(currentState: SyncedRoomState, peerInfo: PeerInfo): SyncedRoomState {
		const existingPeer = currentState.peers.get(peerInfo.nodeId);

		if (existingPeer) {
			const comparison = this.hlc.compare(peerInfo.lastSeen, existingPeer.lastSeen);
			if (comparison <= 0) {
				return currentState;
			}
		}

		const newPeers = new Map(currentState.peers);
		newPeers.set(peerInfo.nodeId, peerInfo);

		return {
			...currentState,
			peers: newPeers
		};
	}

	removePeer(currentState: SyncedRoomState, nodeId: string): SyncedRoomState {
		if (!currentState.peers.has(nodeId)) {
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

	createPeerInfo(displayName: string, viewMode: ViewMode): PeerInfo {
		return {
			nodeId: this.hlc.nodeId,
			displayName,
			viewMode,
			lastSeen: this.hlc.now()
		};
	}

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

		if (localSeq.id === remoteSeq.id) {
			if (!localSeq.data && remoteSeq.data) {
				updatedFields.add('sequence');
				return remoteSeq;
			}
			return localSeq;
		}

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

		for (const [nodeId, peer] of localPeers) {
			merged.set(nodeId, peer);
		}

		for (const [nodeId, remotePeer] of remotePeers) {
			const existingPeer = merged.get(nodeId);

			if (!existingPeer) {
				merged.set(nodeId, remotePeer);
			} else {
				const comparison = this.hlc.compare(remotePeer.lastSeen, existingPeer.lastSeen);
				if (comparison > 0) {
					merged.set(nodeId, remotePeer);
				}
			}
		}

		return merged;
	}

	private peersChanged(
		oldPeers: Map<string, PeerInfo>,
		newPeers: Map<string, PeerInfo>
	): boolean {
		for (const [nodeId, newPeer] of newPeers) {
			const oldPeer = oldPeers.get(nodeId);
			if (!oldPeer) {
				return true;
			}
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
