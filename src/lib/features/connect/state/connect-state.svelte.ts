/**
 * Connect State
 *
 * Svelte 5 reactive state for the Connect module.
 * Bridges services with Svelte's reactivity system.
 */

import type { ConnectOrchestrator } from '../services/connect-orchestrator';
import type {
	SyncSession,
	SessionParticipant,
	Invite,
	Friend,
	DisplayPreference
} from '../domain/models/connect-models';

/**
 * Reactive state for Connect module.
 */
class ConnectState {
	// Session state
	private _currentSession = $state<SyncSession | null>(null);
	private _participants = $state<SessionParticipant[]>([]);
	private _isHost = $state(false);
	private _isSoloMode = $state(false);
	private _displayPreference = $state<DisplayPreference>('pictograph');

	// Discovery
	private _nearbySessions = $state<SyncSession[]>([]);

	// Invites
	private _pendingInvites = $state<Invite[]>([]);
	private _activeInviteOverlay = $state<Invite | null>(null);

	// Friends
	private _friends = $state<Friend[]>([]);
	private _onlineFriendIds = $state<Set<string>>(new Set());

	// Connection
	private _isInitialized = $state(false);
	private _isConnecting = $state(false);
	private _connectionError = $state<string | null>(null);
	private _isLoading = $state(false);
	private _currentUserId = $state<string | null>(null);

	// Orchestrator reference
	private orchestrator: ConnectOrchestrator | null = null;
	private unsubscribers: Array<() => void> = [];
	private _errorClearTimer: ReturnType<typeof setTimeout> | null = null;
	private _loadingTimer: ReturnType<typeof setTimeout> | null = null;

	// ==================== Getters ====================

	/** Whether in a sync session */
	get isInSession(): boolean {
		return this._currentSession !== null;
	}

	/** Current session */
	get currentSession(): SyncSession | null {
		return this._currentSession;
	}

	/** Whether current user is the host */
	get isHost(): boolean {
		return this._isHost;
	}

	/** Participants in current session */
	get participants(): SessionParticipant[] {
		return this._participants;
	}

	/** Whether in solo practice mode */
	get isSoloMode(): boolean {
		return this._isSoloMode;
	}

	/** Current display preference */
	get displayPreference(): DisplayPreference {
		return this._displayPreference;
	}

	/** Nearby sessions available to join */
	get nearbySessions(): SyncSession[] {
		return this._nearbySessions;
	}

	/** Number of pending invites */
	get pendingInviteCount(): number {
		return this._pendingInvites.length;
	}

	/** Pending invites */
	get pendingInvites(): Invite[] {
		return this._pendingInvites;
	}

	/** Active invite overlay (if showing) */
	get activeInviteOverlay(): Invite | null {
		return this._activeInviteOverlay;
	}

	/** All friends */
	get friends(): Friend[] {
		return this._friends;
	}

	/** Online friends only */
	get onlineFriends(): Friend[] {
		return this._friends.filter((f) => this._onlineFriendIds.has(f.userId));
	}

	/** Whether state is initialized */
	get isInitialized(): boolean {
		return this._isInitialized;
	}

	/** Whether currently connecting */
	get isConnecting(): boolean {
		return this._isConnecting;
	}

	/** Connection error message */
	get connectionError(): string | null {
		return this._connectionError;
	}

	/** Whether loading data */
	get isLoading(): boolean {
		return this._isLoading;
	}

	/** Current user's ID */
	get currentUserId(): string | null {
		return this._currentUserId;
	}

	// ==================== Initialization ====================

