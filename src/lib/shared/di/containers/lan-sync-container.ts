/**
 * LAN Sync Container - ITI Dependency Injection
 *
 * Contains services for peer-to-peer playback synchronization:
 * - PeerConnectionManager (WebRTC connection handling)
 * - LanSyncCoordinator (sync protocol orchestration)
 */

import { createContainer } from 'iti';
import { PeerConnectionManager } from '$lib/shared/lan-sync/services/implementations/PeerConnectionManager';
import { LanSyncCoordinator } from '$lib/shared/lan-sync/services/implementations/LanSyncCoordinator';

/**
 * Create the LAN sync container
 *
 * No external dependencies required - this is a self-contained module.
 */
export function createLanSyncContainer() {
	// Layer 1: PeerConnectionManager (WebRTC wrapper)
	const baseContainer = createContainer().add({
		peerConnectionManager: () => new PeerConnectionManager()
	});

	// Layer 2: LanSyncCoordinator depends on PeerConnectionManager
	const fullContainer = baseContainer.add((ctx) => ({
		lanSyncCoordinator: () => new LanSyncCoordinator(ctx.peerConnectionManager)
	}));

	return fullContainer;
}
