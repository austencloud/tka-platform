/**
 * GalleryPositionSyncer - Real-time position synchronization
 *
 * Handles broadcasting local player position and receiving remote player updates.
 * Includes interpolation for smooth remote player movement.
 */

import {
	ref,
	update,
	onValue,
	onDisconnect,
	off,
	serverTimestamp
} from 'firebase/database';
import { database, auth } from '$lib/shared/auth/firebase';
import type { IGalleryPositionSyncer } from '../contracts/IGalleryPositionSyncer';
import type {
	LocalPlayerState,
	RemotePlayer,
	RemotePlayerData,
	PlayerPosition,
	PlayerRotation,
	PlayerStatus
} from '../../domain/multiplayer-models';
import { MULTIPLAYER_CONFIG as CONFIG } from '../../domain/multiplayer-models';

export class GalleryPositionSyncer implements IGalleryPositionSyncer {
	private sessionId: string | null = null;
	private syncing = false;
	private playerRef: ReturnType<typeof ref> | null = null;
	private playersUnsubscribe: (() => void) | null = null;

	// Local state
	private localState: LocalPlayerState | null = null;
	private localStatus: PlayerStatus = 'active';
	private lastBroadcast = 0;
	private broadcastTimeout: ReturnType<typeof setTimeout> | null = null;

	// Remote players
	private remotePlayers: Map<string, RemotePlayer> = new Map();
	private remotePlayerCallbacks: Set<(players: RemotePlayer[]) => void> = new Set();

	// =========================================================================
	// Initialization
	// =========================================================================

	async startSync(sessionId: string): Promise<void> {
		if (this.syncing) {
			await this.stopSync();
		}

		const user = auth.currentUser;
		if (!user) throw new Error('Must be authenticated to sync');

		this.sessionId = sessionId;
		this.playerRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${sessionId}/${CONFIG.PATHS.PLAYERS}/${user.uid}`
		);

		// Set up onDisconnect handler
		await onDisconnect(this.playerRef).update({
			status: 'away',
			lastUpdate: serverTimestamp()
		});

		// Subscribe to all players
		this.subscribeToPlayersInternal();

		this.syncing = true;
	}

	async stopSync(): Promise<void> {
		// Cancel broadcast timeout
		if (this.broadcastTimeout) {
			clearTimeout(this.broadcastTimeout);
			this.broadcastTimeout = null;
		}

		// Unsubscribe from players
		if (this.playersUnsubscribe) {
			this.playersUnsubscribe();
			this.playersUnsubscribe = null;
		}

		// Cancel onDisconnect
		if (this.playerRef) {
			await onDisconnect(this.playerRef).cancel();
			this.playerRef = null;
		}

		this.sessionId = null;
		this.syncing = false;
		this.remotePlayers.clear();
		this.localState = null;
	}

	isSyncing(): boolean {
		return this.syncing;
	}

	// =========================================================================
	// Local Player Broadcasting
	// =========================================================================

	updateLocalState(state: LocalPlayerState): void {
		this.localState = state;
		this.scheduleBroadcast();
	}

	private scheduleBroadcast(): void {
		const now = Date.now();
		const timeSinceLastBroadcast = now - this.lastBroadcast;

		// If we've waited long enough, broadcast immediately
		if (timeSinceLastBroadcast >= CONFIG.POSITION_BROADCAST_INTERVAL) {
			this.broadcastNow();
			return;
		}

		// Otherwise, schedule a broadcast
		if (this.broadcastTimeout) return; // Already scheduled

		const delay = CONFIG.POSITION_BROADCAST_INTERVAL - timeSinceLastBroadcast;
		this.broadcastTimeout = setTimeout(() => {
			this.broadcastTimeout = null;
			this.broadcastNow();
		}, delay);
	}

	async broadcastNow(): Promise<void> {
		if (!this.playerRef || !this.localState || !this.syncing) return;

		const now = Date.now();
		this.lastBroadcast = now;

		try {
			await update(this.playerRef, {
				position: this.localState.position,
				rotation: this.localState.rotation,
				locomotion: this.localState.locomotion,
				focusedExhibitId: this.localState.focusedExhibitId,
				status: this.localStatus,
				lastUpdate: serverTimestamp()
			});
		} catch (error) {
			console.warn('[GalleryPositionSyncer] Failed to broadcast:', error);
		}
	}

	setStatus(status: PlayerStatus): void {
		this.localStatus = status;
		this.broadcastNow();
	}

	// =========================================================================
	// Remote Players
	// =========================================================================

	private subscribeToPlayersInternal(): void {
		if (!this.sessionId) return;

		const playersRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${this.sessionId}/${CONFIG.PATHS.PLAYERS}`
		);

