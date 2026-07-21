import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSeoCohorts, parseSitemapUrls } from "../../scripts/seo/cohorts";
import { loadSeoMeasurementConfig } from "../../scripts/seo/config";
import {
  aggregateFunnelMetrics,
  aggregateSearchMetrics,
  buildExperimentWindows,
  calendarDateInTimeZone,
  contiguousDateRanges,
  controlAdjustedDelta,
  controlAdjustedLift,
  rangeEndingAt,
  selectMatchedControls,
  type SearchMetricRow,
} from "../../scripts/seo/core";
import {
  buildSeoFunnelQuery,
  buildWebVitalsQuery,
} from "../../scripts/seo/posthog";
import { getPostHogDashboardSpec } from "../../scripts/seo/provision-posthog-dashboard";
import { buildSeoScorecard } from "../../scripts/seo/scorecard";
import {
  buildSeoDashboardSnapshot,
  buildSeoSnapshotEvent,
} from "../../scripts/seo/dashboard-snapshot";
import { parseSeoHistoryRows } from "../../src/lib/features/admin/domain/models/seo-dashboard-model";
import {
  buildBulkSearchQuery,
  getWarehouseTableFieldNames,
} from "../../scripts/seo/warehouse";

const config = loadSeoMeasurementConfig();

function searchRow(
  date: string,
  page: string,
  impressions: number,
  clicks: number,
  position: number,
  query: string | null = null
): SearchMetricRow {
  return {
    date,
    page,
    query,
    country: "usa",
    device: "DESKTOP",
    clicks,
    impressions,
    position,
  };
}

