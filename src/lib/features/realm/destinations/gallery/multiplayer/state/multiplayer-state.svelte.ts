/**
 * Multiplayer State - Svelte 5 reactive state for gallery multiplayer
 *
 * Provides reactive state for session info, remote players, and chat.
 * Integrates with GallerySessionManager and GalleryPositionSyncer services.
 */

import type {
	GallerySession,
	RemotePlayer,
	ChatMessage,
	PublicSessionInfo,
	CreateSessionOptions,
	LocalPlayerState
} from '../domain/multiplayer-models';
import type { IGallerySessionManager } from '../services/contracts/IGallerySessionManager';
import type { IGalleryPositionSyncer } from '../services/contracts/IGalleryPositionSyncer';

// ============================================================================
// State Interface
// ============================================================================

export interface MultiplayerState {
	// Session
	readonly isInSession: boolean;
	readonly currentSession: GallerySession | null;
	readonly isHost: boolean;
	readonly inviteLink: string | null;

	// Players
	readonly remotePlayers: readonly RemotePlayer[];
	readonly playerCount: number;

	// Chat
	readonly chatMessages: readonly ChatMessage[];
	readonly unreadCount: number;

	// UI State
	readonly isSessionDrawerOpen: boolean;
	readonly isChatOpen: boolean;
	readonly isMinimapExpanded: boolean;

	// Public Sessions
	readonly publicSessions: readonly PublicSessionInfo[];
	readonly isLoadingPublicSessions: boolean;
}

// ============================================================================
// State Factory
// ============================================================================

