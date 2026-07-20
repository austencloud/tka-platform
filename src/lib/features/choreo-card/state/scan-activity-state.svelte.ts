import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type {
  IScanActivityWatcher,
  ScanActivityCardDocument,
  ScanActivityEventRecord,
  ScanActivityAuthor,
} from "../services/contracts/IScanActivityWatcher";

export interface CodeEntry {
  code: string;
  word: string;
  ownerId: string | null;
  createdAt: string;
  encoded: string;
  scanCount: number;
  lastScannedAt: string | null;
  lastCity: string | null;
  lastCountry: string | null;
  metadataAvailable: boolean;
  decoded: SequenceData | null;
  integrityOk: boolean;
  integrityReason?: string;
  decoding: boolean;
}

export interface ScanEventRow extends ScanActivityEventRecord {}

export interface ScanMapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  styleClass: "pin" | "pin-new";
}

export interface ScanActivityFilters {
  scope: "mine" | "all";
  currentUserId: string | null;
  search: string;
  city: string | null;
}

export interface ScanActivitySummary {
  windowCount: number;
  visibleCount: number;
  locatedCount: number;
  unlocatedCount: number;
  cityCount: number;
  cardCount: number;
  isFullWindow: boolean;
}

export type ScanActivityConnectionStatus =
  | "idle"
  | "connecting"
  | "live"
  | "error";

export interface ScanActivityStateDependencies {
  data: IScanActivityWatcher;
  decodeSequence: (encoded: string) => Promise<SequenceData>;
}

function toISOString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return String(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function codeWord(data: Record<string, unknown>): string {
  const embedded = data.sequenceData as { word?: unknown } | undefined;
  return text(data.sequenceName) || text(embedded?.word) || text(data.sequence);
}

export function buildScanMapPins(
  events: ScanEventRow[],
  wordFor?: (code: string) => string | undefined
): ScanMapPin[] {
  const pins: ScanMapPin[] = [];
  for (const event of events) {
    if (
      event.lat === null ||
      event.lng === null ||
      !Number.isFinite(event.lat) ||
      !Number.isFinite(event.lng) ||
      !event.city
    ) {
      continue;
    }
    pins.push({
      id: event.id,
      lat: event.lat,
      lng: event.lng,
      label: `${wordFor?.(event.code) || event.code} · ${event.city}`,
      styleClass: pins.length === 0 ? "pin-new" : "pin",
    });
  }
  return pins;
}

export function filterScanEvents(
  events: ScanEventRow[],
  cards: ReadonlyMap<string, Pick<CodeEntry, "ownerId" | "word">>,
  filters: ScanActivityFilters
): ScanEventRow[] {
  const needle = filters.search.trim().toLocaleLowerCase();
  const city = filters.city?.toLocaleLowerCase() ?? null;

  return events.filter((event) => {
    const card = cards.get(event.code);
    if (
      filters.scope === "mine" &&
      (!filters.currentUserId || card?.ownerId !== filters.currentUserId)
    ) {
      return false;
    }
    if (city && event.city?.toLocaleLowerCase() !== city) return false;
    if (!needle) return true;

    return [event.code, card?.word, event.city, event.country]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(needle));
  });
}

export function summarizeScanActivity(
  windowEvents: ScanEventRow[],
  visibleEvents: ScanEventRow[]
): ScanActivitySummary {
  const located = visibleEvents.filter(
    (event) =>
      Boolean(event.city) &&
      event.lat !== null &&
      event.lng !== null &&
      Number.isFinite(event.lat) &&
      Number.isFinite(event.lng)
  );
  const cities = new Set(
    visibleEvents
      .map((event) => event.city?.trim().toLocaleLowerCase())
      .filter((city): city is string => Boolean(city))
  );

  return {
    windowCount: windowEvents.length,
    visibleCount: visibleEvents.length,
    locatedCount: located.length,
    unlocatedCount: visibleEvents.length - located.length,
    cityCount: cities.size,
    cardCount: new Set(visibleEvents.map((event) => event.code)).size,
    isFullWindow: windowEvents.length === 100,
  };
}

function entryFromDocument(document: ScanActivityCardDocument): CodeEntry {
  const data = document.data;
  const encoded = text(data.encoded);
  return {
    code: document.code,
    word: codeWord(data),
    ownerId: nullableText(data.ownerId),
    createdAt: toISOString(data.createdAt) ?? "",
    encoded,
    scanCount: Number(data.scanCount ?? 0),
    lastScannedAt: toISOString(data.lastScannedAt),
    lastCity: nullableText(data.lastCity),
    lastCountry: nullableText(data.lastCountry),
    metadataAvailable: true,
    decoded: null,
    integrityOk: Boolean(encoded),
    integrityReason: encoded ? undefined : "Card data is unavailable.",
    decoding: false,
  };
}

