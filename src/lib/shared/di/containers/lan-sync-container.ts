/**
 * LAN Sync Container - ITI Dependency Injection
 *
 * Contains services for peer-to-peer playback synchronization:
 * - PeerConnectionManager (WebRTC connection handling)
 * - LanSyncCoordinator (sync protocol orchestration)
 * - SyncRoomBroadcaster (Firebase RTDB room broadcasting)
 * - SyncRoomDiscovery (Firebase RTDB room discovery)
 */

import { createContainer } from 'iti';
import { PeerConnectionManager } from '$lib/shared/lan-sync/services/implementations/PeerConnectionManager';
import { LanSyncCoordinator } from '$lib/shared/lan-sync/services/implementations/LanSyncCoordinator';
import { SyncRoomBroadcaster } from '$lib/shared/lan-sync/services/implementations/SyncRoomBroadcaster';
import { SyncRoomDiscovery } from '$lib/shared/lan-sync/services/implementations/SyncRoomDiscovery';

/**
 * Create the LAN sync container
 *
 * No external dependencies required - this is a self-contained module.
 */
export function createLanSyncContainer() {
	// Layer 1: Core services with no dependencies
	const baseContainer = createContainer().add({
		peerConnectionManager: () => new PeerConnectionManager(),
		syncRoomBroadcaster: () => new SyncRoomBroadcaster(),
		syncRoomDiscovery: () => new SyncRoomDiscovery()
	});

	// Layer 2: LanSyncCoordinator depends on PeerConnectionManager and SyncRoomBroadcaster
	const fullContainer = baseContainer.add((ctx) => ({
		lanSyncCoordinator: () => new LanSyncCoordinator(
			ctx.peerConnectionManager,
			ctx.syncRoomBroadcaster
		)
	}));

	return fullContainer;
}

export type LanSyncContainer = ReturnType<typeof createLanSyncContainer>;
