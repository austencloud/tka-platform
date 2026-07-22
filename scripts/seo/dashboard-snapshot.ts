import type { SeoDashboardSnapshot } from "../../src/lib/features/admin/domain/models/seo-dashboard-model";
import type { SeoScorecard } from "./scorecard";

const SNAPSHOT_EVENT = "seo_measurement_snapshot";
const SNAPSHOT_DISTINCT_ID = "seo-measurement";

function activeWindow(
  scorecard: SeoScorecard
): "primary" | "confirmation" | null {
  return scorecard.decision.evaluationWindow;
}

export function buildSeoDashboardSnapshot(
  scorecard: SeoScorecard
): SeoDashboardSnapshot {
  const currentWindow = activeWindow(scorecard);
  const currentComparison = currentWindow
    ? scorecard.search[currentWindow]
    : null;
  const currentHeadTerm = currentWindow
    ? scorecard.search.headTerm[currentWindow]
    : null;
  const currentAcquisition = currentWindow
    ? scorecard.acquisition[currentWindow]
    : null;

  return {
    version: 1,
    experimentId: scorecard.experimentId,
    generatedAt: scorecard.generatedAt,
    generatedDate: scorecard.generatedDate,
    dataThrough: scorecard.dataThrough,
    phase: scorecard.phase,
    performanceSource: scorecard.performanceSource,
    evaluationMode: scorecard.evaluationMode,
    currentWindow,
    experimentDates: scorecard.experimentDates,
    windows: scorecard.windows,
    cohorts: {
      frozen: scorecard.cohorts.frozen,
      treatmentPageCount: scorecard.cohorts.treatmentPageCount,
      controlCandidateCount: scorecard.cohorts.controlCandidateCount,
      frozenControlCount: scorecard.cohorts.frozenControls.length,
      inspectionSampleCount: scorecard.cohorts.inspectionSampleCount,
    },
    dataQuality: scorecard.dataQuality,
    search: {
      baseline: scorecard.search.baseline,
      current: currentComparison?.current ?? null,
      controlAdjusted: currentComparison?.controlAdjusted ?? null,
    },
    headTerm: {
      baseline: scorecard.search.headTerm.baseline,
      current: currentHeadTerm,
    },
    acquisition: {
      baseline: scorecard.acquisition.baseline,
      current: currentAcquisition,
      conversionMeasurable: scorecard.acquisition.primaryConversionMeasurable,
      currentDataComplete:
        currentWindow === "confirmation"
          ? scorecard.acquisition.confirmationDataComplete
          : currentWindow === "primary"
            ? scorecard.acquisition.primaryDataComplete
            : scorecard.dataQuality.postHogDataComplete,
    },
    queryGroups: scorecard.search.queryGroups.map((group) => ({
      id: group.id,
      label: group.label,
      baseline: group.baseline,
      current: currentWindow ? group[currentWindow] : null,
    })),
    topQueries: scorecard.search.primaryTopQueries,
    indexability: scorecard.indexability,
    aiOverview: scorecard.aiOverview,
    decision: {
      status: scorecard.decision.status,
      criteria: scorecard.decision.criteria,
    },
  };
}

export function buildSeoSnapshotEvent(
  snapshot: SeoDashboardSnapshot,
  projectToken: string
): Record<string, unknown> {
  const search = snapshot.search.current ?? snapshot.search.baseline;
  const headTerm = snapshot.headTerm.current ?? snapshot.headTerm.baseline;
  const acquisition =
    snapshot.acquisition.current ?? snapshot.acquisition.baseline;
  const aiAudit = snapshot.aiOverview.current.auditDate
    ? snapshot.aiOverview.current
    : snapshot.aiOverview.baseline;

  return {
    api_key: projectToken,
    event: SNAPSHOT_EVENT,
    distinct_id: SNAPSHOT_DISTINCT_ID,
    timestamp: snapshot.generatedAt,
    properties: {
      $process_person_profile: false,
      snapshot_json: JSON.stringify(snapshot),
      snapshot_version: snapshot.version,
      experiment_id: snapshot.experimentId,
      generated_date: snapshot.generatedDate,
      data_through: snapshot.dataThrough,
      phase: snapshot.phase,
      evaluation_mode: snapshot.evaluationMode,
      deployment_date: snapshot.experimentDates.deploymentDate,
      decision_status: snapshot.decision.status,
      head_term_position: headTerm.position,
      treatment_impressions: search.impressions,
      organic_activation_rate: acquisition.activationRate,
      ai_citation_rate: aiAudit.citationRate,
      indexed_rate: snapshot.indexability.indexedRate,
    },
  };
}

export async function publishSeoDashboardSnapshot(
  scorecard: SeoScorecard
): Promise<SeoDashboardSnapshot> {
  const projectToken =
    process.env.POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.PUBLIC_POSTHOG_KEY?.trim();
  if (!projectToken) {
    throw new Error(
      "POSTHOG_PROJECT_TOKEN or PUBLIC_POSTHOG_KEY is required to publish the SEO dashboard snapshot"
    );
  }

  const captureHost = (
    process.env.POSTHOG_CAPTURE_HOST?.trim() ||
    process.env.PUBLIC_POSTHOG_HOST?.trim() ||
    "https://us.i.posthog.com"
  ).replace(/\/$/, "");
  const snapshot = buildSeoDashboardSnapshot(scorecard);
  const response = await fetch(`${captureHost}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSeoSnapshotEvent(snapshot, projectToken)),
  });
  if (!response.ok) {
    throw new Error(`PostHog snapshot capture failed with ${response.status}`);
  }
  return snapshot;
}
