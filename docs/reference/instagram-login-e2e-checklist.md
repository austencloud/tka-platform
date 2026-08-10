# Instagram Login: External Setup and Live Verification

The code path is implemented behind `INSTAGRAM_LOGIN_ENABLED` in
`src/lib/shared/auth/services/auth-providers.config.ts`. Keep that flag off until
this checklist passes against the real Meta app.

Instagram's current login API supports professional accounts only. A person
must use an Instagram creator or business account. TKA requests only
`instagram_business_basic`, uses the returned account ID to resolve a Firebase
user, and discards the access token after the callback.

## Registered URLs

Use these exact values. Do not add a trailing slash.

- OAuth redirect:
  `https://tkaflowarts.com/api/auth/instagram/callback`
- Deauthorization callback:
  `https://tkaflowarts.com/api/auth/instagram/deauthorize`
- Data deletion request and status callback:
  `https://tkaflowarts.com/api/auth/instagram/data-deletion`
- Manual account deletion: `https://tkaflowarts.com/delete-account`
- Privacy policy: `https://tkaflowarts.com/privacy`
- Terms: `https://tkaflowarts.com/terms`
- App domain: `tkaflowarts.com`

## 1. Meta app

Inspect the existing TKA Meta app before creating anything. Reuse it if it can
host Instagram API with Instagram Login. If not, create a Business app owned by
the correct TKA Business Portfolio.

- Add Instagram API with Instagram Login.
- Configure the OAuth and deauthorization URLs above.
- Request only `instagram_business_basic`.
- Add Austen's creator or business Instagram account as a tester while the app
  is in development mode. Accept any pending tester invitation from Instagram.
- Complete Meta business verification and request Advanced Access for
  `instagram_business_basic` before opening login to people outside app roles.
- Fill in the public app domain, privacy policy, terms, and data deletion fields.
- Move the app to Live only after the role-based test succeeds.

Copy the Instagram App ID and App Secret once. Never put the secret in chat,
source control, screenshots, shell history, or a local `.env` file.

## 2. Firebase and Google Cloud

Firebase Authentication has no native Instagram provider switch. This project
uses verified Meta OAuth plus Firebase custom tokens, so no provider needs to be
enabled in Authentication settings.

Create these Secret Manager values in project `the-kinetic-alphabet`:

- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`

The matching functions bind only the secrets they use. Deploy these functions
and the Firestore rules:

```powershell
firebase deploy --only "functions:startInstagramAuth,functions:instagramAuthCallback,functions:completeInstagramAuth,functions:unlinkInstagramAuth,functions:instagramDeauthorizeCallback,functions:instagramDataDeletionCallback,functions:onAuthUserDeleted,functions:cleanupStaleAnonymousAccounts,firestore:rules"
```

In Google Cloud Console, add a Firestore TTL policy for collection group
`instagramOAuthStates`, field `expiresAt`. The code rejects state after ten
minutes; TTL removes expired documents later. Add the same field policy for
`instagramDataDeletionRequests`; those non-identifying confirmation records
expire after 30 days.

## 3. Cloudflare

No Instagram secret belongs in Cloudflare. The SvelteKit worker proxies the three
public Meta URLs to Firebase from `src/lib/server/auth/meta-oauth-proxy.ts`
(which also carries the posting flow's callback — see
`meta-posting-e2e-checklist.md`).
Deploy the current app build through the existing Cloudflare Pages pipeline.

Confirm that no cache rule or managed challenge intercepts
`/api/auth/instagram/*`. These checks must hit the worker:

- A GET to the callback without state returns the branded Instagram failure
  page with HTTP 400. It must not return the TKA SPA shell.
- A GET to the deauthorization URL returns HTTP 405 with `Allow: POST`.
- A GET to the data-deletion URL returns the public deletion instructions with
  HTTP 200. A signed Meta POST returns JSON containing `url` and
  `confirmation_code`; opening that URL shows the completed request without
  exposing an Instagram ID.
- Callback responses include `Cache-Control: no-store`.

## 4. Live test before enabling the button

Use an app-role Instagram creator or business account.

1. Temporarily enable `INSTAGRAM_LOGIN_ENABLED` on the deployment under test.
2. Start as a guest, save a sequence, then choose Instagram.
3. Confirm the Instagram consent page requests only basic professional profile
   access.
4. Approve. Confirm the popup closes, the auth sheet closes, and the saved
   sequence remains attached to the same uid.
5. Sign out and use Instagram again. Confirm it returns to that same uid.
6. Open Settings, Connected Accounts. Confirm Instagram appears and its linked
   state survives a reload.
7. Link Instagram to an existing Google or email account. Confirm the uid does
   not change.
8. Try connecting an Instagram identity already owned by another TKA account.
   Confirm TKA refuses the link. From a guest session with drafts, confirm the
   existing account opens and the draft import prompt appears.
9. Confirm an Instagram-only account cannot disconnect its only sign-in method.
   Add Google or email, then confirm Instagram can be disconnected.
10. Test account deletion with Instagram reauthentication.
11. Remove TKA from the Instagram account's authorized apps. Confirm the
    deauthorization function runs, refresh tokens are revoked, and a later
    Instagram authorization reconnects to the same uid.
12. From Meta's data-deletion test control, submit a signed deletion request.
    Confirm the response status URL reports completion. A linked multi-provider
    account must keep its TKA data but lose Instagram identifiers; an
    Instagram-only test account must be deleted.

Keep `INSTAGRAM_LOGIN_ENABLED = true` only when every item above has runtime
evidence. Capture the function log, callback response, Settings state, and uid
checks. Never capture the app secret or an Instagram access token.
