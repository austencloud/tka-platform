/**
 * Device Sync Container - ITI Dependency Injection
 *
 * Contains services for multi-device playback synchronization:
 * - DeviceSyncCoordinator (orchestrates sync across devices)
 * - HybridLogicalClock (causal ordering)
 * - PlaybackPositionCalculator (deterministic position calculation)
 * - StateMerger (CRDT-based state merging)
 * - SequenceLocalCache (IndexedDB caching)
 *
 * Mobile Optimization Services:
 * - MobileConnectionAdapter (reconnection with exponential backoff)
 * - AdaptiveHeartbeat (battery-aware heartbeat timing)
 * - MessageBatcher (batches non-critical messages)
 * - NetworkStatusMonitor (network type detection)
 *
 * Depends on:
 * - IPeerConnectionManager from lan-sync-container
 */

import { createContainer } from 'iti';
import type { IPeerConnectionManager } from '$lib/shared/lan-sync/services/contracts/IPeerConnectionManager';
import { DeviceSyncCoordinator } from '$lib/shared/sync/services/implementations/DeviceSyncCoordinator';
import { SequenceLocalCache } from '$lib/shared/sync/services/implementations/SequenceLocalCache';

// Mobile optimization services
import { MobileConnectionAdapter } from '$lib/shared/sync/services/implementations/MobileConnectionAdapter';
import { AdaptiveHeartbeat } from '$lib/shared/sync/services/implementations/AdaptiveHeartbeat';
import { MessageBatcher } from '$lib/shared/sync/services/implementations/MessageBatcher';
import { NetworkStatusMonitor } from '$lib/shared/sync/services/implementations/NetworkStatusMonitor';

// Types for interfaces
import type { IMobileConnectionAdapter } from '$lib/shared/sync/services/contracts/IMobileConnectionAdapter';
import type { IAdaptiveHeartbeat } from '$lib/shared/sync/services/contracts/IAdaptiveHeartbeat';
import type { IMessageBatcher } from '$lib/shared/sync/services/contracts/IMessageBatcher';
import type { INetworkStatusMonitor } from '$lib/shared/sync/services/contracts/INetworkStatusMonitor';

/**
 * Dependencies required by the device sync container.
 */
export interface DeviceSyncContainerDeps {
	peerConnectionManager: IPeerConnectionManager;
}

/**
 * Create the device sync container.
 *
 * @param deps - External dependencies (peerConnectionManager from lan-sync)
 */
export function createDeviceSyncContainer(deps: DeviceSyncContainerDeps) {
	return createContainer()
		// Layer 1: Standalone services with no dependencies
		.add({
			// Sequence cache (standalone, no dependencies)
			sequenceLocalCache: () => new SequenceLocalCache(),

			// Network status monitor (standalone)
			networkStatusMonitor: (): INetworkStatusMonitor => new NetworkStatusMonitor(),

			// Message batcher (standalone)
			messageBatcher: (): IMessageBatcher => new MessageBatcher(),

			// Adaptive heartbeat (standalone)
			adaptiveHeartbeat: (): IAdaptiveHeartbeat => new AdaptiveHeartbeat(),
		})
		// Layer 2: Services that depend on Layer 1
		.add((ctx) => ({
			// Mobile connection adapter with network monitoring integration
			mobileConnectionAdapter: (): IMobileConnectionAdapter => {
				const adapter = new MobileConnectionAdapter();

				// Wire up network status changes to message batcher
				ctx.networkStatusMonitor.onConnectionTypeChange((type) => {
					const isWifi = type === 'wifi' || type === 'ethernet';
					ctx.messageBatcher.notifyNetworkType(isWifi);
				});

				return adapter;
			},
		}))
		// Layer 3: Main coordinator that ties everything together with mobile optimizations
		.add((ctx) => ({
			// Device sync coordinator with full mobile optimization integration
			deviceSyncCoordinator: () =>
				new DeviceSyncCoordinator(
					deps.peerConnectionManager,
					{}, // Use default config
					ctx.sequenceLocalCache,
					{
						// Wire in all mobile optimization services
						adaptiveHeartbeat: ctx.adaptiveHeartbeat,
						messageBatcher: ctx.messageBatcher,
						connectionAdapter: ctx.mobileConnectionAdapter,
					}
				),
		}));
}

/**
 * Type for the device sync container.
 */
export type DeviceSyncContainer = ReturnType<typeof createDeviceSyncContainer>;
