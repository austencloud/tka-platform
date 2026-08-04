# Gated Cloudflare Pages Deploy

## Why this exists

Cloudflare Pages builds `tkaflowarts.com` from its own Git integration. That
integration fires on every push to `main` and has no knowledge of GitHub
Actions, so a red test suite still shipped to production. On 2026-07-21 `main`
had 41 failing unit tests while continuing to deploy normally.

`.github/workflows/pages-deploy.yml` closes that gap.

## The shape of the fix (and why not the obvious one)

The obvious fix — move the build into GitHub Actions and `wrangler pages deploy`
— is **wrong here**. The production build environment lives in the Cloudflare
dashboard. `.env.example`, which both CI workflows copy to `.env`, ships blank
values by design:

> Leave them blank to disable the features — the app handles missing values
> gracefully.

Building in Actions from that file would deploy production with PostHog, Google
Maps, and anything else keyed off a `PUBLIC_*` var silently disabled. Nothing
would fail; the site would just quietly lose analytics and maps.

So Cloudflare keeps doing the build exactly as it does today. Only the
**trigger** moves behind the CI gate, via a Deploy Hook.

```
push to main
   └─> Web App CI  (typecheck, 5.1k unit tests, build, offline-kit verify)
          └─> [green?] ──no──> stop
                 └──yes──> pages-deploy.yml POSTs the Deploy Hook
                              └─> Cloudflare builds and deploys
```

## One-time setup

Both steps are in the Cloudflare dashboard, on the Pages project backing
`tkaflowarts.com`.

### 1. Stop `main` from auto-deploying

Pages project → **Settings** → build/branch configuration → **production branch
control**. Turn off automatic production-branch builds.

Reference: [Pages branch build controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/#production-branch-control)

Leave preview/non-production branch builds however you like — this gate is only
about production.

### 2. Create a Deploy Hook for `main`

Same settings area → **Deploy Hooks** → create one bound to branch `main`. Copy
the URL it gives you; it is shown once and is a **credential** — anyone with it
can trigger a production build.

Reference: [Deploy Hooks](https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/)

Then store it:

```sh
gh secret set CLOUDFLARE_PAGES_DEPLOY_HOOK_URL --repo austencloud/tka-platform
# paste the URL when prompted
```

### 3. Verify before trusting it

Do not assume the wiring works. Run the workflow manually and confirm a build
actually appears in the Cloudflare dashboard:

```sh
gh workflow run "Deploy Pages (gated)" --repo austencloud/tka-platform
gh run list --workflow "Deploy Pages (gated)" --repo austencloud/tka-platform --limit 1
```

**Specifically confirm that a paused production branch still accepts
hook-triggered builds.** Pausing production builds and triggering by hook are
separate mechanisms and the interaction is not documented explicitly. If the
hook is refused while the branch is paused, the fallback is to leave automatic
builds on and instead gate by having the deploy command upload a version without
promoting it — see the note on `wrangler versions upload` in the
[Workers Builds docs](https://developers.cloudflare.com/workers/ci-cd/builds/).

Until step 3 passes, production is not deploying at all. Do not walk away
between step 1 and step 3.

## Known limits

- **The hook builds the branch tip, not a pinned SHA.** A Deploy Hook triggers a
  build of whatever `main` currently points at. If `main` moves between CI
  passing and the hook firing, Cloudflare builds the newer commit. The workflow
  logs the CI-validated SHA in the run summary so a mismatch is visible rather
  than silent. The OTA workflow (`capgo-deploy.yml`) does not share this
  limitation — it checks out `workflow_run.head_sha` directly.
- **`web-ci.yml` has `paths-ignore`** for `desktop/**`, `docs/**`, and `*.md`.
  A push touching only those never runs CI, so it never triggers a deploy
  either. That is intended — but it means a docs-only change will not refresh
  the site.
- **The gate is only as good as the suite.** `component-tests` in `web-ci.yml`
  is still `continue-on-error: true`, so browser-mode failures do not block a
  deploy. Promoting it to blocking is a separate decision — see
  `.claude/rules/component-test-discipline.md`, which deliberately keeps it
  non-blocking until it earns the gate.

## A red CI run on `main` is a production outage

The gate's failure mode is silence. `Deploy Pages (gated)` runs on
`workflow_run` and exits `skipped` when the conclusion isn't `success` — which
is not a failure, sends no notification, and appears in the run list as a
perfectly ordinary entry. Production simply keeps serving the last green build
while `main` moves on, and nothing anywhere says so.

This has bitten twice. On 2026-08-04 a single `blob.arrayBuffer is not a
function` failure under jsdom held five days of commits off `tkaflowarts.com`;
it was found only because the site looked stale to a human.

`web-ci.yml` now ends with a `Say that production did not deploy` step, guarded
by `if: failure() && github.event_name == 'push' && github.ref ==
'refs/heads/main'`. It emits an error annotation and a run-summary block
spelling out that no build was queued and that every commit on `main` — not
just the failing one — is stranded until the suite is green.

It changes no behavior. A red run on `main` already meant this; the step makes
it legible in the failure the developer is already looking at.

**Corollary:** treat "CI is red on `main`" as a shipping incident, not a
housekeeping task. The fix is always the same — make `main` green and the
deploy fires itself.

## Escape hatch

`workflow_dispatch` is enabled on both deploy workflows. If CI is broken and you
need to ship anyway:

```sh
gh workflow run "Deploy Pages (gated)" --repo austencloud/tka-platform
gh workflow run "Deploy OTA Update"   --repo austencloud/tka-platform
```

Both skip the CI-conclusion check when dispatched manually, by design.

## Related

- `.github/workflows/pages-deploy.yml` — this gate
- `.github/workflows/capgo-deploy.yml` — the same gate for the OTA bundle
- `.github/workflows/web-ci.yml` — the check both gate on
- Memory: `reference_cf_pages_deploy_topology`, `reference_cf_worker_size_limit`
