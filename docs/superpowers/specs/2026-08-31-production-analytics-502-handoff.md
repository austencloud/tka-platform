# Production analytics 502 credential rotation - Handoff (2026-08-31)

## Mission

Restore live production analytics at `tkaflowarts.com`. The admin analytics route returned 502 because its PostHog personal API key was no longer accepted. The credential has been rotated and saved locally and in Cloudflare; the remaining work is to redeploy the current production build and prove the authenticated production request succeeds.

## Done - verified

- Diagnosed the upstream failure (commit: not applicable, external runtime evidence). On 2026-08-31, direct PostHog API checks using the previous local `POSTHOG_PERSONAL_API_KEY` returned HTTP 403 with `authentication_failed` from both `https://us.i.posthog.com/api` and `https://us.posthog.com/api`. PostHog US status reported the query API operational.
- Rolled the PostHog personal API key named `TKA production app admin` (commit: not applicable, PostHog account state). Browser evidence on 2026-08-31 showed a newly generated `phx_` key with length 52. The previous key stopped working immediately.
- Replaced `POSTHOG_PERSONAL_API_KEY` in `C:\tka-platform\.env` (commit: not applicable, gitignored local secret). A read-back check on 2026-08-31 found exactly one matching entry, length 52, equal to the newly rolled key.
- Replaced the Cloudflare Pages production secret `POSTHOG_PERSONAL_API_KEY` for project `tka-platform` (commit: not applicable, Cloudflare account state). After Save, the production Variables and secrets row returned to `Value encrypted` and no editable value field remained.

## Believed done - unverified

- Cloudflare has stored the intended replacement value. The dashboard confirms the secret was saved and encrypted, but Cloudflare does not reveal secret values after saving.
- The credential-only change should restore the route after a new production deployment. No fresh production deployment or authenticated live analytics query has run yet.

## In flight

- Branch: `codex/fix-prod-analytics-502`
- Worktree: `C:\tka-platform-analytics-502`
- The branch owns only this handoff document. No application source files were changed.
- The valid replacement key is intentionally absent from Git. On this machine it is stored only in the gitignored `C:\tka-platform\.env` and in the Cloudflare encrypted production secret.

## Loose ends (ranked)

1. Redeploy the current successful Cloudflare Pages production deployment for commit `b9a927bee2` (`fix(glossary): preserve landing morph on gate`). Do not deploy an unrelated newer commit just to rotate the secret.
2. Verify the local credential with a minimal PostHog query such as `SELECT 1`; record the HTTP status without printing the key.
3. In the signed-in Chrome session, open the production admin analytics UI and prove the live request no longer returns 502. Capture the response status or visible analytics result. A successful build or saved-secret message is not sufficient proof.
4. If production still returns 502, inspect the Cloudflare Pages Function logs for `/api/admin/analytics` before changing source. The current evidence points to authentication, not the hardcoded PostHog API base URL.
5. Update this handoff with the deployment ID and runtime proof, then close the task.

## Decisions already made

- On 2026-08-31, Austen explicitly approved rolling the existing `TKA production app admin` key and putting the replacement into the Cloudflare encrypted production secret.
- On 2026-08-31, Austen confirmed the replacement should also go into local `.env`, not production only.
- Keep credentials out of Git and chat. The repository receives only this security-safe handoff.
- Treat this as an operational credential repair unless runtime evidence proves a source change is also required.

## Gotchas

- Do not roll the PostHog key again while `C:\tka-platform\.env` is available. Another rotation would immediately invalidate both the local value and the Cloudflare value just saved.
- Never print, log, commit, or paste the key into this document. Read it from the local gitignored `.env` only at the point of use.
- Cloudflare project: `tka-platform`; account ID: `0c0fb89b9dd972a61c30f0d43dd02b18`; production domains: `tkaflowarts.com` and `tka-landing.pages.dev`.
- The last successful production deployment visible during this work was `1fe9369e-f1c4-4bc4-92c8-f23c423e39a0` for commit `b9a927bee2`.
- Production automatic deployments are paused. Saving a Pages secret does not itself provide runtime proof; trigger or retry the existing production deployment explicitly.
- The browser tabs used for PostHog and Cloudflare are session-owned and may not be reclaimable by another agent. The local `.env` is the durable same-machine recovery point.
