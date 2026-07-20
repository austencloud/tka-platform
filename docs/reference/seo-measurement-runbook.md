# Flow Arts Software SEO measurement

This experiment answers a narrow question: did the Flow Arts Software work
increase qualified Google visibility and bring people into a useful Composer
session?

The scorecard does not treat a traffic spike as proof. It compares a registered
28-day baseline with a 28-day primary window, corrects the change against pages
that followed a similar pre-change trend, then repeats the test for another 28
days. Search performance, indexing, Composer behavior, and AI Overview citations
stay separate until the final decision.

This is a controlled before-and-after study, not a randomized trial. A confirmed
result measures the deployed SEO package against pages with similar prior
trends. Concurrent campaigns, major sitewide changes, and search-engine updates
can still affect attribution. Search Console also withholds some query detail,
and each AI Overview audit is a point-in-time observation.

## What gets measured

| Evidence                   | Primary measure                                                                                     | Source                              |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Category ownership         | Impressions, clicks, CTR, and average position for `flow arts software` and registered query groups | Search Console                      |
| Page visibility            | Treatment-page search metrics relative to frozen controls                                           | Search Console                      |
| Indexing                   | Indexed verdict and Google-selected canonical for a stable URL sample                               | URL Inspection API                  |
| Product use                | Organic Composer launch, activation, and completion by session                                      | PostHog                             |
| Field performance          | Daily p75 LCP, INP, and CLS                                                                         | PostHog native `$web_vitals`        |
| AI Overview presence       | Fixed-query appearance and TKA citation rate                                                        | Manual query audit                  |
| Supplemental AI visibility | Impressions by page, country, date, and device when the report is available                         | Manual Search Console report export |