	/**
	 * Initialize with orchestrator instance.
	 */
	async initialize(orchestrator: ConnectOrchestrator): Promise<void> {
		if (this._isInitialized) {
			return;
		}

		this.orchestrator = orchestrator;

		// Subscribe to events
		this.unsubscribers.push(
			orchestrator.onInviteReceived((invite) => {
				this._pendingInvites = [...this._pendingInvites, invite];
				// Show overlay for new invite
				this._activeInviteOverlay = invite;
			})
		);

		this.unsubscribers.push(
			orchestrator.onSessionClosed((reason) => {
				this._currentSession = null;
				this._participants = [];
				this._isHost = false;
				this._isSoloMode = false;
				this._connectionError = `Session ended: ${reason}`;

				if (this._errorClearTimer !== null) clearTimeout(this._errorClearTimer);
				this._errorClearTimer = setTimeout(() => {
					this._errorClearTimer = null;
					this._connectionError = null;
				}, 5000);
			})
		);

		this.unsubscribers.push(
			orchestrator.onParticipantsChanged((participants) => {
				this._participants = participants;
			})
		);

		// Initialize orchestrator
		await orchestrator.initialize();

		// Get current user ID
		this._currentUserId = orchestrator.currentUserId;

		// Sync initial state
		this.syncFromOrchestrator();

		this._isInitialized = true;
	}

	// ==================== Session Actions ====================

	/**
	 * Start sharing a sequence.
	 */
	async startSharing(sequenceId: string, sequenceWord: string, sequenceData?: Record<string, unknown>): Promise<void> {
		if (!this.orchestrator) return;

		this._isConnecting = true;
		this._connectionError = null;

		try {
			await this.orchestrator.startSharing(sequenceId, sequenceWord, sequenceData);
			this.syncFromOrchestrator();
		} catch (error) {
			this._connectionError = error instanceof Error ? error.message : 'Failed to start sharing';
			throw error;
		} finally {
			this._isConnecting = false;
		}
	}

	/**
	 * Join a session.
	 */
	async joinSession(sessionId: string): Promise<void> {
		if (!this.orchestrator) return;

		this._isConnecting = true;
		this._connectionError = null;

		try {
			await this.orchestrator.joinSession(sessionId);
			this.syncFromOrchestrator();
		} catch (error) {
			this._connectionError = error instanceof Error ? error.message : 'Failed to join session';
			throw error;
		} finally {
			this._isConnecting = false;
		}
	}

	/**
	 * Leave current session.
	 */
	async leaveSession(): Promise<void> {
		if (!this.orchestrator) return;

		try {
			await this.orchestrator.leaveSession();
			this.syncFromOrchestrator();
		} catch (error) {
			this._connectionError = error instanceof Error ? error.message : 'Failed to leave session';
			// Resync so the UI reflects the actual post-failure state rather
			// than optimistically clearing the session. The service surfaces a
			// toast.error; we re-sync from the (still-present) session node.
			this.syncFromOrchestrator();
		}
	}

	/**
	 * Toggle solo practice mode.
	 */
	async toggleSoloMode(): Promise<void> {
		if (!this.orchestrator) return;

		await this.orchestrator.toggleSoloMode();
		this._isSoloMode = this.orchestrator.isSoloMode;
	}

	/**
	 * Set display preference.
	 */
	async setDisplayPreference(preference: DisplayPreference): Promise<void> {
		if (!this.orchestrator) return;

		await this.orchestrator.setDisplayPreference(preference);
		this._displayPreference = preference;
	}

	// ==================== Invite Actions ====================

	/**
	 * Invite a user to current session.
	 */
	async inviteUser(userId: string): Promise<void> {
		if (!this.orchestrator) return;
		await this.orchestrator.inviteUser(userId);
	}

	/**
	 * Accept a pending invite.
	 */
	async acceptInvite(inviteId: string): Promise<void> {
		if (!this.orchestrator) return;

		this._isConnecting = true;
		this._connectionError = null;

		try {
			await this.orchestrator.acceptInvite(inviteId);
			this._pendingInvites = this._pendingInvites.filter((i) => i.inviteId !== inviteId);
			this._activeInviteOverlay = null;
			this.syncFromOrchestrator();
		} catch (error) {
			this._connectionError = error instanceof Error ? error.message : 'Failed to accept invite';
			throw error;
		} finally {
			this._isConnecting = false;
		}
	}

