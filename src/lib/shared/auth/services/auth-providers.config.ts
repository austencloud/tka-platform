/**
 * Auth provider availability flags.
 *
 * FACEBOOK_LOGIN_ENABLED gates every interactive Facebook entry point (the
 * sign-in/sign-up button and the "Add Facebook" link in settings).
 *
 * Enabled 2026-06-22 after the real Facebook flow was verified end to end via
 * /test/facebook-login (popup + consent + account creation). Set back to false
 * to pull the entry points if Facebook auth regresses; the underlying services
 * stay intact either way.
 */
export const FACEBOOK_LOGIN_ENABLED = true;

/**
 * Instagram uses Meta's professional-account OAuth plus Firebase custom auth.
 * Keep entry points hidden until the Meta app, Firebase secrets, production
 * functions, and Cloudflare callback have passed the live checklist.
 */
export const INSTAGRAM_LOGIN_ENABLED = false;
