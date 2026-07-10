import { describe, it, expect, vi } from "vitest";

// The state module imports firebase/firestore at top level (protobufjs crashes
// in jsdom); buildScanMapPins is pure, so stub the Firestore + decoder imports.
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocsFromServer: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));
vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn(async () => ({})),
}));
vi.mock("$lib/shared/navigation/services/sequence-encoder", () => ({
  decodeSequenceFromQR: vi.fn(async () => null),
}));

import {
  buildScanMapPins,
  type ScanEventRow,
} from "$lib/features/choreo-card/state/scan-activity-state.svelte";

function ev(partial: Partial<ScanEventRow>): ScanEventRow {
  return {
    code: "AAAA",
    timestamp: "2026-06-22T00:00:00.000Z",
    city: null,
    country: null,
    lat: null,
    lng: null,
    deviceId: null,
    userId: null,
    ...partial,
  };
}

describe("buildScanMapPins", () => {
  it("plots exact pins for events with finite coordinates", () => {
    const pins = buildScanMapPins([
      ev({ code: "WOYG", lat: 41.85, lng: -87.65 }),
      ev({ code: "XHJP", lat: null, lng: null }),
      ev({ code: "ZXFV", lat: 51.5, lng: -0.12 }),
    ]);
    expect(pins.map((p) => p.id.split("-")[0])).toEqual(["WOYG", "ZXFV"]);
  });

  it("aggregates coordless events with a country into one approx pin per country", () => {
    const pins = buildScanMapPins([
      ev({ code: "AAAA", country: "US" }),
      ev({ code: "BBBB", country: "US" }),
      ev({ code: "CCCC", country: "GB" }),
    ]);
    const approx = pins.filter((p) => p.styleClass === "pin-approx");
    expect(approx).toHaveLength(2);
    const us = approx.find((p) => p.id === "country-US");
    expect(us?.label).toBe("US · 2 scans (country-level)");
    expect(us?.lat).toBeCloseTo(39.8);
    expect(us?.lng).toBeCloseTo(-98.6);
    expect(approx.find((p) => p.id === "country-GB")?.label).toBe(
      "GB · 1 scan (country-level)"
    );
  });

  it("skips coordless events whose country has no centroid", () => {
    const pins = buildScanMapPins([ev({ code: "AAAA", country: "ZZ" })]);
    expect(pins).toHaveLength(0);
  });

  it("marks the newest located event as pin-new and the rest as pin", () => {
    const pins = buildScanMapPins([
      ev({ code: "WOYG", lat: 41.85, lng: -87.65 }),
      ev({ code: "ZXFV", lat: 51.5, lng: -0.12 }),
    ]);
    expect(pins[0].styleClass).toBe("pin-new");
    expect(pins[1].styleClass).toBe("pin");
  });

  it("labels with the resolved word and place, falling back to the code", () => {
    const pins = buildScanMapPins(
      [ev({ code: "WOYG", lat: 41.85, lng: -87.65, city: "Chicago" })],
      (code) => (code === "WOYG" ? "BOOK" : undefined)
    );
    expect(pins[0].label).toBe("BOOK · Chicago");

    const noWord = buildScanMapPins([
      ev({ code: "ZXFV", lat: 51.5, lng: -0.12, country: "GB" }),
    ]);
    expect(noWord[0].label).toBe("ZXFV · GB");
  });

  it("excludes everything when no event carries coordinates or a country", () => {
    const pins = buildScanMapPins([ev({ code: "XHJP" }), ev({ code: "AAAA" })]);
    expect(pins).toHaveLength(0);
  });
});
