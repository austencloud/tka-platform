import { describe, expect, it } from "vitest";
import { createScanEventId } from "./scan-event-identity";

const BASE = {
  shortCode: "AB12",
  physicalCardId: "23456789ABCD",
  deviceHash: "device-hash",
  day: "2026-07-27",
  city: "Chicago",
  country: "US",
};

describe("scan event identity", () => {
  it("converges retries for the same device, card, day, and place", async () => {
    await expect(createScanEventId(BASE)).resolves.toBe(
      await createScanEventId({ ...BASE })
    );
  });

  it("keeps distinct physical copies and city stops separate", async () => {
    const baseline = await createScanEventId(BASE);
    const otherCopy = await createScanEventId({
      ...BASE,
      physicalCardId: "23456789ABCE",
    });
    const otherCity = await createScanEventId({
      ...BASE,
      city: "Madison",
    });

    expect(otherCopy).not.toBe(baseline);
    expect(otherCity).not.toBe(baseline);
  });
});
