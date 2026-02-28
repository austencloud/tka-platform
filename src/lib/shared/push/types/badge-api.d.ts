/**
 * Badging API type declarations
 *
 * Extends the Navigator interface with setAppBadge/clearAppBadge methods.
 * Supported in Chromium-based browsers and Safari 17.4+.
 * https://developer.mozilla.org/en-US/docs/Web/API/Badging_API
 */
interface Navigator {
	setAppBadge(count?: number): Promise<void>;
	clearAppBadge(): Promise<void>;
}
