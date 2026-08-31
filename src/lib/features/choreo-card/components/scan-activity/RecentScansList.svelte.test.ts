import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import RecentScansList from "./RecentScansList.svelte";
import type { ScanEventRow } from "$lib/features/choreo-card/state/scan-activity-state.svelte";

const events: ScanEventRow[] = [
  {
    id: "shortcodes/9XAK/scanEvents/live",
    code: "9XAK",
    timestamp: "2026-07-22T08:30:00.000Z",
    city: "Chicago",
    country: "US",
    lat: 41.85,
    lng: -87.65,
    deviceId: "device-1",
    userId: null,
    leftPropType: null,
    rightPropType: null,
    catDogMode: null,
  },
];

describe("RecentScansList", () => {
  it("opens the exact scan row the user clicks", async () => {
    const onEventClick = vi.fn();
    render(RecentScansList, {
      props: {
        events,
        selectedEventId: events[0]!.id,
        onEventClick,
        onCityClick: vi.fn(),
        wordFor: () => "Assemble Sequence",
      },
    });

    const scan = page.getByRole("button", {
      name: "Inspect Assemble Sequence scan",
    });
    await expect.element(scan).toHaveAttribute("aria-pressed", "true");
    await scan.click();

    expect(onEventClick).toHaveBeenCalledExactlyOnceWith(events[0]!.id);
  });

  it("filters to the clicked city without also firing the scan-row action", async () => {
    const onEventClick = vi.fn();
    const onCityClick = vi.fn();
    render(RecentScansList, {
      props: {
        events,
        selectedEventId: null,
        onEventClick,
        onCityClick,
      },
    });

    await page.getByRole("button", { name: "Chicago" }).click();

    expect(onCityClick).toHaveBeenCalledExactlyOnceWith(
      "Chicago",
      events[0]!.id
    );
    expect(onEventClick).not.toHaveBeenCalled();
  });
});