describe("SEO measurement math", () => {
  it("normalizes, sorts, and deduplicates dashboard history rows", () => {
    const history = parseSeoHistoryRows([
      [
        "2026-06-08T02:00:00.000Z",
        "2026-06-08T00:00:00Z",
        "primary_collecting",
        "collecting",
        "8.2",
        "140",
        "0.4",
        null,
        "0.8",
      ],
      [
        "2026-06-07T02:00:00.000Z",
        "2026-06-07",
        "primary_collecting",
        "collecting",
        "9.1",
        "100",
        "0.25",
        null,
        "0.6",
      ],
      [
        "2026-06-08T03:00:00.000Z",
        "2026-06-08",
        "primary_complete",
        "primary_target_met",
        "7.4",
        "160",
        "0.5",
        "1",
        "1",
      ],
    ]);

    expect(history).toHaveLength(2);
    expect(history.map((point) => point.generatedDate)).toEqual([
      "2026-06-07",
      "2026-06-08",
    ]);
    expect(history[1]).toMatchObject({
      capturedAt: "2026-06-08T03:00:00.000Z",
      phase: "primary_complete",
      decisionStatus: "primary_target_met",
      headTermPosition: 7.4,
      treatmentImpressions: 160,
      organicActivationRate: 0.5,
      aiCitationRate: 1,
      indexedRate: 1,
    });
  });

  it("uses Pacific calendar dates across daylight-saving boundaries", () => {
    expect(
      calendarDateInTimeZone(
        new Date("2026-03-08T07:30:00.000Z"),
        "America/Los_Angeles"
      )
    ).toBe("2026-03-07");
    expect(
      calendarDateInTimeZone(
        new Date("2026-03-08T08:30:00.000Z"),
        "America/Los_Angeles"
      )
    ).toBe("2026-03-08");
  });

  it("locks baseline, primary, and confirmation windows to registered dates", () => {
    const windows = buildExperimentWindows(
      {
        deploymentDate: "2026-06-01",
        indexedDate: "2026-06-03",
        instrumentationStartDate: "2026-06-03",
        baselineDays: 28,
        primaryDays: 28,
        confirmationDays: 28,
      },
      "2026-07-27"
    );

    expect(windows.baseline).toMatchObject({
      start: "2026-05-04",
      end: "2026-05-31",
    });
    expect(windows.primary).toMatchObject({
      start: "2026-06-03",
      end: "2026-06-30",
      complete: true,
    });
    expect(windows.confirmation).toMatchObject({
      start: "2026-07-01",
      end: "2026-07-28",
      complete: false,
    });
    expect(windows.phase).toBe("primary_complete");
  });

  it("groups missing collection dates into deterministic repair ranges", () => {
    expect(
      contiguousDateRanges([
        "2026-07-04",
        "2026-07-01",
        "2026-07-02",
        "2026-07-04",
        "2026-07-06",
      ])
    ).toEqual([
      { startDate: "2026-07-01", endDate: "2026-07-02" },
      { startDate: "2026-07-04", endDate: "2026-07-04" },
      { startDate: "2026-07-06", endDate: "2026-07-06" },
    ]);
    expect(() => contiguousDateRanges(["2026-02-31"])).toThrow(
      'Invalid calendar date "2026-02-31"'
    );
  });

  it("weights CTR and position by impressions instead of averaging rows", () => {
    const metrics = aggregateSearchMetrics(
      [
        searchRow("2026-01-01", "https://tkaflowarts.com/composer", 1, 1, 1),
        searchRow("2026-01-01", "https://tkaflowarts.com/composer", 99, 9, 11),
      ],
      rangeEndingAt("2026-01-01", 1)
    );

    expect(metrics).toEqual({
      clicks: 10,
      impressions: 100,
      ctr: 0.1,
      position: 10.9,
    });
  });

  it("selects controls from pre-change correlation, trend, and volume", () => {
    const rows: SearchMetricRow[] = [];
    const treatment = "https://tkaflowarts.com/composer";
    const matched = "https://tkaflowarts.com/guide/level-1/matched";
    const inverse = "https://tkaflowarts.com/guide/level-1/inverse";
    for (let index = 0; index < 5; index += 1) {
      const date = `2026-01-0${index + 1}`;
      rows.push(searchRow(date, treatment, 10 + index * 2, 1, 5));
      rows.push(
        searchRow(
          date,
          treatment,
          1_000 - index * 100,
          1,
          50,
          "query detail must not enter page totals"
        )
      );
      rows.push(searchRow(date, matched, 20 + index * 4, 1, 5));
      rows.push(searchRow(date, inverse, 30 - index * 3, 1, 5));
    }

    const controls = selectMatchedControls({
      rows,
      baseline: {
        start: "2026-01-01",
        end: "2026-01-05",
        days: 5,
        complete: true,
      },
      treatmentPages: new Set([treatment]),
      candidatePages: [inverse, matched],
      minimumImpressions: 5,
      maximumControls: 1,
      minimumCorrelation: 0.1,
    });

    expect(controls).toHaveLength(1);
    expect(controls[0]?.page).toBe(matched);
    expect(controls[0]?.correlation).toBeCloseTo(1);
  });

  it("suppresses ratio lift on zero baselines and adjusts absolute deltas", () => {
    expect(
      controlAdjustedLift({
        treatmentPre: 0,
        treatmentPost: 10,
        controlPairs: [{ pre: 5, post: 5 }],
      })
    ).toBeNull();
    expect(
      controlAdjustedDelta({
        treatmentPre: 0.1,
        treatmentPost: 0.2,
        controlPairs: [
          { pre: 0.1, post: 0.15 },
          { pre: 0.2, post: 0.22 },
        ],
      })
    ).toBeCloseTo(0.065);
  });

  it("labels rolled-up field data as the median of daily p75 values", () => {
    const metrics = aggregateFunnelMetrics(
      [
        {
          date: "2026-01-01",
          organicComposerSessions: 2,
          composerOpenedSessions: 1,
          activatedSessions: 1,
          completedSessions: 0,
          lcpP75: 1000,
          inpP75: 100,
          clsP75: 0.1,
        },
        {
          date: "2026-01-02",
          organicComposerSessions: 2,
          composerOpenedSessions: 2,
          activatedSessions: 1,
          completedSessions: 1,
          lcpP75: 3000,
          inpP75: 300,
          clsP75: 0.3,
        },
      ],
      { start: "2026-01-01", end: "2026-01-02", days: 2, complete: true }
    );

    expect(metrics.medianDailyLcpP75).toBe(2000);
    expect(metrics.activationRate).toBe(0.5);
  });
});