	/**
	 * Decline a pending invite.
	 */
	async declineInvite(inviteId: string): Promise<void> {
		if (!this.orchestrator) return;

		await this.orchestrator.declineInvite(inviteId);
		this._pendingInvites = this._pendingInvites.filter((i) => i.inviteId !== inviteId);

		// If this was the overlay invite, close it
		if (this._activeInviteOverlay?.inviteId === inviteId) {
			this._activeInviteOverlay = null;
		}
	}

	/**
	 * Show an invite in the overlay.
	 */
	showInviteOverlay(invite: Invite): void {
		this._activeInviteOverlay = invite;
	}

	/**
	 * Dismiss the invite overlay without accepting/declining.
	 */
	dismissInviteOverlay(): void {
		this._activeInviteOverlay = null;
	}

	// ==================== Friend Actions ====================

	/**
	 * Search for users.
	 */
	async searchUsers(query: string) {
		if (!this.orchestrator) return [];
		return this.orchestrator.searchUsers(query);
	}

	/**
	 * Add a friend.
	 */
	async addFriend(userId: string, displayName: string): Promise<void> {
		if (!this.orchestrator) return;
		await this.orchestrator.addFriend(userId, displayName);
		this.syncFriendsFromOrchestrator();
	}

	/**
	 * Remove a friend.
	 */
	async removeFriend(userId: string): Promise<void> {
		if (!this.orchestrator) return;
		await this.orchestrator.removeFriend(userId);
		this.syncFriendsFromOrchestrator();
	}

	// ==================== Refresh ====================

	/**
	 * Force refresh nearby sessions and friends.
	 */
	refresh(): void {
		if (!this.orchestrator) return;
		this._isLoading = true;

		// Sync state from orchestrator
		this.syncFromOrchestrator();

		if (this._loadingTimer !== null) clearTimeout(this._loadingTimer);
		this._loadingTimer = setTimeout(() => {
			this._loadingTimer = null;
			this._isLoading = false;
		}, 500);
	}

	// ==================== Cleanup ====================

	/**
	 * Clean up state and subscriptions.
	 */
	cleanup(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];

		this.orchestrator?.destroy();
		this.orchestrator = null;

		// Reset state
		this._currentSession = null;
		this._participants = [];
		this._isHost = false;
		this._isSoloMode = false;
		this._nearbySessions = [];
		this._pendingInvites = [];
		this._activeInviteOverlay = null;
		this._friends = [];
		this._onlineFriendIds = new Set();
		this._isInitialized = false;
		this._isConnecting = false;
		this._connectionError = null;

		if (this._errorClearTimer !== null) {
			clearTimeout(this._errorClearTimer);
			this._errorClearTimer = null;
		}
		if (this._loadingTimer !== null) {
			clearTimeout(this._loadingTimer);
			this._loadingTimer = null;
		}
	}

	// ==================== Private Helpers ====================

	private syncFromOrchestrator(): void {
		if (!this.orchestrator) return;

		this._currentSession = this.orchestrator.currentSession;
		this._participants = this.orchestrator.participants;
		this._isHost = this.orchestrator.isHost;
		this._isSoloMode = this.orchestrator.isSoloMode;
		this._displayPreference = this.orchestrator.displayPreference;
		this._nearbySessions = this.orchestrator.nearbySessions;
		this._pendingInvites = this.orchestrator.getPendingInvites();

		this.syncFriendsFromOrchestrator();
	}

	private syncFriendsFromOrchestrator(): void {
		if (!this.orchestrator) return;

		this._friends = this.orchestrator.getFriends();
		const onlineFriends = this.orchestrator.onlineFriends;
		this._onlineFriendIds = new Set(onlineFriends.map((f) => f.userId));
	}
}

/** Global singleton state for Connect module */
export const connectState = new ConnectState();
