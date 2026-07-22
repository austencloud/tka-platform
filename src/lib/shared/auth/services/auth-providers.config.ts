/**
 * Auth provider availability flags.
 *
 * FACEBOOK_LOGIN_ENABLED gates every interactive Facebook entry point (the
 * sign-in/sign-up button and the "Add Facebook" link in settings).
 *
 * Disabled 2026-07-22 after a non-role account completed Meta consent but was
 * rejected because the app is not publicly available. Re-enable only after a
 * non-role account completes the production flow end to end; the underlying
 * services stay intact either way.
 */
export const FACEBOOK_LOGIN_ENABLED = false;

/**
 * Instagram uses Meta's professional-account OAuth plus Firebase custom auth.
 * Keep entry points hidden until the Meta app, Firebase secrets, production
 * functions, and Cloudflare callback have passed the live checklist.
 */
export const INSTAGRAM_LOGIN_ENABLED = false;