describe("SEO cohorts and data-source contracts", () => {
  it("builds deterministic treatment, control, and inspection cohorts", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://tkaflowarts.com/composer</loc></url>
      <url><loc>https://tkaflowarts.com/sequence/BETA</loc></url>
      <url><loc>https://tkaflowarts.com/sequence/ALPHA</loc></url>
      <url><loc>https://tkaflowarts.com/guide/level-1/hand-paths</loc></url>
      <url><loc>https://example.com/sequence/NOT-OURS</loc></url>
    </urlset>`;
    const sitemap = parseSitemapUrls(xml, config.site.origin);
    const first = buildSeoCohorts(config, sitemap);
    const second = buildSeoCohorts(config, [...sitemap].reverse());

    expect(first).toEqual(second);
    expect(first.treatmentPages).toContain(
      "https://tkaflowarts.com/sequence/ALPHA"
    );
    expect(first.controlCandidates).toEqual([
      "https://tkaflowarts.com/guide/level-1/hand-paths",
    ]);
    expect(first.inspectionSample).toContain(
      "https://tkaflowarts.com/composer"
    );
  });

  it("uses session acquisition, a 24-hour ordered funnel, and native vitals", () => {
    const options = {
      host: "tkaflowarts.com",
      reportingTimeZone: "America/Los_Angeles",
      startDate: "2026-07-01",
      endDate: "2026-07-07",
      treatmentPaths: ["/composer"],
    };
    const funnel = buildSeoFunnelQuery(options);
    const vitals = buildWebVitalsQuery(options);

    expect(funnel).toContain("FROM sessions");
    expect(funnel).toContain("\"$channel_type\" = 'Organic Search'");
    expect(funnel).toContain("windowFunnel(86400)");
    expect(funnel).toContain(
      "toIntOrZero(toString(relevant_events.properties.sequence_length)) >= 1"
    );
    expect(funnel).toContain(
      "toIntOrZero(toString(relevant_events.properties.beat_count)) >= 1"
    );
    expect(funnel).toContain("toDate('2026-07-09')");
    expect(vitals).toContain("event = '$web_vitals'");
    expect(vitals).toContain('properties."$web_vitals_LCP_value"');
    expect(vitals).not.toContain("event = 'web_vital'");
  });

  it("aggregates repeated bulk-export keys and converts zero-based position", () => {
    const query = buildBulkSearchQuery(config);

    expect(query).toContain("SUM(sum_position)");
    expect(query).toContain(
      "SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) + 1"
    );
    expect(query).toContain("WHERE query != ''");
    expect(query).toContain("search_type = 'web'");
    expect(query).toContain("GROUP BY data_date, page, query, country, device");
  });

  it("stores market context only with AI Overview observations", () => {
    expect(getWarehouseTableFieldNames("gsc_api_daily")).not.toContain(
      "market"
    );
    expect(getWarehouseTableFieldNames("ai_overview_observations")).toContain(
      "market"
    );
  });

  it("defines the managed PostHog dashboard with strict funnel and vital queries", () => {
    const spec = getPostHogDashboardSpec({
      host: "tkaflowarts.com",
      timeZone: "America/Los_Angeles",
    });

    expect(spec.map((insight) => insight.name)).toEqual([
      "SEO | Organic Composer funnel by day",
      "SEO | Organic Composer conversion",
      "SEO | Composer LCP and INP p75",
      "SEO | Composer CLS p75",
    ]);
    expect(spec[0]?.query).toContain("windowFunnel(86400)");
    expect(spec[0]?.query).toContain(
      "toIntOrZero(toString(relevant_events.properties.sequence_length)) >= 1"
    );
    expect(spec[0]?.query).toContain(
      "toIntOrZero(toString(relevant_events.properties.beat_count)) >= 1"
    );
    expect(spec[2]?.query).toContain("$web_vitals");
  });

  it("keeps local scorecards and OIDC credential files out of git", () => {
    const ignore = readFileSync(resolve(process.cwd(), ".gitignore"), "utf8");
    expect(ignore).toContain("/seo-reports/");
    expect(ignore).toContain("gha-creds-*.json");
  });

  it("repairs only empty incompatible tables before provider checks", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/seo-measurement.yml"),
      "utf8"
    );
    expect(workflow).toContain(
      "pnpm run seo:measure -- bootstrap --repair-empty-tables"
    );
  });
});

describe("SEO experiment decision", () => {
  it("declares a primary win only after every preregistered gate passes", () => {
    const experimentConfig = {
      ...config,
      experiment: {
        ...config.experiment,
        deploymentDate: "2026-06-01",
        indexedDate: "2026-06-03",
        instrumentationStartDate: "2026-06-03",
        baselineDays: 2,
        primaryDays: 2,
        confirmationDays: 2,
      },
      successCriteria: {
        ...config.successCriteria,
        minimumTreatmentImpressionsForDecision: 10,
      },
    };
    const treatment = "https://tkaflowarts.com/composer";
    const control = "https://tkaflowarts.com/guide/level-1/control";
    const rows = [
      searchRow("2026-05-30", treatment, 10, 1, 10),
      searchRow("2026-05-31", treatment, 10, 1, 10),
      searchRow("2026-05-30", control, 20, 2, 5),
      searchRow("2026-05-31", control, 20, 2, 5),
      searchRow("2026-06-03", treatment, 20, 4, 2),
      searchRow("2026-06-04", treatment, 20, 4, 2),
      searchRow("2026-06-03", control, 20, 2, 5),
      searchRow("2026-06-04", control, 20, 2, 5),
      searchRow("2026-05-30", treatment, 5, 0, 10, "flow arts software"),
      searchRow("2026-05-31", treatment, 5, 0, 10, "flow arts software"),
      searchRow("2026-06-03", treatment, 10, 2, 2, "flow arts software"),
      searchRow("2026-06-04", treatment, 10, 2, 2, "flow arts software"),
    ];
    const funnelRows = [
      {
        date: "2026-06-03",
        organicComposerSessions: 10,
        composerOpenedSessions: 8,
        activatedSessions: 5,
        completedSessions: 2,
        lcpP75: 2000,
        inpP75: 150,
        clsP75: 0.05,
      },
      {
        date: "2026-06-04",
        organicComposerSessions: 10,
        composerOpenedSessions: 8,
        activatedSessions: 5,
        completedSessions: 2,
        lcpP75: 2100,
        inpP75: 160,
        clsP75: 0.06,
      },
    ];
    const aiObservations = [
      ...experimentConfig.aiOverviewQueries.map((query) => ({
        observedDate: "2026-05-31",
        query,
        locale: "en-US",
        device: "desktop",
        market: "United States",
        aiOverviewPresent: false,
        citedTka: false,
        citedUrl: null,
        rankInCitations: null,
        notes: null,
      })),
      ...experimentConfig.aiOverviewQueries.map((query) => ({
        observedDate: "2026-06-04",
        query,
        locale: "en-US",
        device: "desktop",
        market: "United States",
        aiOverviewPresent: true,
        citedTka: true,
        citedUrl: treatment,
        rankInCitations: 1,
        notes: null,
      })),
    ];
    const scorecardInput = {
      config: experimentConfig,
      generatedAt: "2026-06-07T00:00:00.000Z",
      generatedDate: "2026-06-07",
      dataThrough: "2026-06-04",
      cohorts: {
        treatmentPages: [treatment],
        controlCandidates: [control],
        inspectionSample: [treatment],
      },
      controls: [
        {
          page: control,
          rank: 1,
          score: 1,
          correlation: 1,
          baselineImpressions: 40,
          normalizedSlopeDifference: 0,
          baselineStart: "2026-05-30",
          baselineEnd: "2026-05-31",
          frozenAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      searchRows: rows,
      funnelRows,
      collectionDays: [
        "2026-05-30",
        "2026-05-31",
        "2026-06-03",
        "2026-06-04",
      ].map((date) => ({ date, truncated: false })),
      postHogCollectionDays: ["2026-06-03", "2026-06-04"].map((date) => ({
        date,
        truncated: false,
      })),
      inspections: [
        {
          captureDate: "2026-06-04",
          capturedAt: "2026-06-04T12:00:00.000Z",
          inspectionUrl: treatment,
          siteUrl: experimentConfig.site.searchConsoleProperty,
          verdict: "PASS",
          coverageState: "Submitted and indexed",
          robotsTxtState: "ALLOWED",
          indexingState: "INDEXING_ALLOWED",
          pageFetchState: "SUCCESSFUL",
          lastCrawlTime: "2026-06-04T01:00:00.000Z",
          googleCanonical: treatment,
          userCanonical: treatment,
          crawledAs: "MOBILE",
          sitemaps: ["https://tkaflowarts.com/sitemap.xml"],
          referringUrls: [],
          inspectionResultLink: null,
        },
      ],
      aiObservations,
      cohortFrozen: true,
    } satisfies Parameters<typeof buildSeoScorecard>[0];
    const scorecard = buildSeoScorecard(scorecardInput);

    expect(scorecard.phase).toBe("primary_complete");
    expect(scorecard.search.primary?.controlAdjusted.impressionLift).toBe(1);
    expect(scorecard.search.headTerm.primary?.position).toBe(2);
    expect(scorecard.acquisition.primaryConversionMeasurable).toBe(true);
    expect(scorecard.acquisition.primaryDataComplete).toBe(true);
    expect(scorecard.acquisition.conversionComparableToBaseline).toBe(false);
    expect(scorecard.decision.status).toBe("primary_target_met");
    expect(
      scorecard.decision.criteria.every((item) => item.status === "pass")
    ).toBe(true);
    expect(scorecard.aiOverview.current.headTerm.citationRank).toBe(1);
    expect(scorecard.aiOverview.baseline.auditDate).toBe("2026-05-31");
    expect(scorecard.indexability).toMatchObject({
      expected: 1,
      inspected: 1,
      sampleComplete: true,
      freshForEvaluation: true,
    });

    const dashboard = buildSeoDashboardSnapshot(scorecard);
    expect(dashboard).toMatchObject({
      currentWindow: "primary",
      phase: "primary_complete",
      decision: { status: "primary_target_met" },
      headTerm: { current: { position: 2 } },
      cohorts: { frozen: true, frozenControlCount: 1 },
    });
    expect(dashboard.search.controlAdjusted?.impressionLift).toBe(1);
    const event = buildSeoSnapshotEvent(dashboard, "test-project-token");
    expect(event).toMatchObject({
      event: "seo_measurement_snapshot",
      distinct_id: "seo-measurement",
      properties: {
        $process_person_profile: false,
        generated_date: "2026-06-07",
        head_term_position: 2,
      },
    });
    expect(
      JSON.parse(
        String((event.properties as Record<string, unknown>).snapshot_json)
      )
    ).toEqual(dashboard);

    const scorecardWithSecondCitation = buildSeoScorecard({
      ...scorecardInput,
      aiObservations: scorecardInput.aiObservations.map((observation) =>
        observation.query === "flow arts software" &&
        observation.observedDate === "2026-06-04"
          ? { ...observation, rankInCitations: 2 }
          : observation
      ),
    });
    expect(scorecardWithSecondCitation.decision.status).toBe("below_target");

    const scorecardWithLiveCohort = buildSeoScorecard({
      ...scorecardInput,
      cohortFrozen: false,
    });
    expect(scorecardWithLiveCohort.decision.status).toBe("incomplete_evidence");

    const scorecardWithPostHogGap = buildSeoScorecard({
      ...scorecardInput,
      postHogCollectionDays: scorecardInput.postHogCollectionDays.slice(0, 1),
    });
    expect(scorecardWithPostHogGap.decision.status).toBe("incomplete_evidence");
    expect(scorecardWithPostHogGap.dataQuality.missingPostHogDates).toEqual([
      "2026-06-04",
    ]);

    const scorecardWithPartialInspection = buildSeoScorecard({
      ...scorecardInput,
      cohorts: {
        ...scorecardInput.cohorts,
        inspectionSample: [treatment, `${treatment}-missing`],
      },
    });
    expect(scorecardWithPartialInspection.indexability.sampleComplete).toBe(
      false
    );
    expect(scorecardWithPartialInspection.decision.status).toBe(
      "incomplete_evidence"
    );
  });
});
