/**
 * Autonomous production review for feedback AbOVf8GWDaM2nr0wPCMF.
 *
 * Gates:
 *   1. The marked rule block in production matches this checkout.
 *   2. A real anonymous owner can read its absent profile without a denial.
 *   3. At least 100 versioned profile-read executions are observed.
 *   4. No matching denial appears for 14 days.
 *
 * Scheduled runs use --apply. A dry run performs the read-only checks and does
 * not change feedback or issue state.
 */
import { appendFile } from "node:fs/promises";
import {
  applySighting,
  type SessionIssue,
} from "../src/lib/server/analytics/session-issue-register.js";
import {
  evaluateProductionVerification,
  type ProductionVerificationSnapshot,
} from "../src/lib/server/analytics/production-verification.js";
import {
  buildProfileReadDenialsQuery,
  buildProfileReadExposureQuery,
  parseProfileReadDenial,
  parseProfileReadExposure,
} from "../src/lib/server/analytics/profile-read-verification-queries.js";
import {
  extractReviewedRuleBlock,
  getDeployedFirestoreRules,
  readLocalRulesSource,
  runMissingOwnerProfileCanary,
  sourceSha256,
} from "./lib/firebase-rules-deployment.js";
import { runHogQl } from "./lib/posthog-hogql.js";
import {
  loadFeedbackStatus,
  loadIssues,
  saveIssue,
} from "./lib/session-issue-store.js";
import { updateStatusViaFunction } from "./lib/cloud-functions-client.js";

try {
  process.loadEnvFile();
} catch {
  // CI and configured shells provide ambient environment variables.
}

const ISSUE_ID = "ISS-001";
const FEEDBACK_ID = "AbOVf8GWDaM2nr0wPCMF";
const RULES_PATH = "firestore.rules";
const START_MARKER = "// AUTONOMOUS_REVIEW: missing-owner-profile-read:start";
const END_MARKER = "// AUTONOMOUS_REVIEW: missing-owner-profile-read:end";
const REVIEW_SESSION_ID = "autonomous-review-firestore-permissions";
const POSTHOG_REPLAY_BASE = "https://us.posthog.com";

interface ReviewReport {
  decision: ReturnType<typeof evaluateProductionVerification>;
  snapshot: ProductionVerificationSnapshot;
  feedbackStatus: string | null;
  changedFeedbackStatus: boolean;
  changedIssueStatus: boolean;
  apply: boolean;
}

function replayUrl(sessionId: string): string {
  const projectId = process.env.POSTHOG_PROJECT_ID ?? "";
  return `${POSTHOG_REPLAY_BASE}/project/${projectId}/replay/${sessionId}`;
}

async function transitionFeedback(
  currentStatus: string | null,
  newStatus: "in-review" | "completed",
  adminNotes: string,
  resolution = ""
): Promise<boolean> {
  if (currentStatus === newStatus) return false;
  const result = await updateStatusViaFunction(
    FEEDBACK_ID,
    REVIEW_SESSION_ID,
    newStatus,
    adminNotes,
    resolution
  );
  if (!result) {
    throw new Error(
      `The feedback service did not confirm the ${currentStatus} -> ${newStatus} transition.`
    );
  }
  return true;
}

function snapshotStartedAt(
  issue: SessionIssue,
  targetSourceSha256: string,
  releaseUpdatedAt: string,
  deployedSourceMatches: boolean
): string | null {
  if (!deployedSourceMatches) return null;
  const previous = issue.productionVerification;
  if (
    previous?.targetSourceSha256 === targetSourceSha256 &&
    previous.startedAt
  ) {
    return previous.startedAt;
  }
  return releaseUpdatedAt;
}

async function writeGitHubSummary(report: ReviewReport): Promise<void> {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  const { decision, snapshot } = report;
  const rows = [
    "## Firestore permission review",
    "",
    `- Decision: **${decision.status}**`,
    `- Reason: ${decision.reason}`,
    `- Reviewed rule fingerprint: \`${snapshot.targetSourceSha256.slice(0, 12)}\``,
    `- Eligible sessions: ${snapshot.eligibleSessions}`,
    `- Eligible identities: ${snapshot.eligibleIdentities}`,
    `- Matching denial sessions: ${snapshot.matchingSessions}`,
    `- Quiet days: ${decision.quietDays.toFixed(1)} / ${snapshot.minQuietDays}`,
    `- Feedback status: ${report.feedbackStatus ?? "missing"}`,
    "",
  ];
  await appendFile(path, rows.join("\n"), "utf8");
}

