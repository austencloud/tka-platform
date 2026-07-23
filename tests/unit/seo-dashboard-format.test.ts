import { describe, expect, it } from "vitest";
import type { SeoDashboardSnapshot } from "../../src/lib/features/admin/domain/models/seo-dashboard-model";
import {
  formatPercent,
  getKnownCategorySearchMetrics,
  getSeoAutomationStory,
  getSeoGrowthStory,
  getSeoHistoryStory,
  getSeoOutcomeStatus,
} from "../../src/lib/features/admin/components/seo/seo-dashboard-format";

function snapshotFor(
  phase: SeoDashboardSnapshot["phase"],
  options: {
    deploymentDate?: string | null;
    impressionLift?: number | null;
    evaluationMode?: SeoDashboardSnapshot["evaluationMode"];
    currentImpressions?: number | null;
    decisionStatus?: SeoDashboardSnapshot["decision"]["status"];
  } = {}
): SeoDashboardSnapshot {
  const controlAdjusted =
    options.impressionLift === undefined
      ? null
      : {
          clickLift: null,
          impressionLift: options.impressionLift,
          ctrPercentagePointDelta: null,
          positionImprovement: null,
        };

  return {
    phase,
    evaluationMode: options.evaluationMode ?? "relative_lift",
    experimentDates: {
      deploymentDate: options.deploymentDate ?? null,
    },
    search: {
      controlAdjusted,
      current:
        options.currentImpressions === null ||
        options.currentImpressions === undefined
          ? null
          : {
              impressions: options.currentImpressions,
              clicks: 0,
              ctr: null,
              position: null,
            },
    },
    decision: { status: options.decisionStatus ?? "collecting" },
  } as SeoDashboardSnapshot;
}

describe("getSeoGrowthStory", () => {
  it("makes the baseline and its required action explicit", () => {
    const story = getSeoGrowthStory(snapshotFor("baseline"));

    expect(story.value).toBe("Not started");
    expect(story.headline).toBe("The SEO clock has not started.");
    expect(story.nextStep).toContain("changes went live");
    expect(story.tone).toBe("waiting");
  });

  it("explains that indexing unlocks the first growth check", () => {
    const story = getSeoGrowthStory(
      snapshotFor("awaiting_indexing", {
        deploymentDate: "2026-07-20",
      })
    );

    expect(story.value).toBe("Not yet");
    expect(story.explanation).toContain("every morning");
  });

  it("turns control-adjusted visibility lift into the main verdict", () => {
    const story = getSeoGrowthStory(
      snapshotFor("primary_collecting", { impressionLift: 0.184 })
    );

    expect(story.value).toBe("+18.4%");
    expect(story.headline).toBe("The first comparison points upward.");
    expect(story.tone).toBe("positive");
  });

  it("calls out a visibility decline without hiding it", () => {
    const story = getSeoGrowthStory(
      snapshotFor("primary_collecting", { impressionLift: -0.075 })
    );

    expect(story.value).toBe("-7.5%");
    expect(story.headline).toBe("The first comparison points downward.");
    expect(story.tone).toBe("negative");
  });

  it("marks a completed positive confirmation as proven twice", () => {
    const story = getSeoGrowthStory(
      snapshotFor("confirmed", { impressionLift: 0.12 })
    );

    expect(story.headline).toBe("The increase held up twice.");
    expect(story.nextStep).toContain("before-and-after test is complete");
  });

  it("reports absolute visibility without inventing a percentage from zero", () => {
    const story = getSeoGrowthStory(
      snapshotFor("primary_collecting", {
        evaluationMode: "visibility_emergence",
        currentImpressions: 14,
      })
    );

    expect(story.value).toBe("14 appearances");
    expect(story.headline).toBe(
      "Google has started showing the tracked pages."
    );
    expect(story.explanation).toContain("14 more appearances");
    expect(story.tone).toBe("positive");
  });

  it("explains the Search Console delay before the first emergence reading", () => {
    const story = getSeoGrowthStory(
      snapshotFor("primary_collecting", {
        evaluationMode: "visibility_emergence",
        currentImpressions: null,
      })
    );

    expect(story.value).toBe("Waiting");
    expect(story.explanation).toContain("three days");
    expect(story.tone).toBe("waiting");
  });
});

