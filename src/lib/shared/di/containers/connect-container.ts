/**
 * Connect Container - ITI Dependency Injection
 *
 * Contains services for collaborative sync sessions:
 * - PresenceTracker (online/offline tracking)
 * - SessionManager (session CRUD)
 * - InviteHandler (invite send/receive)
 * - FriendshipManager (friends list)
 * - ConnectOrchestrator (high-level coordination)
 */

import { createContainer } from 'iti';
import { PresenceTracker } from '$lib/features/connect/services/implementations/PresenceTracker';
import { SessionManager } from '$lib/features/connect/services/implementations/SessionManager';
import { InviteHandler } from '$lib/features/connect/services/implementations/InviteHandler';
import { FriendshipManager } from '$lib/features/connect/services/implementations/FriendshipManager';
import { ConnectOrchestrator } from '$lib/features/connect/services/implementations/ConnectOrchestrator';
import type { ILanSyncCoordinator } from '$lib/shared/lan-sync/services/contracts/ILanSyncCoordinator';

export interface ConnectContainerDeps {
	lanSyncCoordinator: ILanSyncCoordinator;
}

/**
 * Create the Connect container.
 *
 * Requires lanSyncCoordinator from lan-sync-container for PeerJS sync.
 */
export function createConnectContainer(deps: ConnectContainerDeps) {
	// Layer 1: Core services with no internal dependencies
	const baseContainer = createContainer().add({
		connectPresenceTracker: () => new PresenceTracker(),
		connectSessionManager: () => new SessionManager(),
		connectInviteHandler: () => new InviteHandler()
	});

	// Layer 2: FriendshipManager depends on PresenceTracker
	const friendsContainer = baseContainer.add((ctx) => ({
		connectFriendshipManager: () => new FriendshipManager(ctx.connectPresenceTracker)
	}));

	// Layer 3: ConnectOrchestrator depends on all services
	const fullContainer = friendsContainer.add((ctx) => ({
		connectOrchestrator: () =>
			new ConnectOrchestrator(
				ctx.connectPresenceTracker,
				ctx.connectSessionManager,
				ctx.connectInviteHandler,
				ctx.connectFriendshipManager,
				deps.lanSyncCoordinator
			)
	}));

	return fullContainer;
}

export type ConnectContainer = ReturnType<typeof createConnectContainer>;
