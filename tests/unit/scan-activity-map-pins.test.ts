import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The watcher imports Firebase at module load. Stub the network boundary so
// these tests exercise transforms and query batching without a browser SDK.
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  doc: vi.fn(),
  documentId: vi.fn(() => "__name__"),
  getDoc: vi.fn(),
  getDocs: vi.fn(async () => ({ docs: [] })),
  limit: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));
vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn(async () => ({})),
}));

import {
  buildScanMapPins,
  createScanActivityState,
  filterScanEvents,
  summarizeScanActivity,
  type ScanEventRow,
  type CodeEntry,
} from "$lib/features/choreo-card/state/scan-activity-state.svelte";
import { ScanActivityWatcher } from "$lib/features/choreo-card/services/implementations/ScanActivityWatcher";
import type {
  IScanActivityWatcher,
  ScanActivityCardDocument,
} from "$lib/features/choreo-card/services/contracts/IScanActivityWatcher";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { getDocs, where } from "firebase/firestore";

function ev(partial: Partial<ScanEventRow>): ScanEventRow {
  return {
    id: "shortcodes/AAAA/scanEvents/event-default",
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

function decoder() {
  return vi.fn(async () => ({ steps: [] }) as unknown as SequenceData);
}

describe("buildScanMapPins", () => {
  it("includes only events with a city and finite coordinates", () => {
    const pins = buildScanMapPins([
      ev({ code: "WOYG", lat: 41.85, lng: -87.65, city: "Chicago" }),
      ev({ code: "XHJP", lat: null, lng: null }),
      ev({ code: "QQQQ", lat: 40.7, lng: -74.0 }), // coords but no city — excluded
      ev({ code: "ZXFV", lat: 51.5, lng: -0.12, city: "London" }),
    ]);
    expect(pins.map((p) => p.label.split(" · ")[0])).toEqual(["WOYG", "ZXFV"]);
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
    expect(pins[0]!.id).toBe("shortcodes/AAAA/scanEvents/event-default");
    expect(pins[0]!.styleClass).toBe("pin-new");
    expect(pins[1]!.styleClass).toBe("pin");
  });

  it("labels with the resolved word and city, falling back to the code", () => {
    const pins = buildScanMapPins(
      [ev({ code: "WOYG", lat: 41.85, lng: -87.65, city: "Chicago" })],
      (code) => (code === "WOYG" ? "BOOK" : undefined)
    );
    expect(pins[0]!.label).toBe("BOOK · Chicago");

    const noWord = buildScanMapPins([
      ev({ code: "ZXFV", lat: 51.5, lng: -0.12, city: "London" }),
    ]);
    expect(noWord[0]!.label).toBe("ZXFV · London");
  });

  it("excludes everything when no event carries a located city", () => {
    const pins = buildScanMapPins([ev({ code: "XHJP" }), ev({ code: "AAAA" })]);
    expect(pins).toHaveLength(0);
  });

  it("uses the exact Firestore event id when code and timestamp collide", () => {
    const pins = buildScanMapPins([
      ev({
        id: "shortcodes/WOYG/scanEvents/first",
        code: "WOYG",
        lat: 41.85,
        lng: -87.65,
        city: "Chicago",
      }),
      ev({
        id: "shortcodes/WOYG/scanEvents/second",
        code: "WOYG",
        lat: 41.86,
        lng: -87.66,
        city: "Chicago",
      }),
    ]);

    expect(pins.map((pin) => pin.id)).toEqual([
      "shortcodes/WOYG/scanEvents/first",
      "shortcodes/WOYG/scanEvents/second",
    ]);
  });
});

describe("scan activity view transforms", () => {
  const cards = new Map<string, Pick<CodeEntry, "ownerId" | "word">>([
    ["MINE", { ownerId: "owner-1", word: "BOOK" }],
    ["THEIRS", { ownerId: "owner-2", word: "CAKE" }],
  ]);

  const events = [
    ev({
      id: "shortcodes/MINE/scanEvents/no-city",
      code: "MINE",
      city: null,
      country: "US",
    }),
    ev({
      id: "shortcodes/MINE/scanEvents/chicago",
      code: "MINE",
      city: "Chicago",
      country: "US",
      lat: 41.85,
      lng: -87.65,
    }),
    ev({
      id: "shortcodes/THEIRS/scanEvents/london",
      code: "THEIRS",
      city: "London",
      country: "GB",
      lat: 51.5,
      lng: -0.12,
    }),
  ];

  it("keeps city-less events in the feed while map pins stay real", () => {
    const visible = filterScanEvents(events, cards, {
      scope: "all",
      currentUserId: "owner-1",
      search: "",
      city: null,
    });

    expect(visible.map((event) => event.id)).toContain(
      "shortcodes/MINE/scanEvents/no-city"
    );
    expect(buildScanMapPins(visible)).toHaveLength(2);
  });

  it("applies ownership, search, and exact-city filters to visible events", () => {
    const mine = filterScanEvents(events, cards, {
      scope: "mine",
      currentUserId: "owner-1",
      search: "book",
      city: null,
    });
    expect(mine.map((event) => event.code)).toEqual(["MINE", "MINE"]);

    const chicago = filterScanEvents(events, cards, {
      scope: "all",
      currentUserId: "owner-1",
      search: "",
      city: "CHICAGO",
    });
    expect(chicago.map((event) => event.id)).toEqual([
      "shortcodes/MINE/scanEvents/chicago",
    ]);
  });

  it("summarizes the visible slice without presenting it as a lifetime total", () => {
    const visible = events.slice(0, 2);
    expect(summarizeScanActivity(events, visible)).toEqual({
      windowCount: 3,
      visibleCount: 2,
      locatedCount: 1,
      unlocatedCount: 1,
      cityCount: 1,
      cardCount: 1,
      isFullWindow: false,
    });
  });

  it("labels a complete 100-event query window as capped", () => {
    const window = Array.from({ length: 100 }, (_, index) =>
      ev({ id: `shortcodes/MINE/scanEvents/${index}`, code: "MINE" })
    );
    expect(summarizeScanActivity(window, window).isFullWindow).toBe(true);
  });
});

describe("scan activity state", () => {
  it("publishes the first event window before card metadata finishes", async () => {
    let pushEvents: (events: ScanEventRow[]) => void = () => {};
    let resolveCards: (cards: ScanActivityCardDocument[]) => void = () => {};
    const loadCards = vi.fn(
      () =>
        new Promise<ScanActivityCardDocument[]>((resolve) => {
          resolveCards = resolve;
        })
    );
    const watcher: IScanActivityWatcher = {
      watchRecentEvents: vi.fn(async (onEvents) => {
        pushEvents = onEvents;
        return vi.fn();
      }),
      loadCards,
      loadAuthor: vi.fn(async () => ({ displayName: "Austen" })),
    };
    const state = createScanActivityState({
      data: watcher,
      decodeSequence: decoder(),
    });

    await state.connect("owner-1", true);
    pushEvents([
      ev({
        id: "shortcodes/WOYG/scanEvents/live",
        code: "WOYG",
        city: "Chicago",
        lat: 41.85,
        lng: -87.65,
      }),
    ]);

    expect(state.status).toBe("live");
    expect(state.loading).toBe(false);
    expect(state.recentEvents).toHaveLength(1);
    expect(loadCards).toHaveBeenCalledWith(["WOYG"]);

    resolveCards([]);
    await Promise.resolve();
    state.disconnect();
  });

  it("selects an exact repeated-code event and keeps filters local", async () => {
    let pushEvents: (events: ScanEventRow[]) => void = () => {};
    const watchRecentEvents = vi.fn(async (onEvents) => {
      pushEvents = onEvents;
      return vi.fn();
    });
    const loadCards = vi.fn(async () => [
      {
        code: "WOYG",
        data: {
          ownerId: "owner-1",
          sequenceName: "BOOK",
          scanCount: 2,
        },
      },
    ]);
    const watcher: IScanActivityWatcher = {
      watchRecentEvents,
      loadCards,
      loadAuthor: vi.fn(async () => ({ displayName: "Austen" })),
    };
    const state = createScanActivityState({
      data: watcher,
      decodeSequence: decoder(),
    });
    const first = ev({
      id: "shortcodes/WOYG/scanEvents/first",
      code: "WOYG",
      city: "London",
      lat: 51.5,
      lng: -0.12,
    });
    const second = ev({
      id: "shortcodes/WOYG/scanEvents/second",
      code: "WOYG",
      city: "Chicago",
      lat: 41.85,
      lng: -87.65,
    });

    await state.connect("owner-1", true);
    pushEvents([first, second]);
    await vi.waitFor(() => expect(state.codes).toHaveLength(1));

    state.selectEvent(second.id);
    state.setScope("mine");
    state.setSearch("book");
    state.filterToCity("Chicago");

    expect(state.selectedEvent).toEqual(second);
    expect(state.visibleEvents.map((event) => event.id)).toEqual([second.id]);
    expect(watchRecentEvents).toHaveBeenCalledTimes(1);
    expect(loadCards).toHaveBeenCalledTimes(1);
    state.disconnect();
  });

  it("loads a pre-connect selection outside the event window after the listener is installed", async () => {
    let pushEvents: (events: ScanEventRow[]) => void = () => {};
    let finishSubscription: () => void = () => {};
    const callOrder: string[] = [];
    const watchRecentEvents = vi.fn(
      (onEvents: (events: ScanEventRow[]) => void) => {
        pushEvents = onEvents;
        callOrder.push("watch");
        return new Promise<() => void>((resolve) => {
          finishSubscription = () => resolve(vi.fn());
        });
      }
    );
    const loadCards = vi.fn(async (codes: string[]) => {
      callOrder.push(`cards:${codes.join(",")}`);
      if (codes.includes("OUTSIDE")) return [];
      return codes.map((code) => ({
        code,
        data: { sequenceName: code, scanCount: 100 },
      }));
    });
    const state = createScanActivityState({
      data: {
        watchRecentEvents,
        loadCards,
        loadAuthor: vi.fn(async () => ({ displayName: "Unknown" })),
      },
      decodeSequence: decoder(),
    });

    state.selectCode("OUTSIDE");
    const connection = state.connect("owner-1", true);
    expect(watchRecentEvents).toHaveBeenCalledTimes(1);
    expect(loadCards).not.toHaveBeenCalled();

    finishSubscription();
    await connection;
    await vi.waitFor(() => expect(state.selectedCard).not.toBeNull());

    const eventWindow = Array.from({ length: 100 }, (_, index) =>
      ev({
        id: `shortcodes/INSIDE/scanEvents/${index}`,
        code: "INSIDE",
      })
    );
    pushEvents(eventWindow);
    await vi.waitFor(() => expect(state.summary.windowCount).toBe(100));

    const selectedLoads = loadCards.mock.calls.filter(([codes]) =>
      codes.includes("OUTSIDE")
    );
    expect(selectedLoads).toHaveLength(1);
    expect(selectedLoads[0]![0]).toEqual(["OUTSIDE"]);
    expect(callOrder[0]).toBe("watch");
    expect(state.selectedCard).toMatchObject({
      code: "OUTSIDE",
      metadataAvailable: false,
    });
    state.disconnect();
  });

  it("keeps an outside-window selected-card failure available to retry", async () => {
    let pushEvents: (events: ScanEventRow[]) => void = () => {};
    let selectedAttempts = 0;
    const loadCards = vi.fn(
      async (codes: string[]): Promise<ScanActivityCardDocument[]> => {
        if (codes.includes("OUTSIDE")) {
          selectedAttempts += 1;
          if (selectedAttempts === 1) throw new Error("selected card offline");
        }
        return codes.map((code) => ({
          code,
          data: { sequenceName: code, scanCount: 7 },
        }));
      }
    );
    const state = createScanActivityState({
      data: {
        watchRecentEvents: vi.fn(async (onEvents) => {
          pushEvents = onEvents;
          return vi.fn();
        }),
        loadCards,
        loadAuthor: vi.fn(async () => ({ displayName: "Unknown" })),
      },
      decodeSequence: decoder(),
    });

    state.selectCode("OUTSIDE");
    await state.connect("owner-1", true);
    await vi.waitFor(() =>
      expect(state.detailsError).toBe("selected card offline")
    );

    pushEvents([
      ev({ id: "shortcodes/INSIDE/scanEvents/inside", code: "INSIDE" }),
    ]);
    await vi.waitFor(() =>
      expect(state.codes.some((entry) => entry.code === "INSIDE")).toBe(true)
    );
    expect(state.detailsError).toBe("selected card offline");

    state.retryDetails();
    await vi.waitFor(() =>
      expect(state.selectedCard).toMatchObject({
        code: "OUTSIDE",
        metadataAvailable: true,
        scanCount: 7,
      })
    );
    expect(state.detailsError).toBeNull();
    expect(
      loadCards.mock.calls.filter(([codes]) => codes.includes("OUTSIDE"))
    ).toHaveLength(2);
    state.disconnect();
  });

  it("does not re-read card metadata for an identical follow-up snapshot", async () => {
    let pushEvents: (events: ScanEventRow[]) => void = () => {};
    const loadCards = vi.fn(async (codes: string[]) =>
      codes.map((code) => ({
        code,
        data: { sequenceName: code, scanCount: 1 },
      }))
    );
    const state = createScanActivityState({
      data: {
        watchRecentEvents: vi.fn(async (onEvents) => {
          pushEvents = onEvents;
          return vi.fn();
        }),
        loadCards,
        loadAuthor: vi.fn(async () => ({ displayName: "Unknown" })),
      },
      decodeSequence: decoder(),
    });
    const window = [
      ev({ id: "shortcodes/AAAA/scanEvents/a1", code: "AAAA" }),
      ev({ id: "shortcodes/BBBB/scanEvents/b1", code: "BBBB" }),
    ];

    await state.connect("owner-1", true);
    pushEvents(window);
    await vi.waitFor(() => expect(state.codes).toHaveLength(2));
    pushEvents(window);
    await Promise.resolve();

    expect(loadCards).toHaveBeenCalledTimes(1);
    expect(loadCards).toHaveBeenCalledWith(["AAAA", "BBBB"]);
    state.disconnect();
  });

  it("refreshes only the code attached to a newly observed event", async () => {
    let pushEvents: (events: ScanEventRow[]) => void = () => {};
    let request = 0;
    const loadCards = vi.fn(async (codes: string[]) => {
      request += 1;
      return codes.map((code) => ({
        code,
        data: {
          sequenceName: code,
          scanCount: code === "AAAA" ? request : 1,
        },
      }));
    });
    const state = createScanActivityState({
      data: {
        watchRecentEvents: vi.fn(async (onEvents) => {
          pushEvents = onEvents;
          return vi.fn();
        }),
        loadCards,
        loadAuthor: vi.fn(async () => ({ displayName: "Unknown" })),
      },
      decodeSequence: decoder(),
    });
    const firstWindow = [
      ev({ id: "shortcodes/AAAA/scanEvents/a1", code: "AAAA" }),
      ev({ id: "shortcodes/BBBB/scanEvents/b1", code: "BBBB" }),
    ];

    await state.connect("owner-1", true);
    pushEvents(firstWindow);
    await vi.waitFor(() => expect(state.codes).toHaveLength(2));
    pushEvents([
      ev({ id: "shortcodes/AAAA/scanEvents/a2", code: "AAAA" }),
      ...firstWindow,
    ]);
    await vi.waitFor(() => expect(loadCards).toHaveBeenCalledTimes(2));

    expect(loadCards.mock.calls[1]![0]).toEqual(["AAAA"]);
    await vi.waitFor(() =>
      expect(
        state.codes.find((entry) => entry.code === "AAAA")?.scanCount
      ).toBe(2)
    );
    state.disconnect();
  });

  it("queues one metadata refresh when a new scan lands during the initial read", async () => {
    let pushEvents: (events: ScanEventRow[]) => void = () => {};
    let resolveInitial: (cards: ScanActivityCardDocument[]) => void = () => {};
    let requestCount = 0;
    const loadCards = vi.fn((codes: string[]) => {
      requestCount += 1;
      if (requestCount === 1) {
        return new Promise<ScanActivityCardDocument[]>((resolve) => {
          resolveInitial = resolve;
        });
      }
      return Promise.resolve(
        codes.map((code) => ({
          code,
          data: { sequenceName: code, scanCount: 2 },
        }))
      );
    });
    const state = createScanActivityState({
      data: {
        watchRecentEvents: vi.fn(async (onEvents) => {
          pushEvents = onEvents;
          return vi.fn();
        }),
        loadCards,
        loadAuthor: vi.fn(async () => ({ displayName: "Unknown" })),
      },
      decodeSequence: decoder(),
    });
    const initialEvent = ev({
      id: "shortcodes/AAAA/scanEvents/a1",
      code: "AAAA",
    });

    await state.connect("owner-1", true);
    pushEvents([initialEvent]);
    expect(loadCards).toHaveBeenCalledTimes(1);

    pushEvents([
      ev({ id: "shortcodes/AAAA/scanEvents/a2", code: "AAAA" }),
      initialEvent,
    ]);
    await Promise.resolve();
    expect(loadCards).toHaveBeenCalledTimes(1);

    resolveInitial([
      {
        code: "AAAA",
        data: { sequenceName: "AAAA", scanCount: 1 },
      },
    ]);
    await vi.waitFor(() => expect(loadCards).toHaveBeenCalledTimes(2));
    expect(loadCards.mock.calls[1]![0]).toEqual(["AAAA"]);
    await vi.waitFor(() =>
      expect(
        state.codes.find((entry) => entry.code === "AAAA")?.scanCount
      ).toBe(2)
    );
    expect(loadCards).toHaveBeenCalledTimes(2);
    state.disconnect();
  });

  it("publishes a terminal unavailable entry when a shortcode document is absent", async () => {
    let pushEvents: (events: ScanEventRow[]) => void = () => {};
    const loadCards = vi.fn(async () => []);
    const state = createScanActivityState({
      data: {
        watchRecentEvents: vi.fn(async (onEvents) => {
          pushEvents = onEvents;
          return vi.fn();
        }),
        loadCards,
        loadAuthor: vi.fn(async () => ({ displayName: "Unknown" })),
      },
      decodeSequence: decoder(),
    });
    const event = ev({
      id: "shortcodes/MISSING/scanEvents/event",
      code: "MISSING",
    });

    await state.connect("owner-1", true);
    pushEvents([event]);
    await vi.waitFor(() => expect(state.codes).toHaveLength(1));

    expect(state.codes[0]).toMatchObject({
      code: "MISSING",
      metadataAvailable: false,
      integrityOk: false,
    });
    pushEvents([event]);
    await Promise.resolve();
    expect(loadCards).toHaveBeenCalledTimes(1);
    state.disconnect();
  });

  it("retries rejected metadata without restarting the activity listener", async () => {
    let pushEvents: (events: ScanEventRow[]) => void = () => {};
    let attempt = 0;
    const watchRecentEvents = vi.fn(async (onEvents) => {
      pushEvents = onEvents;
      return vi.fn();
    });
    const loadCards = vi.fn(
      async (codes: string[]): Promise<ScanActivityCardDocument[]> => {
        attempt += 1;
        if (attempt === 1) throw new Error("metadata offline");
        return codes.map((code) => ({
          code,
          data: { sequenceName: "BOOK", scanCount: 4 },
        }));
      }
    );
    const state = createScanActivityState({
      data: {
        watchRecentEvents,
        loadCards,
        loadAuthor: vi.fn(async () => ({ displayName: "Unknown" })),
      },
      decodeSequence: decoder(),
    });

    await state.connect("owner-1", true);
    pushEvents([ev({ id: "shortcodes/WOYG/scanEvents/event", code: "WOYG" })]);
    await vi.waitFor(() => expect(state.detailsError).toBe("metadata offline"));
    state.retryDetails();
    await vi.waitFor(() => expect(state.detailsError).toBeNull());

    expect(loadCards).toHaveBeenCalledTimes(2);
    expect(watchRecentEvents).toHaveBeenCalledTimes(1);
    expect(state.codes[0]).toMatchObject({
      code: "WOYG",
      metadataAvailable: true,
      scanCount: 4,
    });
    state.disconnect();
  });

  it("does not decode a card until its event is selected", async () => {
    let pushEvents: (events: ScanEventRow[]) => void = () => {};
    const decodeSequence = decoder();
    const state = createScanActivityState({
      data: {
        watchRecentEvents: vi.fn(async (onEvents) => {
          pushEvents = onEvents;
          return vi.fn();
        }),
        loadCards: vi.fn(async () => [
          {
            code: "WOYG",
            data: {
              encoded: "encoded-card",
              sequenceName: "BOOK",
              scanCount: 1,
            },
          },
        ]),
        loadAuthor: vi.fn(async () => ({ displayName: "Unknown" })),
      },
      decodeSequence,
    });
    const event = ev({
      id: "shortcodes/WOYG/scanEvents/event",
      code: "WOYG",
    });

    await state.connect("owner-1", true);
    pushEvents([event]);
    await vi.waitFor(() => expect(state.codes).toHaveLength(1));
    expect(decodeSequence).not.toHaveBeenCalled();

    state.selectEvent(event.id);
    await vi.waitFor(() => expect(decodeSequence).toHaveBeenCalledTimes(1));
    expect(decodeSequence).toHaveBeenCalledWith("encoded-card");
    state.disconnect();
  });

  it("ignores metadata that resolves after disconnect", async () => {
    let pushEvents: (events: ScanEventRow[]) => void = () => {};
    let resolveCards: (cards: ScanActivityCardDocument[]) => void = () => {};
    const state = createScanActivityState({
      data: {
        watchRecentEvents: vi.fn(async (onEvents) => {
          pushEvents = onEvents;
          return vi.fn();
        }),
        loadCards: vi.fn(
          () =>
            new Promise<ScanActivityCardDocument[]>((resolve) => {
              resolveCards = resolve;
            })
        ),
        loadAuthor: vi.fn(async () => ({ displayName: "Unknown" })),
      },
      decodeSequence: decoder(),
    });

    await state.connect("owner-1", true);
    pushEvents([ev({ id: "shortcodes/WOYG/scanEvents/event", code: "WOYG" })]);
    state.disconnect();
    resolveCards([
      {
        code: "WOYG",
        data: { sequenceName: "BOOK", scanCount: 1 },
      },
    ]);
    await Promise.resolve();
    await Promise.resolve();

    expect(state.codes).toHaveLength(0);
  });
});

describe("ScanActivityWatcher", () => {
  it("loads shortcode documents in document-id batches of at most 30", async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
    const watcher = new ScanActivityWatcher();
    const codes = Array.from({ length: 61 }, (_, index) => `CODE${index}`);

    await watcher.loadCards(codes);

    const batches = vi
      .mocked(where)
      .mock.calls.map((call) => call[2] as string[]);
    expect(batches.map((batch) => batch.length)).toEqual([30, 30, 1]);
    expect(batches.flat()).toEqual(codes);
  });
});

describe("GlobalUserMap scan marker contract", () => {
  it("uses click listeners supported by the weekly Maps channel", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/lib/features/community/components/GlobalUserMap.svelte"
      ),
      "utf8"
    );

    expect(source.match(/marker\.addListener\("click"/g)).toHaveLength(2);
    expect(source).not.toContain('addEventListener("gmp-click"');
  });
});
