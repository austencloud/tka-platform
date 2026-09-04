import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  archiveDocumentPageImage,
  archiveEntry,
  entriesForLane,
  entrySpanEndYear,
  historicalYearPosition,
  placeArchiveEntries,
} from "../../src/routes/(public)/history/_components/archive/_lib/archive-ledger";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

function staticFile(publicPath: string): string {
  return path.join(repoRoot, "static", publicPath.replace(/^\//, ""));
}

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
          /^https:\/\/|^\/|^http:\/\/www\.semlyen\.net\/cosmosjugglers\/lib\//
        );
        expect(citation.supports, `${entry.id} source claim`).not.toBe("");
        expect(validBases, `${entry.id} citation basis`).toContain(
          citation.basis
        );
      }
    }
  });

  it("preserves Mentive's complete Quarter Space Tech documents and credits Alex Kurowski's grid", () => {
    const qst = archiveEntry("quarter-space-tech");
    const documents = qst.documents ?? [];
    const expectedDocuments = [
      {
        id: "breaks",
        pageCount: 7,
        sha256:
          "4a9ef6c8b77cfde6210427e78e2d2b521574a30c0b079bfa7f5890c39cd42547",
      },
      {
        id: "advanced",
        pageCount: 16,
        sha256:
          "d90369e4980a4e98be827f50092a2fef4f362c2b2489830151f53eeafe6aa429",
      },
      {
        id: "beyond",
        pageCount: 27,
        sha256:
          "80169e9ea7e24c9b7abe9909b89f190045f1b85888a8cd7da9b1dd0e225ef068",
      },
    ];

    expect(qst.people).toBe("Mentive, based on Alex Kurowski's grid");
    expect(qst.summary).toContain("228 patterns");
    expect(qst.evidenceNote).toContain(
      "That dates these copies, not the system's origin"
    );
    expect(documents.map(({ id, pageCount }) => ({ id, pageCount }))).toEqual(
      expectedDocuments.map(({ id, pageCount }) => ({ id, pageCount }))
    );

    for (const expected of expectedDocuments) {
      const document = documents.find(
        (candidate) => candidate.id === expected.id
      );
      expect(document, expected.id).toBeDefined();
      if (!document) continue;

      const pdf = readFileSync(staticFile(document.pdfHref));
      expect(
        createHash("sha256").update(pdf).digest("hex"),
        `${expected.id} source PDF`
      ).toBe(expected.sha256);

      for (
        let pageNumber = 1;
        pageNumber <= document.pageCount;
        pageNumber += 1
      ) {
        const pageImage = readFileSync(
          staticFile(archiveDocumentPageImage(document, pageNumber))
        );
        expect(
          pageImage.subarray(0, 4).toString("ascii"),
          `${expected.id} page ${pageNumber}`
        ).toBe("RIFF");
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
    expect(historicalYearPosition(1994)).toBe(0);
    expect(historicalYearPosition(2026)).toBe(100);
    expect(historicalYearPosition(2010)).toBe(50);
    expect(ARCHIVE_YEAR_TICKS).toEqual([1994, 2002, 2010, 2018, 2026]);
  });

  it("links Jillings' 1994 book to its author without attaching a hosted copy", () => {
    const book = archiveEntry("modern-club-swinging");

    expect(ARCHIVE_START_YEAR).toBe(1994);
    expect(ARCHIVE_ENTRIES[0]?.id).toBe(book.id);
    expect(book.lane).toBe("teaching");
    expect(book.firstDocumentedYear).toBe(1994);
    expect(book.documents).toBeUndefined();
    expect(book.catalogEntry).toBeUndefined();
    expect(book.activity).toBeUndefined();
    expect(entrySpanEndYear(book)).toBe(1994);
    expect(book.citations[0]?.href).toBe(
      "http://www.semlyen.net/cosmosjugglers/lib/contents.htm"
    );
    for (const citation of book.citations) {
      expect(new URL(citation.href).origin).toBe("http://www.semlyen.net");
    }
  });

  it("keeps Home of Poi as a sourced teaching archive", () => {
    const homeOfPoi = archiveEntry("home-of-poi");

    expect(ARCHIVE_END_YEAR).toBe(2026);
    expect(homeOfPoi).toMatchObject({
      lane: "teaching",
      firstDocumentedYear: 1998,
      people: "Malcolm Crawshay and the Home of Poi community",
      evidenceBasis: "creators-account",
      activity: {
        status: "archive-online",
        lastVerifiedYear: 2026,
      },
    });
    expect(activityLabel(homeOfPoi)).toBe("Archive online · community dormant");
    expect(homeOfPoi.activity?.note).toContain(
      "newest visible forum post is from April 2025"
    );
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

  it("separates the edge-aligned 1994 book from Home of Poi without shifting dates", () => {
    const placements = placeArchiveEntries(entriesForLane("teaching"));
    const book = placements.find(({ entry }) => entry.id === "modern-club-swinging")!;
    const homeOfPoi = placements.find(({ entry }) => entry.id === "home-of-poi")!;

    // These bubbles overlapped on the 1994–2026 map at 1600×900: the
    // first is edge-aligned, while the 1998 bubble is centered on its year.
    expect(book.track).not.toBe(homeOfPoi.track);
    expect(book.position).toBe(historicalYearPosition(1994));
    expect(homeOfPoi.position).toBe(historicalYearPosition(1998));
  });

  it("keeps verified-activity spans off each other's tracks", () => {
    // Home of Poi, PLAYPOI, FAI, and DrexFactor all carry observation
    // connectors reaching 2026. If track assignment ignored the span end, a
    // later chip would sit on top of an earlier record's connector.
    const placements = placeArchiveEntries(entriesForLane("teaching"));
    const observedProjects = placements.filter(({ entry }) => entry.activity);
    const tracks = observedProjects.map((placement) => placement.track);
    expect(new Set(tracks).size).toBe(observedProjects.length);
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

    // The three teaching projects were verified active in 2026 from dated
    // public listings; the claim is "active, verified 2026" and nothing more.
    for (const id of ["playpoi", "flow-arts-institute", "drexfactor"]) {
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
