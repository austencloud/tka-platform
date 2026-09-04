import { describe, expect, it } from "vitest";
import {
  ARCHIVE_CLUSTERS,
  ARCHIVE_END_YEAR,
  ARCHIVE_ENTRIES,
  ARCHIVE_LANES,
  ARCHIVE_START_YEAR,
  ARCHIVE_YEAR_TICKS,
  EVIDENCE_BASIS_LABELS,
  activityLabel,
  archiveClusterForEntry,
  archiveEntry,
  entriesForLane,
  entrySpanEndYear,
  historicalYearPosition,
  placeArchiveEntries,
} from "../../src/routes/(public)/history/_components/archive/_lib/archive-ledger";

describe("four-lane history archive ledger", () => {
  it("requires every published entry to carry evidence with a claim-level basis", () => {
    expect(ARCHIVE_ENTRIES.length).toBeGreaterThan(8);

    const validBases = Object.keys(EVIDENCE_BASIS_LABELS);

    for (const entry of ARCHIVE_ENTRIES) {
      expect(entry.citations.length, `${entry.id} citations`).toBeGreaterThan(
        0
      );
      expect(entry.evidenceLabel, `${entry.id} evidence label`).not.toBe("");
      expect(
        entry.evidenceShortLabel,
        `${entry.id} short evidence label`
      ).not.toBe("");
      expect(entry.evidenceNote, `${entry.id} evidence note`).not.toBe("");
      expect(validBases, `${entry.id} headline basis`).toContain(
        entry.evidenceBasis
      );

      for (const citation of entry.citations) {
        expect(citation.href, `${entry.id} citation URL`).toMatch(
          /^https:\/\/|^\//
        );
        expect(citation.supports, `${entry.id} source claim`).not.toBe("");
        expect(validBases, `${entry.id} citation basis`).toContain(
          citation.basis
        );
      }
    }
  });

  it("keeps every entry in exactly one named lane", () => {
    const laneIds = new Set(ARCHIVE_LANES.map((lane) => lane.id));
    expect(laneIds.size).toBe(4);

    for (const entry of ARCHIVE_ENTRIES) {
      expect(laneIds.has(entry.lane), entry.id).toBe(true);
      const appearances = ARCHIVE_LANES.filter((lane) =>
        entriesForLane(lane.id).some((candidate) => candidate.id === entry.id)
      );
      expect(appearances, entry.id).toHaveLength(1);
    }
  });

  it("orders each lane by evidence-backed calendar placement", () => {
    for (const lane of ARCHIVE_LANES) {
      const years = entriesForLane(lane.id).map(
        (entry) => entry.firstDocumentedYear
      );
      expect(years, lane.id).toEqual([...years].sort((a, b) => a - b));
    }
  });

  it("uses proportional calendar spacing instead of equal carousel spacing", () => {
    expect(historicalYearPosition(1998)).toBe(0);
    expect(historicalYearPosition(2026)).toBe(100);
    expect(historicalYearPosition(2012)).toBe(50);
    expect(ARCHIVE_YEAR_TICKS).toEqual([1998, 2005, 2012, 2019, 2026]);
  });

  it("opens with Home of Poi as a sourced teaching archive", () => {
    const homeOfPoi = archiveEntry("home-of-poi");

    expect(ARCHIVE_START_YEAR).toBe(1998);
    expect(ARCHIVE_END_YEAR).toBe(2026);
    expect(ARCHIVE_ENTRIES[0]?.id).toBe("home-of-poi");
    expect(homeOfPoi).toMatchObject({
      lane: "teaching",
      firstDocumentedYear: 1998,
      people: "Malcolm Crawshay and the Home of Poi community",
      evidenceBasis: "creators-account",
    });
    expect(homeOfPoi.citations.map((citation) => citation.href)).toEqual(
      expect.arrayContaining([
        "https://www.homeofpoi.com/us/company/information-mission.php",
        "https://www.homeofpoi.com/us/community/forums/",
        "https://www.homeofpoi.com/en/community/forums/topics/120838/How-do-you-define-a-weave",
      ])
    );
    expect(homeOfPoi.citations).toHaveLength(3);
  });

  it("labels the related movement-language records with their actual 2009–2010 range", () => {
    const cluster = ARCHIVE_CLUSTERS.find(
      (candidate) => candidate.id === "movement-language-foundations"
    );

    expect(cluster).toMatchObject({
      lane: "languages",
      label: "4 related records",
      dateLabel: "2009–2010",
      startYear: 2009,
      endYear: 2010,
    });
    expect(cluster?.entryIds).toEqual([
      "caps",
      "trochoid",
      "nine-square",
      "vtg",
    ]);
    expect(archiveClusterForEntry("vtg")?.id).toBe(cluster?.id);
    expect(archiveClusterForEntry("qft")).toBeUndefined();
  });

  it("moves collisions to another visual track without moving them in time", () => {
    const placements = placeArchiveEntries(entriesForLane("notation"));
    const qft = placements.find((placement) => placement.entry.id === "qft");
    const lorq = placements.find((placement) => placement.entry.id === "lorq");

    expect(qft?.track).toBe(0);
    expect(lorq?.track).toBe(1);
    expect(qft?.position).toBe(historicalYearPosition(2011));
    expect(lorq?.position).toBe(historicalYearPosition(2012));
  });

  it("keeps verified-activity spans off each other's tracks", () => {
    // Home of Poi, PLAYPOI, FAI, and DrexFactor all carry observation
    // connectors reaching 2026. If track assignment ignored the span end, a
    // later chip would sit on top of an earlier record's connector.
    const placements = placeArchiveEntries(entriesForLane("teaching"));
    const tracks = placements.map((placement) => placement.track);
    expect(new Set(tracks).size).toBe(placements.length);
  });

  it("only claims activity when a dated endpoint supports it", () => {
    for (const entry of ARCHIVE_ENTRIES) {
      if (!entry.activity) continue;
      expect(
        entry.activity.lastVerifiedYear,
        `${entry.id} verified endpoint`
      ).toBeGreaterThanOrEqual(entry.firstDocumentedYear);
      expect(entry.activity.note, `${entry.id} activity note`).not.toBe("");
      expect(entrySpanEndYear(entry), `${entry.id} span end`).toBe(
        entry.activity.lastVerifiedYear
      );
    }

    // The four teaching projects were verified active in 2026 from dated
    // public listings; the claim is "active, verified 2026" and nothing more.
    for (const id of [
      "home-of-poi",
      "playpoi",
      "flow-arts-institute",
      "drexfactor",
    ]) {
      const entry = archiveEntry(id);
      expect(entry.activity?.status, id).toBe("active");
      expect(entry.activity?.lastVerifiedYear, id).toBe(2026);
      expect(activityLabel(entry), id).toBe("Active · verified 2026");
    }

    // Staff Science's latest dated trace is 2024; the archive makes no claim
    // past it.
    const staffScience = archiveEntry("staff-science");
    expect(staffScience.activity?.status).toBe("unknown");
    expect(activityLabel(staffScience)).toBe("Last public trace 2024");

    // A record without an activity claim shows no activity label at all.
    expect(archiveEntry("caps").activity).toBeUndefined();
    expect(activityLabel(archiveEntry("caps"))).toBeUndefined();
  });

  it("never renders an open-ended lifespan date label", () => {
    for (const entry of ARCHIVE_ENTRIES) {
      expect(entry.dateLabel, entry.id).not.toMatch(/[–-]\s*$/);
      expect(entry.dateLabel, entry.id).not.toMatch(/present/i);
    }
  });

  it("does not convert unresolved Fan Alphabet attribution into an inventor claim", () => {
    const fanAlphabet = ARCHIVE_ENTRIES.find(
      (entry) => entry.id === "fan-alphabet"
    );
    expect(fanAlphabet?.evidenceBasis).toBe("unresolved");
    expect(fanAlphabet?.people).toContain("early documented teacher");
    expect(fanAlphabet?.summary).toContain(
      "No reviewed source names a sole inventor"
    );
  });

  it("keeps PoiNotation's repository record separate from adoption claims", () => {
    const poiNotation = ARCHIVE_ENTRIES.find(
      (entry) => entry.id === "poinotation"
    );
    expect(poiNotation?.evidenceLabel).toBe("Repository record");
    expect(poiNotation?.evidenceNote).toContain(
      "Adoption and influence are unverified"
    );
  });
});
