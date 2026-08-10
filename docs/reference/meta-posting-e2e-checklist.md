# Posting to Instagram and Facebook: External Setup and Live Verification

This covers the **share sheet's direct post** (Phase 2 of
`docs/superpowers/specs/active/2026-08-09-social-post-handoff-design.md`), not
Instagram sign-in. The two flows share a Meta app and a worker proxy and nothing
else: sign-in reads a profile and throws the token away; posting stores a
long-lived token and publishes media. Sign-in has its own checklist in
`instagram-login-e2e-checklist.md`.

Everything below is Austen's to do. The code is written, tested, and merged; it
cannot work until the Meta app grants these permissions, and **app review is the
long pole** — budget days, not minutes.

## What the flow needs to be true

- The Instagram account is a **Business or Creator** account. Personal accounts
  cannot publish through the API at all.
- That Instagram account is **linked to a Facebook Page** you administer.
- Posting is only offered to a signed-in, non-anonymous TKA account.

## Registered URL

One new redirect, alongside the sign-in ones. Exact value, no trailing slash:

- OAuth redirect: `https://tkaflowarts.com/api/share/meta/callback`

`src/lib/server/auth/meta-oauth-proxy.ts` proxies it to the
`metaConnectCallback` function. It accepts GET only.

## 1. Meta app

Use the existing TKA Meta app if it can host both products; otherwise the
posting products can live in their own Business app.

Add and configure:

- **Instagram API with Instagram Login** — add the redirect URL above to the
  OAuth redirect list, next to the sign-in one.
- **Facebook Login** — same redirect URL in Valid OAuth Redirect URIs.

Permissions to request in App Review:

| Product | Permission | What it buys |
|---|---|---|
| Instagram | `instagram_business_basic` | the username shown on the connected chip |
| Instagram | `instagram_business_content_publish` | the post itself — **review-gated** |
| Facebook | `pages_show_list` | the list of Pages you pick from |
| Facebook | `pages_read_engagement` | reading the Page name |
| Facebook | `pages_manage_posts` | posting a photo — **review-gated** |
| Facebook | `publish_video` | posting a reel — **review-gated** |

The scopes are requested together on first connect, so consent happens once.
While the app is in development mode, add your own Instagram and Facebook
accounts as app testers and accept the invitations — role-based access works
before review and is how you test all of this.

Copy the Facebook App ID and App Secret once. Never put the secret in chat,
source control, screenshots, shell history, or a local `.env`.

## 2. Firebase

Add to Secret Manager in project `the-kinetic-alphabet`:

- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`

Already present and reused: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`,
`R2_PUBLIC_URL`.

Deploy the functions and the rules. **Function deploys are manual** — pushing to
`main` deploys the site, not the functions:

```powershell
firebase deploy --only "functions:startMetaConnect,functions:metaConnectCallback,functions:completeMetaConnect,functions:disconnectMetaAccount,functions:selectMetaFacebookPage,functions:refreshMetaPublishStatus,functions:publishToMeta,functions:refreshMetaPublishTokens,firestore:rules"
```

`refreshMetaPublishTokens` is a scheduled function (every 24h) and needs Cloud
Scheduler enabled on the project. It re-mints Instagram long-lived tokens inside
their last week; without it, posting silently stops working after 60 days.

In Google Cloud Console add a Firestore TTL policy for collection group
`metaConnectStates`, field `expiresAt`. The handshake rejects state after its
lifetime anyway; TTL just sweeps the documents.

Three collections back this feature, and the rules already say so:

- `metaConnectStates/{state}` — owner-readable handshake status, no credentials.
- `metaPublishConnections/{uid}` — **the access tokens. Admin SDK only; no client
  read path exists and none should be added.**
- `metaPublishStatus/{uid}` — token-free mirror (which accounts, what names, what
  expiry) that the share sheet subscribes to.

## 3. Cloudflare

No Meta secret belongs in Cloudflare. Confirm nothing caches or challenges
`/api/share/meta/callback`, the same way `/api/auth/instagram/*` was checked. A
GET without state must return the branded failure page, not the SPA shell.

## 4. Live test, in this order

Use an app-role account while the app is still in development mode.

1. Open a saved sequence in the viewer, then Share. With nothing connected, the
   sheet shows the handoff row and two connect chips.
2. **Connect Instagram.** The consent screen must ask for basic + content
   publish. Approve; the popup closes and the sheet grows a "Post to Instagram
   @yourname" button with no reload.
3. **Connect a Facebook Page.** Approve; pick a Page. With more than one Page,
   the setup row shows a Page chip whose menu switches Pages.
4. Post the **card** to Instagram. It uploads, posts, and the button turns into
   "View post". Open the permalink; confirm the caption carries the word, the
   `tka.run` link, and the hashtags you left in the textarea.
5. Post the **video** to Instagram. Expect a wait: Meta processes a reel
   asynchronously and the sheet says so while it polls.
6. Post both artifacts to the Page.
7. Edit the caption before posting and confirm the edit is what lands.
8. **Disconnect Instagram**, reload, confirm it stays disconnected and the
   handoff row comes back.
9. Revoke TKA from the Instagram account's authorized apps directly, then try to
   post. Expect the "connection expired, reconnect" message rather than a
   silent failure.

Only after all nine pass with an app-role account: submit for App Review with a
screencast of steps 2–6, then move the app to Live.

## What breaks it later

- A **personal** Instagram account, or an Instagram account unlinked from its
  Page. Both produce a connect-time error, not a post-time one.
- Letting the scheduled refresh function fail for a week — tokens age out.
- Publishing a video that is not H.264 MP4. Both viewer encoders emit MP4 and
  the sheet refuses anything else before uploading, so this only matters if a
  new export path appears.
- Instagram's own rate limit is 50 posts per 24 hours per account.

## Related

- `docs/reference/instagram-login-e2e-checklist.md` — the sign-in flow
- `docs/superpowers/specs/active/2026-08-09-social-post-handoff-design.md`
- `firebase-functions/src/share/` — connect, publish, refresh, policy
- `src/lib/shared/share/services/meta-publish.ts` — the client seam
