/**
 * Username Validation Domain Models
 *
 * Defines validation rules, reserved usernames, and helper functions
 * for enforcing unique usernames across Flow Arts Composer.
 */

export interface UsernameValidationResult {
	isValid: boolean;
	error?: string;
	suggestions?: string[];
}

export const USERNAME_RULES = {
	MIN_LENGTH: 3,
	MAX_LENGTH: 20,
	/** Allowed: letters, numbers, underscore, hyphen */
	PATTERN: /^[a-zA-Z0-9_-]+$/,
	/** Reserved system usernames (lowercase) */
	RESERVED: [
		// System accounts
		'admin',
		'administrator',
		'support',
		'help',
		'system',
		'root',
		'moderator',
		'mod',
		'staff',
		'official',
		'bot',
		// Brand-related
		'tka',
		'thekineticalphabet',
		'kinetic',
		'alphabet',
		'scribe',
		'tkascribe',
		'composer',
		'tkacomposer',
		'tkaflowarts',
		// Technical
		'api',
		'null',
		'undefined',
		'deleted',
		'anonymous',
		'guest',
		'user',
		'users',
		// Common
		'test',
		'demo',
		'example',
		'info',
		'contact',
		'team',
		'service',
		'account',
		'settings',
		'profile',
		'login',
		'signup',
		'register'
	]
} as const;

/**
 * Normalize username to lowercase for case-insensitive comparison
 */
export function formatUsername(username: string): string {
	return username.toLowerCase().trim();
}

/**
 * Validate username format (synchronous - no Firestore calls)
 */
export function validateUsernameFormat(username: string): UsernameValidationResult {
	const trimmed = username.trim();

	if (!trimmed) {
		return {
			isValid: false,
			error: 'Username is required'
		};
	}

	if (trimmed.length < USERNAME_RULES.MIN_LENGTH) {
		return {
			isValid: false,
			error: `Username must be at least ${USERNAME_RULES.MIN_LENGTH} characters`
		};
	}

	if (trimmed.length > USERNAME_RULES.MAX_LENGTH) {
		return {
			isValid: false,
			error: `Username must be no more than ${USERNAME_RULES.MAX_LENGTH} characters`
		};
	}

	if (!USERNAME_RULES.PATTERN.test(trimmed)) {
		return {
			isValid: false,
			error: 'Username can only contain letters, numbers, underscores, and hyphens'
		};
	}

	// Check reserved usernames
	const lower = formatUsername(trimmed);
	if ((USERNAME_RULES.RESERVED as readonly string[]).includes(lower)) {
		return {
			isValid: false,
			error: 'This username is reserved'
		};
	}

	// Check doesn't start/end with special chars
	if (trimmed.startsWith('-') || trimmed.startsWith('_')) {
		return {
			isValid: false,
			error: 'Username cannot start with a hyphen or underscore'
		};
	}

	if (trimmed.endsWith('-') || trimmed.endsWith('_')) {
		return {
			isValid: false,
			error: 'Username cannot end with a hyphen or underscore'
		};
	}

	return { isValid: true };
}
