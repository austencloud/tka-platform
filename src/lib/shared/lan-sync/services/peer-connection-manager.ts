/**
 * PeerConnectionManager
 *
 * Wraps PeerJS to manage WebRTC peer-to-peer connections.
 * Handles room creation, joining, and message passing.
 */

import type { SyncMessage, PeerConnectionState } from '../domain/models/lan-sync-models';
import { generateRoomCode, createInitialConnectionState } from '../domain/models/lan-sync-models';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

export class PeerConnectionManager {
	private peer: Peer | null = null;
	private connections: Map<string, DataConnection> = new Map();
	private _connectionState: PeerConnectionState = createInitialConnectionState();

	private messageCallbacks: Set<(message: SyncMessage) => void> = new Set();
	private stateChangeCallbacks: Set<(state: PeerConnectionState) => void> = new Set();
	private peerConnectedCallbacks: Set<(peerId: string) => void> = new Set();
	private peerDisconnectedCallbacks: Set<(peerId: string) => void> = new Set();

	get connectionState(): PeerConnectionState {
		return this._connectionState;
	}

	async createRoom(): Promise<string> {
		const roomCode = generateRoomCode();
		await this.createRoomWithCode(roomCode);
		return roomCode;
	}

	async createRoomWithCode(roomCode: string): Promise<void> {
		const peerId = `tka-sync-${roomCode}`;

		this.updateState({
			status: 'creating-room',
			roomCode,
			isHost: true,
			errorMessage: null
		});

		try {
			await this.initializePeer(peerId);

			this.updateState({
				status: 'waiting-for-peer',
				peerId
			});
		} catch (error) {
			this.updateState({
				status: 'error',
				errorMessage: error instanceof Error ? error.message : 'Failed to create room'
			});
			throw error;
		}
	}

	async joinRoom(roomCode: string): Promise<void> {
		const normalizedCode = roomCode.toUpperCase().trim();
		const hostPeerId = `tka-sync-${normalizedCode}`;
		const myPeerId = `tka-sync-${normalizedCode}-${Date.now()}`;

		this.updateState({
			status: 'joining-room',
			roomCode: normalizedCode,
			isHost: false,
			errorMessage: null
		});

		try {
			await this.initializePeer(myPeerId);

			// Connect to the host
			const conn = this.peer!.connect(hostPeerId, { reliable: true });

			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Connection timeout - room may not exist'));
				}, 10000);

				conn.on('open', () => {
					clearTimeout(timeout);
					this.registerConnection(conn);
					this.updateState({
						status: 'connected',
						connectedPeerCount: 1
					});
					resolve();
				});

				conn.on('error', (err) => {
					clearTimeout(timeout);
					reject(err);
				});
			});
		} catch (error) {
			this.updateState({
				status: 'error',
				errorMessage: error instanceof Error ? error.message : 'Failed to join room'
			});
			throw error;
		}
	}

	disconnect(): void {
		// Close all connections
		for (const conn of this.connections.values()) {
			conn.close();
		}
		this.connections.clear();

		// Destroy peer
		if (this.peer) {
			this.peer.destroy();
			this.peer = null;
		}

		this.updateState(createInitialConnectionState());
	}

	broadcast(message: SyncMessage): void {
		const serialized = JSON.stringify(message);
		for (const conn of this.connections.values()) {
			if (conn.open) {
				conn.send(serialized);
			}
		}
	}

	onMessage(callback: (message: SyncMessage) => void): () => void {
		this.messageCallbacks.add(callback);
		return () => this.messageCallbacks.delete(callback);
	}

	onConnectionStateChange(callback: (state: PeerConnectionState) => void): () => void {
		this.stateChangeCallbacks.add(callback);
		return () => this.stateChangeCallbacks.delete(callback);
	}

	onPeerConnected(callback: (peerId: string) => void): () => void {
		this.peerConnectedCallbacks.add(callback);
		return () => this.peerConnectedCallbacks.delete(callback);
	}

	onPeerDisconnected(callback: (peerId: string) => void): () => void {
		this.peerDisconnectedCallbacks.add(callback);
		return () => this.peerDisconnectedCallbacks.delete(callback);
	}

	destroy(): void {
		this.disconnect();
		this.messageCallbacks.clear();
		this.stateChangeCallbacks.clear();
		this.peerConnectedCallbacks.clear();
		this.peerDisconnectedCallbacks.clear();
	}

	private async initializePeer(peerId: string): Promise<void> {
		// Lazy load PeerJS
		const { default: Peer } = await import('peerjs');

		return new Promise((resolve, reject) => {
			this.peer = new Peer(peerId, {
				debug: 0 // No debug logs
			});

			this.peer.on('open', () => {
				this.setupPeerListeners();
				resolve();
			});

			this.peer.on('error', (err) => {
				reject(err);
			});
		});
	}

	private setupPeerListeners(): void {
		if (!this.peer) return;

		// Handle incoming connections (host receives these)
		this.peer.on('connection', (conn) => {
			this.registerConnection(conn);
		});

		this.peer.on('disconnected', () => {
			if (this._connectionState.status === 'connected') {
				this.updateState({ status: 'reconnecting' });
				this.peer?.reconnect();
			}
		});
	}

	private registerConnection(conn: DataConnection): void {
		const peerId = conn.peer;

		conn.on('open', () => {
			this.connections.set(peerId, conn);
			this.updateState({
				status: 'connected',
				connectedPeerCount: this.connections.size
			});

			for (const callback of this.peerConnectedCallbacks) {
				callback(peerId);
			}
		});

		conn.on('data', (data) => {
			let message: SyncMessage;
			try {
				message = JSON.parse(data as string) as SyncMessage;
			} catch {
				console.warn('Failed to parse sync message:', data);
				return;
			}
			for (const callback of this.messageCallbacks) {
				try {
					callback(message);
				} catch (err) {
					console.error('[PeerConnectionManager] Message handler error:', err);
				}
			}
		});

		conn.on('close', () => {
			this.connections.delete(peerId);
			this.updateState({
				connectedPeerCount: this.connections.size,
				status: this.connections.size === 0 ? 'waiting-for-peer' : 'connected'
			});

			for (const callback of this.peerDisconnectedCallbacks) {
				callback(peerId);
			}
		});

		conn.on('error', (err) => {
			console.warn('Connection error:', err);
		});
	}

	private updateState(partial: Partial<PeerConnectionState>): void {
		this._connectionState = { ...this._connectionState, ...partial };

		for (const callback of this.stateChangeCallbacks) {
			callback(this._connectionState);
		}
	}
}
