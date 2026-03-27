/**
 * GallerySessionManager - Manages gallery multiplayer sessions
 *
 * Handles creating, joining, leaving sessions using Firebase Realtime Database.
 * Sessions support public discovery, private invite links, and friends-only access.
 */

import {
	ref,
	set,
	update,
	remove,
	onValue,
	onDisconnect,
	off,
	get,
	push,
	query,
	orderByChild,
	equalTo,
	serverTimestamp
} from 'firebase/database';
import { database, auth } from '$lib/shared/auth/firebase';
import type { IGallerySessionManager } from '../contracts/IGallerySessionManager';
import type {
	GallerySession,
	GallerySessionMeta,
	PublicSessionInfo,
	CreateSessionOptions,
	JoinSessionOptions,
	RemotePlayerData,
	ChatMessage,
	SessionVisibility,
	MULTIPLAYER_CONFIG
} from '../../domain/multiplayer-models';
import { MULTIPLAYER_CONFIG as CONFIG } from '../../domain/multiplayer-models';

export class GallerySessionManager implements IGallerySessionManager {
	private currentSessionId: string | null = null;
	private currentHostId: string | null = null;
	private playerRef: ReturnType<typeof ref> | null = null;
	private sessionUnsubscribe: (() => void) | null = null;

	// =========================================================================
	// Session Lifecycle
	// =========================================================================

	async createSession(options: CreateSessionOptions): Promise<string> {
		const user = auth.currentUser;
		if (!user) throw new Error('Must be authenticated to create a session');

		// Generate a new session ID
		const sessionsRef = ref(database, CONFIG.PATHS.SESSIONS);
		const newSessionRef = push(sessionsRef);
		const sessionId = newSessionRef.key;

		if (!sessionId) throw new Error('Failed to generate session ID');

		const now = Date.now();

		// Create session metadata
		const meta: GallerySessionMeta = {
			hostId: user.uid,
			name: options.name,
			visibility: options.visibility,
			layoutId: options.layoutId,
			maxPlayers: options.maxPlayers ?? CONFIG.MAX_PLAYERS,
			createdAt: now
		};

		// Write session metadata
		const metaRef = ref(database, `${CONFIG.PATHS.SESSIONS}/${sessionId}/${CONFIG.PATHS.META}`);
		await set(metaRef, meta);

		// Join the session as host
		await this.joinSession({
			sessionId,
			displayName: user.displayName ?? 'Anonymous',
			avatarUrl: user.photoURL,
			avatarModelId: 'xbot' // Default avatar
		});

		// Set up session cleanup when host disconnects
		const sessionRef = ref(database, `${CONFIG.PATHS.SESSIONS}/${sessionId}`);
		await onDisconnect(sessionRef).remove();

		this.currentHostId = user.uid;

		// Send system message that session was created
		await this.sendSystemMessage('Session created', 'join');

		return sessionId;
	}

	async joinSession(options: JoinSessionOptions): Promise<boolean> {
		const user = auth.currentUser;
		if (!user) throw new Error('Must be authenticated to join a session');

		const { sessionId, displayName, avatarUrl, avatarModelId } = options;

		// Check if session exists
		const metaRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${sessionId}/${CONFIG.PATHS.META}`
		);
		const metaSnapshot = await get(metaRef);

		if (!metaSnapshot.exists()) {
			console.warn('[GallerySessionManager] Session not found:', sessionId);
			return false;
		}

		const meta = metaSnapshot.val() as GallerySessionMeta;

		// Check player count
		const playersRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${sessionId}/${CONFIG.PATHS.PLAYERS}`
		);
		const playersSnapshot = await get(playersRef);
		const playerCount = playersSnapshot.exists()
			? Object.keys(playersSnapshot.val()).length
			: 0;

		if (playerCount >= meta.maxPlayers) {
			console.warn('[GallerySessionManager] Session is full');
			return false;
		}

		// Leave current session if in one
		if (this.currentSessionId) {
			await this.leaveSession();
		}

		// Create player data
		const now = Date.now();
		const playerData: RemotePlayerData = {
			userId: user.uid,
			displayName,
			avatarUrl,
			avatarModelId,
			position: { x: 0, y: 320, z: 0 }, // Spawn position (player eye height)
			rotation: { yaw: 0, pitch: 0 },
			locomotion: { isMoving: false, moveDirection: 0, moveSpeed: 0 },
			focusedExhibitId: null,
			status: 'active',
			lastUpdate: now
		};