function unavailableEntry(code: string): CodeEntry {
  return {
    code,
    word: "",
    ownerId: null,
    createdAt: "",
    encoded: "",
    scanCount: 0,
    lastScannedAt: null,
    lastCity: null,
    lastCountry: null,
    metadataAvailable: false,
    decoded: null,
    integrityOk: false,
    integrityReason: "Card record is unavailable.",
    decoding: false,
  };
}

export type ScanActivityState = ReturnType<typeof createScanActivityState>;

export function createScanActivityState({
  data,
  decodeSequence,
}: ScanActivityStateDependencies) {
  let codes = $state<CodeEntry[]>([]);
  let recentEvents = $state<ScanEventRow[]>([]);
  let status = $state<ScanActivityConnectionStatus>("connecting");
  let error = $state<string | null>(null);
  let detailsError = $state<string | null>(null);
  let scope = $state<"mine" | "all">("all");
  let search = $state("");
  let cityFilter = $state<string | null>(null);
  let selectedEventId = $state<string | null>(null);
  let selectedCode = $state<string | null>(null);
  let currentUserId = $state<string | null>(null);
  let connectedAsAdmin = false;

  const byCode = new Map<string, CodeEntry>();
  const decodeCache = new Map<
    string,
    { decoded: SequenceData | null; reason?: string }
  >();
  const authorCache = new Map<string, ScanActivityAuthor>();
  const authorInflight = new Map<string, Promise<ScanActivityAuthor>>();
  const metadataInflight = new Map<string, number>();
  const metadataRefreshQueued = new Set<string>();
  const metadataFailures = new Map<string, string>();
  let previousEventIds = new Set<string>();
  let hasReceivedEventSnapshot = false;
  let metadataRequestId = 0;
  let unsubscribe: (() => void) | null = null;
  let connectionGeneration = 0;

  const visibleEvents = $derived.by(() => {
    void codes;
    return filterScanEvents(recentEvents, byCode, {
      scope,
      currentUserId,
      search,
      city: cityFilter,
    });
  });
  const mapPins = $derived(
    buildScanMapPins(visibleEvents, (code) => byCode.get(code)?.word)
  );
  const summary = $derived(summarizeScanActivity(recentEvents, visibleEvents));
  const selectedEvent = $derived(
    selectedEventId
      ? (recentEvents.find((event) => event.id === selectedEventId) ?? null)
      : null
  );
  const selectedCard = $derived.by(() => {
    void codes;
    return selectedCode ? (byCode.get(selectedCode) ?? null) : null;
  });
  const relatedEvents = $derived(
    selectedCode
      ? recentEvents
          .filter(
            (event) =>
              event.code === selectedCode && event.id !== selectedEventId
          )
          .slice(0, 5)
      : []
  );

  function publishCards(): void {
    codes = [...byCode.values()].sort((a, b) => {
      const aTime = a.lastScannedAt ?? a.createdAt;
      const bTime = b.lastScannedAt ?? b.createdAt;
      return bTime.localeCompare(aTime);
    });
  }

  async function lookupAuthor(ownerId: string): Promise<ScanActivityAuthor> {
    const cached = authorCache.get(ownerId);
    if (cached) return cached;
    const inflight = authorInflight.get(ownerId);
    if (inflight) return inflight;

    const request = data
      .loadAuthor(ownerId)
      .catch(() => ({ displayName: "Unknown" }))
      .then((author) => {
        authorCache.set(ownerId, author);
        return author;
      })
      .finally(() => authorInflight.delete(ownerId));
    authorInflight.set(ownerId, request);
    return request;
  }

  async function enrichDecoded(
    decoded: SequenceData,
    entry: CodeEntry
  ): Promise<SequenceData> {
    const author = entry.ownerId ? await lookupAuthor(entry.ownerId) : null;
    return {
      ...decoded,
      word: entry.word || decoded.word,
      name: entry.word || decoded.name,
      ownerId: entry.ownerId ?? decoded.ownerId,
      author: author?.displayName ?? decoded.author,
      displayName: entry.word || decoded.displayName,
    } as SequenceData;
  }

  async function decodeSelectedCard(): Promise<void> {
    if (!selectedCode) return;
    const entry = byCode.get(selectedCode);
    if (!entry || entry.decoded || entry.decoding || !entry.encoded) return;

    const cached = decodeCache.get(entry.encoded);
    if (cached) {
      entry.decoded = cached.decoded;
      entry.integrityOk = cached.decoded !== null;
      entry.integrityReason = cached.reason;
      publishCards();
      return;
    }

    const encoded = entry.encoded;
    entry.decoding = true;
    publishCards();
    try {
      const decoded = await decodeSequence(encoded);
      const enriched = await enrichDecoded(decoded, entry);
      decodeCache.set(encoded, { decoded: enriched });
      const current = byCode.get(entry.code);
      if (current?.encoded === encoded) {
        current.decoded = enriched;
        current.integrityOk = true;
      }
    } catch (caught) {
      const reason = (caught as Error).message;
      decodeCache.set(encoded, { decoded: null, reason });
      const current = byCode.get(entry.code);
      if (current?.encoded === encoded) {
        current.integrityOk = false;
        current.integrityReason = reason;
      }
    } finally {
      const current = byCode.get(entry.code);
      if (current) current.decoding = false;
      publishCards();
    }
  }

  function updateDetailsError(): void {
    detailsError = metadataFailures.values().next().value ?? null;
  }

  function pruneIrrelevantMetadataFailures(events: ScanEventRow[]): void {
    const relevantCodes = new Set(events.map((event) => event.code));
    if (selectedCode) relevantCodes.add(selectedCode);
    for (const failedCode of metadataFailures.keys()) {
      if (!relevantCodes.has(failedCode)) metadataFailures.delete(failedCode);
    }
    updateDetailsError();
  }

  async function loadCardMetadata(codesToLoad: string[], generation: number) {
    const requestedCodes = [...new Set(codesToLoad)].filter(
      (code) => !metadataInflight.has(code)
    );
    if (requestedCodes.length === 0) return;

    const requestId = ++metadataRequestId;
    for (const code of requestedCodes) {
      metadataInflight.set(code, requestId);
    }

    try {
      const documents = await data.loadCards(requestedCodes);
      if (generation !== connectionGeneration) return;

      const returnedCodes = new Set(documents.map((document) => document.code));
      for (const code of requestedCodes) {
        metadataFailures.delete(code);
        if (!returnedCodes.has(code)) {
          byCode.set(code, unavailableEntry(code));
        }
      }
      for (const document of documents) {
        const prior = byCode.get(document.code);
        const next = entryFromDocument(document);
        if (prior?.metadataAvailable && prior.encoded === next.encoded) {
          next.decoded = prior.decoded;
          next.integrityOk = prior.integrityOk;
          next.integrityReason = prior.integrityReason;
          next.decoding = prior.decoding;
        }
        byCode.set(document.code, next);
      }
      updateDetailsError();
      publishCards();
      await decodeSelectedCard();
    } catch (caught) {
      if (generation === connectionGeneration) {
        const message = (caught as Error).message;
        for (const code of requestedCodes) {
          metadataFailures.set(code, message);
        }
        pruneIrrelevantMetadataFailures(recentEvents);
      }
    } finally {
      const queuedRefreshes: string[] = [];
      for (const code of requestedCodes) {
        if (metadataInflight.get(code) !== requestId) continue;
        metadataInflight.delete(code);
        if (metadataRefreshQueued.delete(code)) queuedRefreshes.push(code);
      }
      if (generation === connectionGeneration && queuedRefreshes.length > 0) {
        void loadCardMetadata(queuedRefreshes, generation);
      }
    }
  }

  function metadataCodesForSnapshot(events: ScanEventRow[]): string[] {
    const initialSnapshot = !hasReceivedEventSnapshot;
    const newlyObservedCodes = new Set<string>();
    for (const event of events) {
      if (!previousEventIds.has(event.id)) newlyObservedCodes.add(event.code);
    }

    const windowCodes = new Set(events.map((event) => event.code));
    previousEventIds = new Set(events.map((event) => event.id));
    hasReceivedEventSnapshot = true;

    pruneIrrelevantMetadataFailures(events);

    const requestedCodes: string[] = [];
    for (const code of windowCodes) {
      const causedByNewEvent = newlyObservedCodes.has(code);
      if (!initialSnapshot && !causedByNewEvent && byCode.has(code)) continue;

      if (metadataInflight.has(code)) {
        if (causedByNewEvent && !initialSnapshot) {
          // A scan can land while this card's count is still loading. One
          // follow-up read keeps the lifetime count from freezing one scan behind.
          metadataRefreshQueued.add(code);
        }
        continue;
      }
      requestedCodes.push(code);
    }
    return requestedCodes;
  }

  function receiveEvents(events: ScanEventRow[], generation: number): void {
    if (generation !== connectionGeneration) return;
    const codesToLoad = metadataCodesForSnapshot(events);
    recentEvents = events;
    status = "live";
    error = null;
    void loadCardMetadata(codesToLoad, generation);
  }

  async function connect(
    userId: string | null,
    isAdmin: boolean,
    force = false
  ): Promise<void> {
    if (
      !force &&
      unsubscribe &&
      currentUserId === userId &&
      connectedAsAdmin === isAdmin
    ) {
      return;
    }

    disconnect();
    currentUserId = userId;
    connectedAsAdmin = isAdmin;
    error = null;

    if (!isAdmin) {
      recentEvents = [];
      status = "live";
      return;
    }

    status = "connecting";
    const generation = connectionGeneration;
    try {
      const stop = await data.watchRecentEvents(
        (events) => receiveEvents(events, generation),
        (caught) => {
          if (generation !== connectionGeneration) return;
          status = "error";
          error = caught.message;
        }
      );
      if (generation !== connectionGeneration) {
        stop();
        return;
      }
      unsubscribe = stop;
      ensureSelectedCardMetadata();
    } catch (caught) {
      if (generation !== connectionGeneration) return;
      status = "error";
      error = (caught as Error).message;
    }
  }

  function disconnect(): void {
    connectionGeneration += 1;
    unsubscribe?.();
    unsubscribe = null;
    previousEventIds = new Set();
    hasReceivedEventSnapshot = false;
    metadataInflight.clear();
    metadataRefreshQueued.clear();
    if (status === "connecting") status = "idle";
  }

  function retry(): void {
    void connect(currentUserId, connectedAsAdmin, true);
  }

  function retryDetails(): void {
    const relevantCodes = new Set(recentEvents.map((event) => event.code));
    if (selectedCode) relevantCodes.add(selectedCode);
    const failedCodes = [...metadataFailures.keys()].filter(
      (code) => relevantCodes.has(code) && !metadataInflight.has(code)
    );
    void loadCardMetadata(failedCodes, connectionGeneration);
  }

  function ensureSelectedCardMetadata(): void {
    if (!selectedCode) return;
    if (byCode.has(selectedCode)) {
      void decodeSelectedCard();
      return;
    }
    if (
      !connectedAsAdmin ||
      !unsubscribe ||
      metadataInflight.has(selectedCode) ||
      metadataFailures.has(selectedCode)
    ) {
      return;
    }
    void loadCardMetadata([selectedCode], connectionGeneration);
  }

  function setScope(next: "mine" | "all"): void {
    scope = next;
  }

  function setSearch(next: string): void {
    search = next;
  }

  function filterToCity(city: string): void {
    cityFilter = city;
  }

  function clearCityFilter(): void {
    cityFilter = null;
  }

  function selectEvent(eventId: string): void {
    const event = recentEvents.find((candidate) => candidate.id === eventId);
    if (!event) return;
    selectedEventId = event.id;
    selectedCode = event.code;
    pruneIrrelevantMetadataFailures(recentEvents);
    ensureSelectedCardMetadata();
  }

  function selectCode(code: string): void {
    selectedCode = code;
    selectedEventId =
      recentEvents.find((event) => event.code === code)?.id ?? null;
    pruneIrrelevantMetadataFailures(recentEvents);
    ensureSelectedCardMetadata();
  }

  function clearSelection(): void {
    selectedEventId = null;
    selectedCode = null;
    pruneIrrelevantMetadataFailures(recentEvents);
  }

  return {
    get codes() {
      return codes;
    },
    get recentEvents() {
      return recentEvents;
    },
    get visibleEvents() {
      return visibleEvents;
    },
    get mapPins() {
      return mapPins;
    },
    get summary() {
      return summary;
    },
    get status() {
      return status;
    },
    get loading() {
      return status === "connecting" && recentEvents.length === 0;
    },
    get error() {
      return error;
    },
    get detailsError() {
      return detailsError;
    },
    get scope() {
      return scope;
    },
    get search() {
      return search;
    },
    get cityFilter() {
      return cityFilter;
    },
    get currentUserId() {
      return currentUserId;
    },
    get selectedEventId() {
      return selectedEventId;
    },
    get selectedCode() {
      return selectedCode;
    },
    get selectedEvent() {
      return selectedEvent;
    },
    get selectedCard() {
      return selectedCard;
    },
    get relatedEvents() {
      return relatedEvents;
    },
    connect,
    disconnect,
    retry,
    retryDetails,
    setScope,
    setSearch,
    filterToCity,
    clearCityFilter,
    selectEvent,
    selectCode,
    clearSelection,
  };
}
