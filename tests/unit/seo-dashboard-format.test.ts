import { describe, expect, it } from "vitest";
import type { SeoDashboardSnapshot } from "../../src/lib/features/admin/domain/models/seo-dashboard-model";
import {
  formatPercent,
  getSeoGrowthStory,
  getSeoHistoryStory,
  getSeoOutcomeStatus,
} from "../../src/lib/features/admin/components/seo/seo-dashboard-format";

function snapshotFor(
  phase: SeoDashboardSnapshot["phase"],
  options: {
    deploymentDate?: string | null;
    impressionLift?: number | null;
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
    experimentDates: {
      deploymentDate: options.deploymentDate ?? null,
    },
    search: { controlAdjusted },
  } as SeoDashboardSnapshot;
}

describe("getSeoGrowthStory", () => {
  it("makes the baseline and its required action explicit", () => {
    const story = getSeoGrowthStory(snapshotFor("baseline"));

    expect(story.value).toBe("Too early to tell");
    expect(story.headline).toBe("The SEO changes are not marked live yet.");
    expect(story.nextStep).toContain("launch date");
    expect(story.tone).toBe("waiting");
  });

  it("explains that indexing unlocks the first growth check", () => {
    const story = getSeoGrowthStory(
      snapshotFor("awaiting_indexing", {
        deploymentDate: "2026-07-20",
      })
    );

    expect(story.value).toBe("Too early to tell");
    expect(story.explanation).toContain("before-and-after comparison starts");
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
