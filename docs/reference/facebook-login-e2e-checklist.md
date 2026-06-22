# Facebook Login — End-to-End Verification Checklist

Facebook login is **disabled** in the UI behind
`FACEBOOK_LOGIN_ENABLED` (`src/lib/shared/auth/services/auth-providers.config.ts`).
The code pipeline is audited and test-covered. What remains before flipping that
flag to `true` is the external configuration + the real popup/consent flow —
none of it is visible from the codebase, so it must be confirmed by hand.

Work top to bottom. Every step has an explicit **PASS** criterion. Do not flip
the flag until all are green.

---

## What's already proven (no action needed)

- **Unit tests** — `tests/unit/auth/facebook-login.test.ts` (17 tests): branch
  selection, scopes (`email`+`public_profile`), guard clauses, collision
  hand-off, profile-picture skip logic, kill-switch. Run: `npm run test`.
- **Emulator e2e** — `tests/integration/auth-upgrade/facebook-upgrade.e2e.test.ts`
  (4 tests): fresh FB sign-in mints an account with the `facebook.com` provider,
  linking FB onto an anon preserves the uid, collision is detected with
  `auth/credential-already-in-use`, re-signin is idempotent. Run: `npm run test:e2e`
  (needs Java on PATH — `JAVA_HOME` already points at the Microsoft JDK 17).
- **CSP** — `img-src https:` permits the graph profile pic; `frame-src
  *.firebaseapp.com` covers the Firebase auth handler; COOP
  `same-origin-allow-popups` + COEP `unsafe-none` are set for popups
  (`src/hooks.server.ts`).
- **Domain verification** — `<meta name="facebook-domain-verification">` present
  in `src/app.html`.

The emulator CANNOT cover: the real popup window, the Facebook consent screen,
whether Facebook actually returns an email, the real graph profile-picture URL,
and the production OAuth redirect. Those are the steps below.

---

## 1. Firebase Console — provider config

- [ ] Console → Authentication → Sign-in method → **Facebook = Enabled**.
- [ ] **App ID** and **App secret** filled in (from the Facebook app, step 2).
- [ ] Copy the **OAuth redirect URI** shown there. It is:
      `https://the-kinetic-alphabet.firebaseapp.com/__/auth/handler`
      (paste it into Facebook in step 2).

**PASS:** Facebook shows as Enabled with a non-empty App ID.

## 2. Facebook Developer Console — app config

App: developers.facebook.com → your app.

- [ ] **Facebook Login** product is added.
- [ ] Facebook Login → Settings → **Valid OAuth Redirect URIs** contains
      `https://the-kinetic-alphabet.firebaseapp.com/__/auth/handler`.
- [ ] Settings → Basic → **App Domains** include `the-kinetic-alphabet.firebaseapp.com`
      and the production domains (`tkaflowarts.com`, `tka.run`).
- [ ] Settings → Basic → **Data Deletion Request URL** (or instructions) set —
      Facebook requires this before an app can go Live.
- [ ] **`email` permission**: Login → Permissions. `public_profile` is granted by
      default; **`email` needs Advanced Access**, which requires App Review.
      Until approved, only app Admins/Developers/Testers receive an email claim.
- [ ] **App Mode = Live** (top bar toggle). In Development mode, only listed
      test users can log in at all.

**PASS:** Redirect URI matches, app is Live, `email` has Advanced Access (or you
accept that early testers must be added as Test Users).

## 3. Local smoke test (popup mechanics, before going Live for everyone)

Add your own Facebook account as a **Test User / Developer** in the FB app so you
can log in while review is pending.

- [ ] In `auth-providers.config.ts`, temporarily set `FACEBOOK_LOGIN_ENABLED = true`.
- [ ] `npm run build && npm run preview` (or dev on :5174). Use a real served
      origin, not `file://`. Note: for OAuth the popup runs against the Firebase
      authDomain, so localhost works for the popup but the FB app must allow it.
- [ ] Open the auth sheet → click **Facebook**.

  - [ ] Popup opens to Facebook (no "URL blocked" / "can't load URL" — that error
        means the redirect URI in step 2 is wrong). **PASS:** consent screen shows.
  - [ ] Approve. Popup closes, you land signed in (sheet auto-closes). **PASS.**
  - [ ] DevTools console: no CSP violation, no `auth/argument-error`,
        no `auth/operation-not-allowed` (the last means provider not enabled in
        step 1). **PASS:** clean console.

## 4. Account + data verification

After a successful FB login:

- [ ] Settings → Connected Accounts shows **Facebook** as linked.
- [ ] Firestore `users/{uid}` has `facebookId` populated (proves
      `getProviderIds` → `createOrUpdateUserDocument` ran).
- [ ] Profile picture renders (not a broken image). If broken, the
      `graph.facebook.com/{uid}/picture` URL was rejected (finding F4) — fall back
      to the generated avatar is acceptable, a broken `<img>` is not.

**PASS:** linked + `facebookId` stored + avatar renders.

## 5. The collision case (now auto-resolved — F2/F3 implemented)

This is what breaks for real users; the emulator cannot fully exercise the popup
half, so verify by hand. The resolution flow is now implemented
(`pending-credential-link.ts` + `auth-state` auto-link).

- [ ] Create an account with **Google** using email `X`.
- [ ] Sign out. Attempt **Facebook** login with a FB account whose email is also `X`.
- [ ] Expected: the guidance message — "This email is already registered. Sign in
      with your original method (Google or email) and we'll connect Facebook
      automatically." The pending Facebook credential is stashed.
- [ ] Now sign in with **Google** (the original method). **PASS:** a "Facebook
      connected to your account." toast appears, and Settings → Connected Accounts
      shows BOTH Google and Facebook linked.
- [ ] Edge: after the collision message, sign in as a DIFFERENT account. **PASS:**
      Facebook is NOT linked onto the wrong account (the stash only applies to the
      matching email).

- [ ] Also test: anonymous guest with saved sequences → Facebook upgrade. Confirm
      the guest's sequences survive (linked-in-place uid) OR, on collision, the
      import prompt appears. If the FB email belongs to a different existing
      account, the pending credential is stashed and links on the next sign-in.

## 6. Mobile / in-app browser

- [ ] Open the site inside the Facebook or Instagram in-app browser. The
      in-app-browser detector (`in-app-browser-detector.ts`) should steer the user
      to open in a real browser — confirm the popup isn't silently failing there.

---

## Flip the switch

Only when 1–6 are green:

1. Set `FACEBOOK_LOGIN_ENABLED = true` in
   `src/lib/shared/auth/services/auth-providers.config.ts`.
2. Update the kill-switch unit test in `tests/unit/auth/facebook-login.test.ts`
   (the `expect(FACEBOOK_LOGIN_ENABLED).toBe(false)` guard) to expect `true`.
3. `npm run check && npm run test && npm run test:e2e`, commit.

## Code findings (from the audit) — status

- **F1** ✅ fixed — `linkFacebookAccount`/`linkGoogleAccount`/`signInWithGoogle`
  now use `getAuthInstance()` (HMR-safe).
- **F2** ✅ fixed — `account-exists-with-different-credential` now stashes the
  pending Facebook credential (`pending-credential-link.ts`) and auto-links it on
  the next successful sign-in (`auth-state`). Verify in step 5.
- **F3** ✅ fixed — `upgradeAnonymousWithFacebook` now stashes the pending
  credential on that code instead of throwing a bare generic error.
- **F4** ⏳ verify-only — graph profile-picture URL may 403; a broken `<img>`
  falls back to the generated avatar (no code change). Confirm in step 4.