async function run(): Promise<ReviewReport> {
  const apply = process.argv.includes("--apply");
  const issues = await loadIssues();
  const issue = issues.find((candidate) => candidate.id === ISSUE_ID);
  if (!issue) throw new Error(`Session issue ${ISSUE_ID} was not found.`);
  if (issue.feedbackId !== FEEDBACK_ID) {
    throw new Error(
      `${ISSUE_ID} is linked to ${issue.feedbackId ?? "no feedback"}, not ${FEEDBACK_ID}.`
    );
  }

  let feedbackStatus = await loadFeedbackStatus(FEEDBACK_ID);
  if (!feedbackStatus)
    throw new Error(`Feedback ${FEEDBACK_ID} was not found.`);

  const localSource = await readLocalRulesSource(RULES_PATH);
  const localBlock = extractReviewedRuleBlock(
    localSource,
    START_MARKER,
    END_MARKER
  );
  const targetSourceSha256 = sourceSha256(localBlock);
  const deployed = await getDeployedFirestoreRules();

  let deployedSourceSha256: string | null = null;
  try {
    const deployedBlock = extractReviewedRuleBlock(
      deployed.source,
      START_MARKER,
      END_MARKER
    );
    deployedSourceSha256 = sourceSha256(deployedBlock);
  } catch {
    // A missing marker is an expected pre-deploy state for this review.
  }
  const deployedSourceMatches = deployedSourceSha256 === targetSourceSha256;
  const startedAt = snapshotStartedAt(
    issue,
    targetSourceSha256,
    deployed.releaseUpdatedAt,
    deployedSourceMatches
  );

  const checkedAt = new Date();
  const canary = deployedSourceMatches
    ? await runMissingOwnerProfileCanary()
    : {
        passed: false,
        status: 0,
        detail: "The reviewed rule is not deployed.",
      };

  let exposure = { sessions: 0, identities: 0 };
  let denials: ReturnType<typeof parseProfileReadDenial>[] = [];
  if (canary.passed && startedAt) {
    const [exposureRows, denialRows] = await Promise.all([
      runHogQl(buildProfileReadExposureQuery(startedAt)),
      runHogQl(buildProfileReadDenialsQuery(startedAt)),
    ]);
    exposure = parseProfileReadExposure(exposureRows[0]);
    denials = denialRows.map(parseProfileReadDenial);
  }

  const decision = evaluateProductionVerification({
    now: checkedAt,
    deployedSourceMatches,
    canaryPassed: canary.passed,
    startedAt,
    eligibleSessions: exposure.sessions,
    matchingSessions: denials.length,
  });
  const matchingIdentities = new Set(denials.map((denial) => denial.uid)).size;
  const previous = issue.productionVerification;
  const canaryPassedAt = canary.passed
    ? previous?.targetSourceSha256 === targetSourceSha256
      ? (previous.canaryPassedAt ?? checkedAt.toISOString())
      : checkedAt.toISOString()
    : null;
  const snapshot: ProductionVerificationSnapshot = {
    status: decision.status,
    targetSourceSha256,
    deployedSourceSha256,
    rulesetName: deployed.rulesetName,
    releaseUpdatedAt: deployed.releaseUpdatedAt,
    startedAt,
    lastCheckedAt: checkedAt.toISOString(),
    canaryPassedAt,
    eligibleSessions: exposure.sessions,
    eligibleIdentities: exposure.identities,
    matchingSessions: denials.length,
    matchingIdentities,
    minQuietDays: 14,
    minEligibleSessions: 100,
    reason: canary.passed ? decision.reason : canary.detail,
  };

  let updatedIssue: SessionIssue = {
    ...issue,
    productionVerification: snapshot,
  };
  let changedFeedbackStatus = false;
  let changedIssueStatus = false;

  if (decision.status === "recurred") {
    for (const denial of denials) {
      updatedIssue = applySighting(updatedIssue, {
        sessionId: denial.sessionId,
        uid: denial.uid,
        occurredAt: denial.occurredAt,
        summary: `Permission denial while reading users/{id} (${denial.eventCount} event(s)).`,
        replayUrl: replayUrl(denial.sessionId),
        codeSite: null,
        route: denial.route,
      });
    }
    updatedIssue = {
      ...updatedIssue,
      status: "open",
      resolvedAt: null,
      resolvedReason: null,
    };
    if (feedbackStatus === "completed" && apply) {
      changedFeedbackStatus = await transitionFeedback(
        feedbackStatus,
        "in-review",
        `Production monitoring found ${denials.length} session(s) with the same users/{id} permission denial. The item was reopened automatically.`
      );
      feedbackStatus = "in-review";
    }
  } else if (decision.status === "canary-failed") {
    if (updatedIssue.status !== "open") {
      updatedIssue = {
        ...updatedIssue,
        status: "open",
        resolvedAt: null,
        resolvedReason: null,
      };
      changedIssueStatus = true;
    }
    if (feedbackStatus === "completed" && apply) {
      changedFeedbackStatus = await transitionFeedback(
        feedbackStatus,
        "in-review",
        `The live anonymous-owner canary failed with HTTP ${canary.status}. The item was reopened automatically.`
      );
      feedbackStatus = "in-review";
    }
  } else if (decision.status === "observing") {
    if (updatedIssue.status !== "watching") {
      updatedIssue = { ...updatedIssue, status: "watching" };
      changedIssueStatus = true;
    }
    const targetChanged =
      previous && previous.targetSourceSha256 !== targetSourceSha256;
    if (targetChanged && feedbackStatus === "completed" && apply) {
      changedFeedbackStatus = await transitionFeedback(
        feedbackStatus,
        "in-review",
        "The reviewed Firestore rule changed. Production observation restarted automatically."
      );
      feedbackStatus = "in-review";
    }
  } else if (decision.status === "passed") {
    const resolution =
      `${exposure.sessions} production sessions across ${exposure.identities} identities executed the profile read over ` +
      `${Math.floor(decision.quietDays)} days with zero matching permission denials. The deployed rule fingerprint and live anonymous-owner canary also passed.`;
    if (feedbackStatus === "in-review" && apply) {
      changedFeedbackStatus = await transitionFeedback(
        feedbackStatus,
        "completed",
        "The autonomous production review met its time, exposure, fingerprint, and live-canary gates.",
        resolution
      );
      feedbackStatus = "completed";
    }
    if (apply && feedbackStatus !== "completed") {
      throw new Error(
        `Production review passed, but feedback is ${feedbackStatus}; expected in-review or completed.`
      );
    }
    if (updatedIssue.status !== "resolved") {
      updatedIssue = {
        ...updatedIssue,
        status: "resolved",
        resolvedAt: checkedAt.toISOString(),
        resolvedReason: resolution,
      };
      changedIssueStatus = true;
    }
  }

  changedIssueStatus ||= updatedIssue.status !== issue.status;

  if (apply) await saveIssue(updatedIssue);

  const report: ReviewReport = {
    decision,
    snapshot,
    feedbackStatus,
    changedFeedbackStatus,
    changedIssueStatus,
    apply,
  };
  await writeGitHubSummary(report);
  return report;
}

run()
  .then((report) => {
    console.log(
      JSON.stringify(
        {
          mode: report.apply ? "apply" : "dry-run",
          decision: report.decision.status,
          reason: report.decision.reason,
          feedbackStatus: report.feedbackStatus,
          eligibleSessions: report.snapshot.eligibleSessions,
          eligibleIdentities: report.snapshot.eligibleIdentities,
          matchingSessions: report.snapshot.matchingSessions,
          targetSourceSha256: report.snapshot.targetSourceSha256,
          deployedSourceSha256: report.snapshot.deployedSourceSha256,
          rulesetName: report.snapshot.rulesetName,
          startedAt: report.snapshot.startedAt,
          changedFeedbackStatus: report.changedFeedbackStatus,
          changedIssueStatus: report.changedIssueStatus,
        },
        null,
        2
      )
    );

    if (
      report.apply &&
      ["waiting-for-deploy", "canary-failed", "recurred"].includes(
        report.decision.status
      )
    ) {
      process.exitCode = 1;
    }
  })
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : error
    );
    process.exitCode = 1;
  });
