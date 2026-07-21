import { describe, expect, it } from "vitest";
import type { SeoDashboardSnapshot } from "../../src/lib/features/admin/domain/models/seo-dashboard-model";
import { getSeoGrowthStory } from "../../src/lib/features/admin/components/seo/seo-dashboard-format";

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

    expect(story.value).toBe("Not measured yet");
    expect(story.headline).toBe("This is the before picture.");
    expect(story.nextStep).toContain("register the date");
    expect(story.tone).toBe("waiting");
  });

  it("explains that indexing unlocks the first growth check", () => {
    const story = getSeoGrowthStory(
      snapshotFor("awaiting_indexing", {
        deploymentDate: "2026-07-20",
      })
    );

    expect(story.value).toBe("Waiting on Google");
    expect(story.explanation).toContain(
      "first growth check starts when indexing is confirmed"
    );
  });

  it("turns control-adjusted visibility lift into the main verdict", () => {
    const story = getSeoGrowthStory(
      snapshotFor("primary_collecting", { impressionLift: 0.184 })
    );

    expect(story.value).toBe("+18.4%");
    expect(story.headline).toBe("Google visibility is growing.");
    expect(story.tone).toBe("positive");
  });

  it("calls out a visibility decline without hiding it", () => {
    const story = getSeoGrowthStory(
      snapshotFor("primary_collecting", { impressionLift: -0.075 })
    );

    expect(story.value).toBe("-7.5%");
    expect(story.headline).toBe("Google visibility is down.");
    expect(story.tone).toBe("negative");
  });

  it("marks a completed positive confirmation as proven twice", () => {
    const story = getSeoGrowthStory(
      snapshotFor("confirmed", { impressionLift: 0.12 })
    );

    expect(story.headline).toBe("Growth passed both checks.");
    expect(story.nextStep).toContain("full measurement cycle is complete");
  });
});
