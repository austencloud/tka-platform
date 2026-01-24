/**
 * IPeerConnectionManager
 *
 * Interface for managing PeerJS WebRTC connections.
 * Wraps PeerJS to provide a clean API for creating/joining rooms.
 */

import type { SyncMessage, PeerConnectionState } from '../../domain/models/lan-sync-models';

export interface IPeerConnectionManager {
	/** Current connection state */
	readonly connectionState: PeerConnectionState;

	/** Create a new room and become the host (generates random code) */
	createRoom(): Promise<string>; // Returns room code

	/** Create a room with a specific code (for sequence-based auto-discovery) */
	createRoomWithCode(roomCode: string): Promise<void>;

	/** Join an existing room by code */
	joinRoom(roomCode: string): Promise<void>;

	/** Disconnect from current room */
	disconnect(): void;

	/** Send a message to all connected peers */
	broadcast(message: SyncMessage): void;

	/** Subscribe to incoming messages */
	onMessage(callback: (message: SyncMessage) => void): () => void;

	/** Subscribe to connection state changes */
	onConnectionStateChange(callback: (state: PeerConnectionState) => void): () => void;

	/** Subscribe to peer connect events */
	onPeerConnected(callback: (peerId: string) => void): () => void;

	/** Subscribe to peer disconnect events */
	onPeerDisconnected(callback: (peerId: string) => void): () => void;

	/** Clean up resources */
	destroy(): void;
}