		// Write player data
		this.playerRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${sessionId}/${CONFIG.PATHS.PLAYERS}/${user.uid}`
		);

		// Set up onDisconnect handler FIRST
		await onDisconnect(this.playerRef).remove();

		// Then write player data
		await set(this.playerRef, {
			...playerData,
			lastUpdate: serverTimestamp()
		});

		this.currentSessionId = sessionId;
		this.currentHostId = meta.hostId;

		// Send join message
		await this.sendSystemMessage(`${displayName} joined`, 'join');

		return true;
	}

	async leaveSession(): Promise<void> {
		const user = auth.currentUser;
		if (!user || !this.currentSessionId) return;

		// Send leave message before removing player
		const displayName = user.displayName ?? 'Anonymous';
		await this.sendSystemMessage(`${displayName} left`, 'leave');

		// Remove player data
		if (this.playerRef) {
			// Cancel onDisconnect since we're leaving intentionally
			await onDisconnect(this.playerRef).cancel();
			await remove(this.playerRef);
			this.playerRef = null;
		}

		// If we're the host and there are no other players, delete the session
		if (this.currentHostId === user.uid) {
			const playersRef = ref(
				database,
				`${CONFIG.PATHS.SESSIONS}/${this.currentSessionId}/${CONFIG.PATHS.PLAYERS}`
			);
			const playersSnapshot = await get(playersRef);

			if (!playersSnapshot.exists() || Object.keys(playersSnapshot.val()).length === 0) {
				// Delete the entire session
				const sessionRef = ref(
					database,
					`${CONFIG.PATHS.SESSIONS}/${this.currentSessionId}`
				);
				await remove(sessionRef);
			}
		}

		this.currentSessionId = null;
		this.currentHostId = null;
	}

	getCurrentSessionId(): string | null {
		return this.currentSessionId;
	}

	isInSession(): boolean {
		return this.currentSessionId !== null;
	}

	// =========================================================================
	// Session Discovery
	// =========================================================================

	async getPublicSessions(): Promise<PublicSessionInfo[]> {
		const sessionsRef = ref(database, CONFIG.PATHS.SESSIONS);
		const snapshot = await get(sessionsRef);

		if (!snapshot.exists()) return [];

		const sessions: PublicSessionInfo[] = [];
		const data = snapshot.val() as Record<string, { meta: GallerySessionMeta; players?: Record<string, RemotePlayerData> }>;

		for (const [sessionId, session] of Object.entries(data)) {
			if (!session.meta) continue;
			if (session.meta.visibility !== 'public') continue;

			const playerCount = session.players ? Object.keys(session.players).length : 0;

			// Skip empty sessions (they'll be cleaned up)
			if (playerCount === 0) continue;

			// Get host display name
			let hostDisplayName = 'Unknown';
			const hostPlayer = session.players?.[session.meta.hostId];
			if (hostPlayer) {
				hostDisplayName = hostPlayer.displayName;
			}

			sessions.push({
				id: sessionId,
				name: session.meta.name,
				hostDisplayName,
				playerCount,
				maxPlayers: session.meta.maxPlayers,
				layoutId: session.meta.layoutId,
				createdAt: session.meta.createdAt
			});
		}

		// Sort by player count (most popular first), then by creation time
		sessions.sort((a, b) => {
			if (a.playerCount !== b.playerCount) {
				return b.playerCount - a.playerCount;
			}
			return b.createdAt - a.createdAt;
		});

		return sessions;
	}

	subscribeToPublicSessions(callback: (sessions: PublicSessionInfo[]) => void): () => void {
		const sessionsRef = ref(database, CONFIG.PATHS.SESSIONS);

		const handleValue = async (snapshot: { val: () => Record<string, { meta: GallerySessionMeta; players?: Record<string, RemotePlayerData> }> | null }) => {
			const data = snapshot.val();
			if (!data) {
				callback([]);
				return;
			}

			const sessions: PublicSessionInfo[] = [];

			for (const [sessionId, session] of Object.entries(data)) {
				if (!session.meta) continue;
				if (session.meta.visibility !== 'public') continue;

				const playerCount = session.players ? Object.keys(session.players).length : 0;
				if (playerCount === 0) continue;

				let hostDisplayName = 'Unknown';
				const hostPlayerInLoop = session.players?.[session.meta.hostId];
				if (hostPlayerInLoop) {
					hostDisplayName = hostPlayerInLoop.displayName;
				}

				sessions.push({
					id: sessionId,
					name: session.meta.name,
					hostDisplayName,
					playerCount,
					maxPlayers: session.meta.maxPlayers,
					layoutId: session.meta.layoutId,
					createdAt: session.meta.createdAt
				});
			}

			sessions.sort((a, b) => {
				if (a.playerCount !== b.playerCount) {
					return b.playerCount - a.playerCount;
				}
				return b.createdAt - a.createdAt;
			});

			callback(sessions);
		};

		onValue(sessionsRef, handleValue);

		return () => {
			off(sessionsRef, 'value', handleValue);
		};
	}

	async getSession(sessionId: string): Promise<GallerySession | null> {
		const sessionRef = ref(database, `${CONFIG.PATHS.SESSIONS}/${sessionId}`);
		const snapshot = await get(sessionRef);

		if (!snapshot.exists()) return null;

		const data = snapshot.val() as { meta: GallerySessionMeta; players?: Record<string, RemotePlayerData> };
		if (!data.meta) return null;

		const playerCount = data.players ? Object.keys(data.players).length : 0;

		return {
			id: sessionId,
			...data.meta,
			playerCount
		};
	}

	getInviteLink(): string | null {
		if (!this.currentSessionId) return null;

		// Generate a URL that can be shared
		const baseUrl = window.location.origin;
		return `${baseUrl}/gallery?session=${this.currentSessionId}`;
	}

	// =========================================================================
	// Player Management
	// =========================================================================

	async getPlayers(): Promise<RemotePlayerData[]> {
		if (!this.currentSessionId) return [];

		const playersRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${this.currentSessionId}/${CONFIG.PATHS.PLAYERS}`
		);
		const snapshot = await get(playersRef);

		if (!snapshot.exists()) return [];

		const data = snapshot.val() as Record<string, RemotePlayerData>;
		return Object.values(data);
	}

	subscribeToPlayers(callback: (players: RemotePlayerData[]) => void): () => void {
		if (!this.currentSessionId) {
			callback([]);
			return () => {};
		}

		const playersRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${this.currentSessionId}/${CONFIG.PATHS.PLAYERS}`
		);

		const handleValue = (snapshot: { val: () => Record<string, RemotePlayerData> | null }) => {
			const data = snapshot.val();
			if (!data) {
				callback([]);
				return;
			}
			callback(Object.values(data));
		};

		onValue(playersRef, handleValue);

		return () => {
			off(playersRef, 'value', handleValue);
		};
	}

	async kickPlayer(userId: string): Promise<void> {
		const user = auth.currentUser;
		if (!user || !this.currentSessionId) return;
		if (this.currentHostId !== user.uid) {
			throw new Error('Only the host can kick players');
		}

		const playerRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${this.currentSessionId}/${CONFIG.PATHS.PLAYERS}/${userId}`
		);
		await remove(playerRef);

		await this.sendSystemMessage('A player was removed', 'leave');
	}

	// =========================================================================
	// Chat
	// =========================================================================

	async sendChatMessage(text: string): Promise<void> {
		const user = auth.currentUser;
		if (!user || !this.currentSessionId) return;

		const chatRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${this.currentSessionId}/${CONFIG.PATHS.CHAT}`
		);

		const messageRef = push(chatRef);
		const message: Omit<ChatMessage, 'id'> = {
			userId: user.uid,
			displayName: user.displayName ?? 'Anonymous',
			avatarUrl: user.photoURL,
			text,
			type: 'message',
			timestamp: Date.now()
		};

		await set(messageRef, {
			...message,
			timestamp: serverTimestamp()
		});
	}

	private async sendSystemMessage(text: string, type: 'join' | 'leave' | 'emote'): Promise<void> {
		const user = auth.currentUser;
		if (!user || !this.currentSessionId) return;

		const chatRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${this.currentSessionId}/${CONFIG.PATHS.CHAT}`
		);

		const messageRef = push(chatRef);
		const message: Omit<ChatMessage, 'id'> = {
			userId: user.uid,
			displayName: user.displayName ?? 'Anonymous',
			avatarUrl: user.photoURL,
			text,
			type,
			timestamp: Date.now()
		};

		await set(messageRef, {
			...message,
			timestamp: serverTimestamp()
		});
	}

	subscribeToChatMessages(callback: (messages: ChatMessage[]) => void): () => void {
		if (!this.currentSessionId) {
			callback([]);
			return () => {};
		}

		const chatRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${this.currentSessionId}/${CONFIG.PATHS.CHAT}`
		);

		const handleValue = (snapshot: { val: () => Record<string, Omit<ChatMessage, 'id'>> | null }) => {
			const data = snapshot.val();
			if (!data) {
				callback([]);
				return;
			}

			const messages: ChatMessage[] = Object.entries(data).map(([id, msg]) => ({
				id,
				...msg
			}));

			// Sort by timestamp (oldest first for chat)
			messages.sort((a, b) => a.timestamp - b.timestamp);

			// Keep only last 100 messages
			callback(messages.slice(-100));
		};

		onValue(chatRef, handleValue);

		return () => {
			off(chatRef, 'value', handleValue);
		};
	}

	// =========================================================================
	// Session Settings (Host Only)
	// =========================================================================

	async setVisibility(visibility: SessionVisibility): Promise<void> {
		const user = auth.currentUser;
		if (!user || !this.currentSessionId) return;
		if (this.currentHostId !== user.uid) {
			throw new Error('Only the host can change visibility');
		}

		const metaRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${this.currentSessionId}/${CONFIG.PATHS.META}`
		);
		await update(metaRef, { visibility });
	}

	async setSessionName(name: string): Promise<void> {
		const user = auth.currentUser;
		if (!user || !this.currentSessionId) return;
		if (this.currentHostId !== user.uid) {
			throw new Error('Only the host can change the session name');
		}

		const metaRef = ref(
			database,
			`${CONFIG.PATHS.SESSIONS}/${this.currentSessionId}/${CONFIG.PATHS.META}`
		);
		await update(metaRef, { name });
	}

	isHost(): boolean {
		const user = auth.currentUser;
		return user !== null && this.currentHostId === user.uid;
	}
}