		const handleValue = (snapshot: { val: () => Record<string, RemotePlayerData> | null }) => {
			const data = snapshot.val();
			const user = auth.currentUser;
			const localUserId = user?.uid;

			if (!data) {
				this.remotePlayers.clear();
				this.notifyRemotePlayerCallbacks();
				return;
			}

			// Update remote players
			const currentPlayerIds = new Set<string>();

			for (const [userId, playerData] of Object.entries(data)) {
				// Skip local player
				if (userId === localUserId) continue;

				currentPlayerIds.add(userId);

				const existing = this.remotePlayers.get(userId);

				if (existing) {
					// Update existing player - set new target for interpolation
					existing.targetPosition = { ...playerData.position };
					existing.targetRotation = { ...playerData.rotation };
					existing.locomotion = { ...playerData.locomotion };
					existing.focusedExhibitId = playerData.focusedExhibitId;
					existing.status = playerData.status;
					existing.lastUpdate = playerData.lastUpdate;
					existing.lastNetworkUpdate = Date.now();
					existing.interpolationProgress = 0;
				} else {
					// New player - start at their current position
					const newPlayer: RemotePlayer = {
						userId,
						displayName: playerData.displayName,
						avatarUrl: playerData.avatarUrl,
						avatarModelId: playerData.avatarModelId,
						position: { ...playerData.position },
						rotation: { ...playerData.rotation },
						locomotion: { ...playerData.locomotion },
						targetPosition: { ...playerData.position },
						targetRotation: { ...playerData.rotation },
						focusedExhibitId: playerData.focusedExhibitId,
						status: playerData.status,
						lastUpdate: playerData.lastUpdate,
						lastNetworkUpdate: Date.now(),
						interpolationProgress: 1 // Already at target
					};
					this.remotePlayers.set(userId, newPlayer);
				}
			}

			// Remove players that left
			for (const userId of this.remotePlayers.keys()) {
				if (!currentPlayerIds.has(userId)) {
					this.remotePlayers.delete(userId);
				}
			}

			this.notifyRemotePlayerCallbacks();
		};

		onValue(playersRef, handleValue);

		this.playersUnsubscribe = () => {
			off(playersRef, 'value', handleValue);
		};
	}

	getRemotePlayers(): RemotePlayer[] {
		return Array.from(this.remotePlayers.values());
	}

	updateInterpolation(deltaTime: number): void {
		const speed = CONFIG.INTERPOLATION_SPEED;

		for (const player of this.remotePlayers.values()) {
			// Skip if already at target
			if (player.interpolationProgress >= 1) continue;

			// Update interpolation progress
			player.interpolationProgress = Math.min(1, player.interpolationProgress + deltaTime * speed);
			const t = player.interpolationProgress;

			// Lerp position
			player.position.x = lerp(player.position.x, player.targetPosition.x, t);
			player.position.y = lerp(player.position.y, player.targetPosition.y, t);
			player.position.z = lerp(player.position.z, player.targetPosition.z, t);

			// Lerp rotation (simple lerp for small angles)
			player.rotation.yaw = lerpAngle(player.rotation.yaw, player.targetRotation.yaw, t);
			player.rotation.pitch = lerp(player.rotation.pitch, player.targetRotation.pitch, t);
		}
	}

	subscribeToRemotePlayers(callback: (players: RemotePlayer[]) => void): () => void {
		this.remotePlayerCallbacks.add(callback);

		// Immediately call with current state
		callback(this.getRemotePlayers());

		return () => {
			this.remotePlayerCallbacks.delete(callback);
		};
	}

	private notifyRemotePlayerCallbacks(): void {
		const players = this.getRemotePlayers();
		for (const callback of this.remotePlayerCallbacks) {
			callback(players);
		}
	}

	// =========================================================================
	// Utility
	// =========================================================================

	getLocalUserId(): string | null {
		return auth.currentUser?.uid ?? null;
	}

	isPlayerNearby(playerId: string, threshold: number = CONFIG.NEARBY_DISTANCE): boolean {
		if (!this.localState) return false;

		const player = this.remotePlayers.get(playerId);
		if (!player) return false;

		const dx = player.position.x - this.localState.position.x;
		const dz = player.position.z - this.localState.position.z;
		const distance = Math.sqrt(dx * dx + dz * dz);

		return distance <= threshold;
	}

	getPlayersByDistance(): RemotePlayer[] {
		if (!this.localState) return this.getRemotePlayers();

		const localPos = this.localState.position;
		const players = this.getRemotePlayers();

		return players.sort((a, b) => {
			const distA = getDistance(localPos, a.position);
			const distB = getDistance(localPos, b.position);
			return distA - distB;
		});
	}
}

// =========================================================================
// Helper Functions
// =========================================================================

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
	// Handle angle wrapping for smooth rotation
	let delta = b - a;

	// Normalize delta to [-PI, PI]
	while (delta > Math.PI) delta -= Math.PI * 2;
	while (delta < -Math.PI) delta += Math.PI * 2;

	return a + delta * t;
}

function getDistance(a: PlayerPosition, b: PlayerPosition): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dz = b.z - a.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