describe("getSeoAutomationStory", () => {
  it("stays quiet when the daily snapshot is fresh", () => {
    const story = getSeoAutomationStory(
      { generatedAt: "2026-07-22T12:00:00.000Z" },
      new Date("2026-07-23T12:00:00.000Z")
    );

    expect(story.healthy).toBe(true);
    expect(story.value).toBe("On");
    expect(story.headline).toBe("Nothing to do.");
  });

  it("warns after two daily snapshots are missed", () => {
    const story = getSeoAutomationStory(
      { generatedAt: "2026-07-20T11:59:59.000Z" },
      new Date("2026-07-22T12:00:00.000Z")
    );

    expect(story.healthy).toBe(false);
    expect(story.value).toBe("Late");
    expect(story.explanation).toContain("last two days");
  });

  it("treats a broken timestamp as a failed daily check", () => {
    const story = getSeoAutomationStory(
      { generatedAt: "not-a-date" },
      new Date("2026-07-22T12:00:00.000Z")
    );

    expect(story.healthy).toBe(false);
  });
});

describe("getSeoHistoryStory", () => {
  it("does not mistake repeated starting readings for growth", () => {
    const story = getSeoHistoryStory([
      { phase: "baseline", treatmentImpressions: 3 },
      { phase: "baseline", treatmentImpressions: 3 },
    ]);

    expect(story.headline).toBe("Still setting the starting point");
    expect(story.explanation).toContain("do not measure growth yet");
    expect(story.tone).toBe("waiting");
  });

  it("states plainly when later readings have not moved", () => {
    const story = getSeoHistoryStory([
      { phase: "baseline", treatmentImpressions: 12 },
      { phase: "primary_collecting", treatmentImpressions: 12 },
    ]);

    expect(story.headline).toBe("No movement yet");
    expect(story.explanation).toContain("stayed at 12");
    expect(story.tone).toBe("neutral");
  });

  it("reports the absolute change in Google appearances", () => {
    const story = getSeoHistoryStory([
      { phase: "baseline", treatmentImpressions: 12 },
      { phase: "primary_collecting", treatmentImpressions: 19 },
    ]);

    expect(story.headline).toBe("Google appearances increased");
    expect(story.explanation).toContain("7 more appearances");
    expect(story.tone).toBe("positive");
  });
});

describe("formatPercent", () => {
  it("removes an unnecessary decimal from whole percentages", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(0.184)).toBe("18.4%");
  });
});

describe("getSeoOutcomeStatus", () => {
  const criterion = (
    id: string,
    status: "pass" | "fail" | "pending" | "unavailable"
  ) => ({ id, status }) as SeoDashboardSnapshot["decision"]["criteria"][number];

  it("waits until every check in a grouped outcome has passed", () => {
    const status = getSeoOutcomeStatus(
      [criterion("appearances", "pass")],
      ["appearances", "clicks"]
    );

    expect(status).toBe("waiting");
  });

  it("marks the grouped outcome passed only when every check passes", () => {
    const status = getSeoOutcomeStatus(
      [criterion("appearances", "pass"), criterion("clicks", "pass")],
      ["appearances", "clicks"]
    );

    expect(status).toBe("pass");
  });

  it("surfaces one failed check even when another check is missing", () => {
    const status = getSeoOutcomeStatus(
      [criterion("appearances", "fail")],
      ["appearances", "clicks"]
    );

    expect(status).toBe("fail");
  });
});

describe("getKnownCategorySearchMetrics", () => {
  it("combines software and notation groups without counting brand queries", () => {
    const metrics = getKnownCategorySearchMetrics({
      search: {
        current: { impressions: 99, clicks: 9, ctr: 9 / 99, position: 8 },
      },
      queryGroups: [
        {
          id: "software_category",
          label: "Software",
          baseline: { impressions: 0, clicks: 0, ctr: null, position: null },
          current: { impressions: 10, clicks: 2, ctr: 0.2, position: 4 },
        },
        {
          id: "notation_category",
          label: "Notation",
          baseline: { impressions: 0, clicks: 0, ctr: null, position: null },
          current: { impressions: 30, clicks: 2, ctr: 2 / 30, position: 8 },
        },
        {
          id: "brand",
          label: "Brand",
          baseline: { impressions: 0, clicks: 0, ctr: null, position: null },
          current: { impressions: 50, clicks: 5, ctr: 0.1, position: 1 },
        },
      ],
    } as Pick<SeoDashboardSnapshot, "queryGroups" | "search">);

    expect(metrics).toEqual({
      clicks: 4,
      impressions: 40,
      ctr: 0.1,
      position: 7,
    });
  });
});
