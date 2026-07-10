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
  it("includes only events with a city and finite coordinates", () => {
    const pins = buildScanMapPins([
      ev({ code: "WOYG", lat: 41.85, lng: -87.65, city: "Chicago" }),
      ev({ code: "XHJP", lat: null, lng: null }),
      ev({ code: "QQQQ", lat: 40.7, lng: -74.0 }), // coords but no city — excluded
      ev({ code: "ZXFV", lat: 51.5, lng: -0.12, city: "London" }),
    ]);
    expect(pins.map((p) => p.id.split("-")[0])).toEqual(["WOYG", "ZXFV"]);
  });

  it("excludes country-only events — no centroid approximations", () => {
    const pins = buildScanMapPins([ev({ code: "AAAA", country: "US" })]);
    expect(pins).toHaveLength(0);
  });

  it("marks the newest plotted event as pin-new even when newer events were excluded", () => {
    const pins = buildScanMapPins([
      ev({ code: "QQQQ", lat: 40.7, lng: -74.0 }), // newest but city-less
      ev({ code: "WOYG", lat: 41.85, lng: -87.65, city: "Chicago" }),
      ev({ code: "ZXFV", lat: 51.5, lng: -0.12, city: "London" }),
    ]);
    expect(pins[0].id.startsWith("WOYG-")).toBe(true);
    expect(pins[0].styleClass).toBe("pin-new");
    expect(pins[1].styleClass).toBe("pin");
  });

  it("labels with the resolved word and city, falling back to the code", () => {
    const pins = buildScanMapPins(
      [ev({ code: "WOYG", lat: 41.85, lng: -87.65, city: "Chicago" })],
      (code) => (code === "WOYG" ? "BOOK" : undefined)
    );
    expect(pins[0].label).toBe("BOOK · Chicago");

    const noWord = buildScanMapPins([
      ev({ code: "ZXFV", lat: 51.5, lng: -0.12, city: "London" }),
    ]);
    expect(noWord[0].label).toBe("ZXFV · London");
  });

  it("excludes everything when no event carries a located city", () => {
    const pins = buildScanMapPins([ev({ code: "XHJP" }), ev({ code: "AAAA" })]);
    expect(pins).toHaveLength(0);
  });
});
