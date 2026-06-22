/**
 * Auth provider availability flags.
 *
 * FACEBOOK_LOGIN_ENABLED gates every interactive Facebook entry point (the
 * sign-in/sign-up button and the "Add Facebook" link in settings). It is OFF
 * until the Facebook login flow is confirmed working end to end — app review,
 * OAuth redirect URIs, popup + anonymous-upgrade paths all verified in prod.
 *
 * The underlying services (signInWithFacebook, upgradeAnonymousWithFacebook,
 * linkFacebookAccount, profile-picture-manager) stay intact, so re-enabling is
 * this single flag flip.
 */
export const FACEBOOK_LOGIN_ENABLED = false;