Google is rolling out a dedicated Generative AI performance report that covers
AI Overviews and AI Mode. It does not provide query-level citation positions, so
the fixed 20-query audit remains necessary. The report is also not available to
every property yet, and its exported totals are supplemental rather than a
decision gate in this experiment. See Google's [Generative AI performance
report reference](https://support.google.com/webmasters/answer/16984139).

## Experiment contract

The registered settings live in `config/seo-measurement.json`.

- Baseline: 28 complete days ending the day before production deployment.
- Primary window: 28 days beginning when Google first recrawls the canonical
  Composer page after deployment.
- Confirmation window: the next 28 days.
- Final-data lag: three days.
- Treatment: `/composer`, `/roots/software`, and canonical `/sequence/` URLs in
  the sitemap.
- Control candidates: indexed Level 1 guide pages.
- Control selection: baseline impressions, daily pre-trend correlation, and
  normalized slope. Treatment pages, control candidates, the inspection sample,
  and selected controls are written once to BigQuery. They do not change during
  the experiment, even when the sitemap changes.
- Search source: one source for all three windows. Do not compare an API baseline
  with a bulk-export primary window.
- AI Overview baseline: the latest complete 20-query audit in the 28-day
  baseline. Each decision window uses its own latest complete audit.
- AI audit context: signed out, English (United States), desktop, with the
  Google Search region set to United States.

The preregistered decision gates are:

- at least 100 treatment impressions in the evaluation window;
- at least 25% control-adjusted impression lift;
- at least 25% control-adjusted click lift;
- average position 3 or better for `flow arts software`;
- TKA listed as citation rank 1 for the `flow arts software` AI Overview;
- at least 90% of the inspected treatment sample indexed;
- at least 15% of Google organic Composer sessions activated;
- TKA cited in at least 50% of AI Overviews found in the audit grid.

A primary result becomes confirmed only when the second 28-day window clears the
same gates. Missing dates, truncated API days, zero baselines, absent controls,
missing baseline or current-window AI audits, and instrumentation gaps block a
win declaration. A partial or stale URL Inspection sample and missing PostHog
dates also block their respective gates.

## Metric definitions

Search Console position is impression-weighted. API rows use
`SUM(position * impressions) / SUM(impressions)`. Bulk-export rows use Google's
zero-based formula, `SUM(sum_position) / SUM(impressions) + 1`. CTR is always
`SUM(clicks) / SUM(impressions)`.

Control-adjusted count lift is a ratio of ratios:

```text
(treatment post / treatment pre) / median(control post / control pre) - 1
```

CTR uses a difference-in-differences percentage-point change. Position uses the
same calculation with the sign reversed, so a positive result means better
ranking. Ratios are withheld when their baseline is zero.

The PostHog funnel starts with a Google organic session whose entry page is
`/composer`:

1. Launch: `landing_cta_click` from Composer to `/create`.
2. Activation: a generated sequence with at least one step, or an autosave with
   at least one beat.
3. Completion: an explicit save, export, share, or copied link.

Steps must occur in order, in the same PostHog session, within 24 hours. Legacy
`sequence_save` data had autosave semantics, so conversion evidence before
`SEO_INSTRUMENTATION_START_DATE` is marked unavailable. Native `$web_vitals`
events remain valid for historical performance comparisons.

## One-time Google setup

The local credentials cannot perform these account-owner actions. Complete them
in Google Cloud and Search Console, then the collector can finish the setup.

### 1. Enable APIs

In project `the-kinetic-alphabet` (`664225703033`), enable:

- Search Console API
- BigQuery API
- BigQuery Storage API
- IAM Service Account Credentials API
- Security Token Service API

The current blocker is the disabled Search Console API. Its direct enablement
page is:

`https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview?project=664225703033`

### 2. Create the measurement identity and dataset

Create a service account named:

`seo-measurement@the-kinetic-alphabet.iam.gserviceaccount.com`

Create BigQuery dataset `seo_measurement` in location `US`. Grant the service
account:

- BigQuery Job User on project `the-kinetic-alphabet`;
- BigQuery Data Editor on dataset `seo_measurement`;
- BigQuery Data Viewer on dataset `searchconsole_tkaflowarts` after Search
  Console creates it.

The current local identity cannot create datasets. The verified error is
`bigquery.datasets.create permission denied`.

In Search Console, open `sc-domain:tkaflowarts.com`, then go to **Settings >
Users and permissions**. Add the service-account email as a full user. Google
documents the owner-controlled user flow in [Managing owners, users, and
permissions](https://support.google.com/webmasters/answer/7687615).

### 3. Start Search Console bulk export

Grant this Google-managed principal project-level BigQuery Job User and BigQuery
Data Editor roles:

`search-console-data-export@system.gserviceaccount.com`

Then open **Search Console > Settings > Bulk data export** and enter:

- Cloud project ID: `the-kinetic-alphabet`
- Dataset: `searchconsole_tkaflowarts`
- Location: `US`

Google says the first export can take up to 48 hours and does not backfill prior
dates. Keep `SEO_PERFORMANCE_SOURCE=api` for this experiment so baseline and
post-change windows use the same source. The bulk dataset becomes the source for
future experiments. See Google's [bulk export setup
steps](https://support.google.com/webmasters/answer/12917675) and [table
reference](https://support.google.com/webmasters/answer/12917991).

### 4. Connect GitHub without a stored Google key

Create a Workload Identity Pool named `github-actions` and an OIDC provider named
`github`. Map these claims:

```text
google.subject=assertion.sub
attribute.repository_id=assertion.repository_id
attribute.repository_owner_id=assertion.repository_owner_id
attribute.ref=assertion.ref
```

Use this provider condition:

```text
assertion.repository_id == '1006209244' &&
assertion.repository_owner_id == '68725581' &&
assertion.ref == 'refs/heads/main'
```

Grant the repository principal Workload Identity User on the dedicated service
account. The principal is:

```text
principalSet://iam.googleapis.com/projects/664225703033/locations/global/workloadIdentityPools/github-actions/attribute.repository_id/1006209244
```

The workflow uses `google-github-actions/auth` with GitHub's short-lived OIDC
token. No Google private key belongs in repository secrets. See the [official
authentication action](https://github.com/google-github-actions/auth).

## One-time PostHog setup

Create a dedicated personal API key with these scopes:

- `query:read`
- `dashboard:read`
- `dashboard:write`
- `insight:read`
- `insight:write`

The existing key can run HogQL, but its `insight:read` check returns HTTP 403.
The dashboard provisioner performs all permission and query checks before its
first write. With the required scopes, `pnpm run seo:posthog-dashboard --
--apply` creates or reconciles `SEO | Flow Arts Software` and its four managed
insights.

PostHog's current dashboard and insight endpoints are defined in its [OpenAPI
schema](https://us.posthog.com/api/schema/swagger-ui/).

## GitHub repository settings

Create these Actions variables:

| Variable                         | Value                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `SEO_MEASUREMENT_ENABLED`        | `true` after access verification passes                                                        |
| `GCP_PROJECT_ID`                 | `the-kinetic-alphabet`                                                                         |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/664225703033/locations/global/workloadIdentityPools/github-actions/providers/github` |
| `GCP_SEO_SERVICE_ACCOUNT`        | `seo-measurement@the-kinetic-alphabet.iam.gserviceaccount.com`                                 |
| `GSC_PROPERTY`                   | `sc-domain:tkaflowarts.com`                                                                    |
| `GSC_EXPORT_DATASET`             | `searchconsole_tkaflowarts`                                                                    |
| `SEO_MEASUREMENT_DATASET`        | `seo_measurement`                                                                              |
| `SEO_PERFORMANCE_SOURCE`         | `api`                                                                                          |
| `POSTHOG_PROJECT_ID`             | the production project ID                                                                      |
| `SEO_DEPLOYMENT_DATE`            | production deployment date in Pacific Time                                                     |
| `SEO_INSTRUMENTATION_START_DATE` | first production date for the new funnel events                                                |
| `SEO_INDEXED_DATE`               | optional manual override; leave blank for inspection-based detection                           |

Create one Actions secret: `POSTHOG_PERSONAL_API_KEY`.

The scheduled workflow runs at 12:37 UTC. It stores metrics and scorecards only
in private BigQuery tables. GitHub logs contain completion and freshness status,
not queries, traffic counts, or report artifacts. Local reports are written to
the ignored `seo-reports/` directory. With the API source active, each run
repairs missing finalized Search Console dates from the registered baseline
onward. It also repairs missing PostHog dates from the instrumentation date and
refreshes the last three PostHog days to include late completion events.

## Launch procedure

1. Bootstrap the private tables with `pnpm run seo:bootstrap`.
2. Confirm all three providers with `pnpm run seo:verify-access`.
3. Backfill finalized Search Console data through the day before deployment.
4. Freeze the treatment, inspection, and matched-control cohorts before reading
   post-change results.
5. Complete the fixed AI Overview audit before the production deployment.
6. Register the production deployment and instrumentation dates in GitHub
   Actions variables.
7. Enable the scheduled workflow.
8. Repeat the AI Overview audit weekly with the same locale and device settings.

The URL Inspection collector samples all exact treatment pages plus a stable
hash-based selection of sequence pages. If the Composer verdict is `PASS`, its
Google canonical matches, and its last crawl occurred after deployment, the
scorecard uses that crawl date as the primary-window start. A configured
`SEO_INDEXED_DATE` overrides automatic detection.

## Operating commands

```bash
# Create or validate BigQuery tables
pnpm run seo:bootstrap

# Check Search Console, BigQuery, and PostHog without printing metrics
pnpm run seo:verify-access

# Backfill the API baseline
pnpm run seo:measure -- backfill --from YYYY-MM-DD --to YYYY-MM-DD

# Freeze page cohorts and matched controls against the registered baseline
pnpm run seo:measure -- freeze-controls

# Collect one daily cycle and store the scorecard
pnpm run seo:daily

# Produce a local scorecard from stored private data
pnpm run seo:scorecard

# Create and import the fixed AI Overview audit
pnpm run seo:measure -- ai-template --date YYYY-MM-DD
pnpm run seo:measure -- import-ai --file seo-reports/ai-overview-YYYY-MM-DD.csv
```

The Search Analytics API returns at most 25,000 rows per request and 50,000 rows
per day per search type. The collector paginates to the daily ceiling, records a
truncation flag, and blocks a decision when a day reaches that limit. Dates use
Pacific Time and requests use finalized data. Google also states that the API
returns top rows, not a guaranteed complete long tail. Treat the bulk export as
the canonical source once it is configured, even on API days below the ceiling.
See Google's [Search Analytics
method](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
and [usage limits](https://developers.google.com/webmaster-tools/limits).

## Reading a scorecard

`baseline` means deployment is not registered. `awaiting_indexing` means the
production date is known but a qualifying post-deployment crawl is not.
`collecting` means one of the 28-day windows is still open.

`incomplete_evidence` is not a loss. It means a required source, date, control,
or audit is missing and no available gate has already failed. `below_target`
means at least one registered gate definitively failed, even if another gate is
still pending. `primary_target_met` is the first win. Only
`confirmed_target_met` closes the experiment.