export function createMultiplayerState(
	sessionManager: IGallerySessionManager,
	positionSyncer: IGalleryPositionSyncer
) {
	// ---------------------------------------------------------------------------
	// Reactive State
	// ---------------------------------------------------------------------------

	let currentSession = $state<GallerySession | null>(null);
	let remotePlayers = $state<RemotePlayer[]>([]);
	let chatMessages = $state<ChatMessage[]>([]);
	let publicSessions = $state<PublicSessionInfo[]>([]);

	let isSessionDrawerOpen = $state(false);
	let isChatOpen = $state(false);
	let isMinimapExpanded = $state(false);
	let isLoadingPublicSessions = $state(false);
	let lastReadMessageCount = $state(0);

	// Subscriptions
	let playersUnsubscribe: (() => void) | null = null;
	let chatUnsubscribe: (() => void) | null = null;
	let publicSessionsUnsubscribe: (() => void) | null = null;
	let remotePlayersUnsubscribe: (() => void) | null = null;

	// ---------------------------------------------------------------------------
	// Derived State
	// ---------------------------------------------------------------------------

	const isInSession = $derived(currentSession !== null);
	const isHost = $derived(sessionManager.isHost());
	const inviteLink = $derived(sessionManager.getInviteLink());
	const playerCount = $derived(remotePlayers.length + 1); // +1 for local player
	const unreadCount = $derived(Math.max(0, chatMessages.length - lastReadMessageCount));

	// ---------------------------------------------------------------------------
	// Session Management
	// ---------------------------------------------------------------------------

	async function createSession(options: CreateSessionOptions): Promise<string> {
		const sessionId = await sessionManager.createSession(options);
		await positionSyncer.startSync(sessionId);
		await refreshSession();
		subscribeToSessionData();
		return sessionId;
	}

	async function joinSession(sessionId: string): Promise<boolean> {
		const { auth } = await import('$lib/shared/auth/firebase');
		const user = auth.currentUser;
		if (!user) return false;

		const success = await sessionManager.joinSession({
			sessionId,
			displayName: user.displayName ?? 'Anonymous',
			avatarUrl: user.photoURL,
			avatarModelId: 'xbot' // Default avatar model
		});

		if (success) {
			await positionSyncer.startSync(sessionId);
			await refreshSession();
			subscribeToSessionData();
		}

		return success;
	}

	async function leaveSession(): Promise<void> {
		unsubscribeFromSessionData();
		await positionSyncer.stopSync();
		await sessionManager.leaveSession();
		currentSession = null;
		remotePlayers = [];
		chatMessages = [];
	}

	async function refreshSession(): Promise<void> {
		const sessionId = sessionManager.getCurrentSessionId();
		if (sessionId) {
			currentSession = await sessionManager.getSession(sessionId);
		} else {
			currentSession = null;
		}
	}

	function subscribeToSessionData(): void {
		// Subscribe to players
		playersUnsubscribe = sessionManager.subscribeToPlayers((players) => {
			// Filter out local player
			const localUserId = positionSyncer.getLocalUserId();
			remotePlayers = players.filter((p) => p.userId !== localUserId) as RemotePlayer[];
		});

		// Subscribe to chat
		chatUnsubscribe = sessionManager.subscribeToChatMessages((messages) => {
			chatMessages = messages;
		});

		// Subscribe to remote players with interpolation
		remotePlayersUnsubscribe = positionSyncer.subscribeToRemotePlayers((players) => {
			remotePlayers = players;
		});
	}

	function unsubscribeFromSessionData(): void {
		if (playersUnsubscribe) {
			playersUnsubscribe();
			playersUnsubscribe = null;
		}
		if (chatUnsubscribe) {
			chatUnsubscribe();
			chatUnsubscribe = null;
		}
		if (remotePlayersUnsubscribe) {
			remotePlayersUnsubscribe();
			remotePlayersUnsubscribe = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Position Updates
	// ---------------------------------------------------------------------------

	function updateLocalPosition(state: LocalPlayerState): void {
		positionSyncer.updateLocalState(state);
	}

	function updateInterpolation(deltaTime: number): void {
		positionSyncer.updateInterpolation(deltaTime);
	}

	// ---------------------------------------------------------------------------
	// Chat
	// ---------------------------------------------------------------------------

	async function sendMessage(text: string): Promise<void> {
		if (!text.trim()) return;
		await sessionManager.sendChatMessage(text.trim());
	}

	function markChatAsRead(): void {
		lastReadMessageCount = chatMessages.length;
	}

	// ---------------------------------------------------------------------------
	// Public Sessions
	// ---------------------------------------------------------------------------

	async function loadPublicSessions(): Promise<void> {
		isLoadingPublicSessions = true;
		try {
			publicSessions = await sessionManager.getPublicSessions();
		} finally {
			isLoadingPublicSessions = false;
		}
	}

	function subscribeToPublicSessions(): () => void {
		isLoadingPublicSessions = true;

		publicSessionsUnsubscribe = sessionManager.subscribeToPublicSessions((sessions) => {
			publicSessions = sessions;
			isLoadingPublicSessions = false;
		});

		return () => {
			if (publicSessionsUnsubscribe) {
				publicSessionsUnsubscribe();
				publicSessionsUnsubscribe = null;
			}
		};
	}

	// ---------------------------------------------------------------------------
	// UI State
	// ---------------------------------------------------------------------------

	function openSessionDrawer(): void {
		isSessionDrawerOpen = true;
	}

	function closeSessionDrawer(): void {
		isSessionDrawerOpen = false;
	}

	function toggleChat(): void {
		isChatOpen = !isChatOpen;
		if (isChatOpen) {
			markChatAsRead();
		}
	}

	function openChat(): void {
		isChatOpen = true;
		markChatAsRead();
	}

	function closeChat(): void {
		isChatOpen = false;
	}

	function toggleMinimap(): void {
		isMinimapExpanded = !isMinimapExpanded;
	}

	// ---------------------------------------------------------------------------
	// Host Actions
	// ---------------------------------------------------------------------------

	async function kickPlayer(userId: string): Promise<void> {
		await sessionManager.kickPlayer(userId);
	}

	async function setSessionVisibility(visibility: 'public' | 'private' | 'friends'): Promise<void> {
		await sessionManager.setVisibility(visibility);
		await refreshSession();
	}

	async function setSessionName(name: string): Promise<void> {
		await sessionManager.setSessionName(name);
		await refreshSession();
	}

	// ---------------------------------------------------------------------------
	// Cleanup
	// ---------------------------------------------------------------------------

	function cleanup(): void {
		unsubscribeFromSessionData();
		if (publicSessionsUnsubscribe) {
			publicSessionsUnsubscribe();
		}
	}

	// ---------------------------------------------------------------------------
	// Return State Object
	// ---------------------------------------------------------------------------

	return {
		// Getters (reactive)
		get isInSession() {
			return isInSession;
		},
		get currentSession() {
			return currentSession;
		},
		get isHost() {
			return isHost;
		},
		get inviteLink() {
			return inviteLink;
		},
		get remotePlayers() {
			return remotePlayers;
		},
		get playerCount() {
			return playerCount;
		},
		get chatMessages() {
			return chatMessages;
		},
		get unreadCount() {
			return unreadCount;
		},
		get isSessionDrawerOpen() {
			return isSessionDrawerOpen;
		},
		get isChatOpen() {
			return isChatOpen;
		},
		get isMinimapExpanded() {
			return isMinimapExpanded;
		},
		get publicSessions() {
			return publicSessions;
		},
		get isLoadingPublicSessions() {
			return isLoadingPublicSessions;
		},

		// Session management
		createSession,
		joinSession,
		leaveSession,
		refreshSession,

		// Position updates
		updateLocalPosition,
		updateInterpolation,

		// Chat
		sendMessage,
		markChatAsRead,

		// Public sessions
		loadPublicSessions,
		subscribeToPublicSessions,

		// UI state
		openSessionDrawer,
		closeSessionDrawer,
		toggleChat,
		openChat,
		closeChat,
		toggleMinimap,

		// Host actions
		kickPlayer,
		setSessionVisibility,
		setSessionName,

		// Cleanup
		cleanup
	};
}

// ============================================================================
// Type Export
// ============================================================================

export type MultiplayerStateInstance = ReturnType<typeof createMultiplayerState>;
