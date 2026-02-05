/**
 * Connect Module - Constants
 *
 * Timeouts, limits, and configuration values.
 */

/**
 * Presence tracking configuration.
 */
export const PRESENCE_CONFIG = {
	/** How often to send heartbeat to maintain online status (ms) */
	HEARTBEAT_INTERVAL_MS: 30_000,

	/** How long before a user is considered offline if no heartbeat (ms) */
	OFFLINE_TIMEOUT_MS: 60_000,

	/** Debounce time for presence updates to avoid flicker (ms) */
	PRESENCE_DEBOUNCE_MS: 2_000
} as const;

/**
 * Session configuration.
 */
export const SESSION_CONFIG = {
	/** Maximum participants per session */
	MAX_PARTICIPANTS: 10,

	/** How long a session can be idle before auto-cleanup (ms) - 1 hour */
	IDLE_TIMEOUT_MS: 60 * 60 * 1000,

	/** How often to check for orphaned sessions (ms) */
	CLEANUP_INTERVAL_MS: 5 * 60 * 1000
} as const;

/**
 * Invite configuration.
 */
export const INVITE_CONFIG = {
	/** How long an invite remains valid (ms) - 5 minutes */
	EXPIRY_MS: 5 * 60 * 1000,

	/** Maximum pending invites per user (to prevent spam) */
	MAX_PENDING_PER_USER: 10,

	/** Cooldown between invites to the same user (ms) - 1 minute */
	COOLDOWN_MS: 60_000
} as const;

/**
 * Friend list configuration.
 */
export const FRIEND_CONFIG = {
	/** Maximum friends per user */
	MAX_FRIENDS: 500,

	/** Minimum characters for username search */
	MIN_SEARCH_LENGTH: 2,

	/** Maximum search results to return */
	MAX_SEARCH_RESULTS: 20
} as const;

/**
 * Sync configuration.
 */
export const SYNC_CONFIG = {
	/** Target sync accuracy (percentage) */
	TARGET_ACCURACY_PERCENT: 98,

	/** Maximum acceptable latency for sync (ms) */
	MAX_LATENCY_MS: 100,

	/** How often to broadcast state updates when playing (ms) */
	STATE_BROADCAST_INTERVAL_MS: 50
} as const;

/**
 * Firebase RTDB paths.
 */
export const FIREBASE_PATHS = {
	/** Presence data: /presence/{userId} */
	PRESENCE: 'presence',

	/** Sync sessions: /sync-sessions/{sessionId} */
	SESSIONS: 'sync-sessions',

	/** Invites: /invites/{recipientUserId}/{inviteId} */
	INVITES: 'invites',

	/** Friends: /friends/{userId}/{friendId} */
	FRIENDS: 'friends',

	/** Users (for search): /users/{userId} */
	USERS: 'users'
} as const;

/**
 * UI configuration.
 */
export const UI_CONFIG = {
	/** Animation duration for overlay transitions (ms) */
	OVERLAY_TRANSITION_MS: 300,

	/** Debounce time for user search input (ms) */
	SEARCH_DEBOUNCE_MS: 300,

	/** How long to show "connecting" state before timeout (ms) */
	CONNECT_TIMEOUT_MS: 10_000
} as const;
