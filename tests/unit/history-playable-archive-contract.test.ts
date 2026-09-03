/**
 * Static contract for the archive's information model. The visual details can
 * evolve, but the page must not drift back into an ordered carousel that only
 * looks chronological.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const archiveSource = read(
  "src/routes/(public)/history/_components/archive/PlayableArchive.svelte"
);
const timeMapSource = read(
  "src/routes/(public)/history/_components/archive/ArchiveTimeMap.svelte"
);
const mobileIndexSource = read(
  "src/routes/(public)/history/_components/archive/ArchiveChronologicalIndex.svelte"
);
const vtgSource = read(
  "src/routes/(public)/history/_components/archive/VtgChapterStepper.svelte"
);
const detailSource = read(
  "src/routes/(public)/history/_components/archive/ArchiveEntryDetail.svelte"
);
const submissionSource = read(
  "src/routes/(public)/history/_components/archive/ResearchSubmissionGuide.svelte"
);
const svelteConfigSource = read("svelte.config.js");

describe("playable archive: chronological overview", () => {
  it("keeps all four lanes visible on one proportional calendar", () => {
    expect(archiveSource).toContain("ArchiveTimeMap");
    expect(timeMapSource).toContain("ARCHIVE_LANES");
    expect(timeMapSource).toContain("ARCHIVE_YEAR_TICKS");
    expect(timeMapSource).toContain("historicalYearPosition");
    expect(timeMapSource).toContain(
      "Position marks the first documented year. Spacing is proportional."
    );
  });

  it("names and expands the dense 2009–2011 period", () => {
    expect(timeMapSource).toContain("ARCHIVE_CLUSTERS");
    expect(timeMapSource).toContain("cluster-marker");
    expect(timeMapSource).toContain("Dense period, separated for readability");
    expect(timeMapSource).toContain("aria-expanded");
    expect(timeMapSource).toContain("aria-controls");
  });

  it("presents documented traces, not a definitive history", () => {
    expect(archiveSource).toContain(
      "Documented traces, not a definitive history."
    );
    expect(archiveSource).toContain("better evidence changes the record");
  });

  it("draws activity as a dotted observation connector, never a solid lifespan bar", () => {
    expect(timeMapSource).toContain("observation-connector");
    expect(timeMapSource).toContain("entry.activity");
    expect(timeMapSource).toContain("dotted");
  });

  it("does not present the primary archive as a carousel, lane tabs, or slider", () => {
    expect(archiveSource).not.toContain("embla");
    expect(archiveSource).not.toContain("SegmentedControl");
    expect(archiveSource).not.toContain("ArchiveChronology");
    expect(archiveSource).not.toContain('aria-roledescription="carousel"');
    expect(archiveSource).not.toContain('type="range"');
    expect(archiveSource).not.toContain("discovered");
  });
});

describe("playable archive: selection context", () => {
  it("keeps artifact, attribution, claims, and citations in a persistent detail region", () => {
    expect(archiveSource).toContain('class="selected-record"');
    expect(archiveSource).toContain("ArchiveRecordVisual");
    expect(archiveSource).toContain("ArchiveEntryDetail");
    expect(archiveSource).toContain("Selected record");
    expect(archiveSource).toContain(
      'aria-label="Previous and next archive records"'
    );
  });

  it("uses record hashes and browser history for restorable deep links", () => {
    expect(archiveSource).toContain('const HASH_PREFIX = "#archive-record-"');
		expect(archiveSource).toContain('import { pushState } from "$app/navigation"');
		expect(archiveSource).toContain("pushState(nextHash");
    expect(archiveSource).toContain('window.addEventListener("popstate"');
    expect(timeMapSource).toContain("#archive-record-${entry.id}");
    expect(svelteConfigSource).toContain('path === "/history"');
    expect(svelteConfigSource).toContain(
      'id.startsWith("archive-record-")'
    );
  });

  it("uses native links and buttons for pointer and keyboard behavior", () => {
    expect(timeMapSource).toContain("<a");
    expect(timeMapSource).toContain('<button\n\t\t\t\t\t\t\ttype="button"');
    expect(timeMapSource).not.toContain("onkeydown");
  });
});

describe("playable archive: claim-level evidence", () => {
  it("labels each citation with its evidence basis and shows verified activity honestly", () => {
    expect(detailSource).toContain("EVIDENCE_BASIS_LABELS");
    expect(detailSource).toContain("activityLabel");
    expect(detailSource).not.toContain("sourceType");
  });

  it("accepts corrections and counter-evidence, not just new records", () => {
    expect(submissionSource).toContain("Correct a record");
    expect(submissionSource).toContain("Counter-evidence");
  });
});

describe("playable archive: compact screens", () => {
  it("recomposes into a chronological index instead of hiding the overview", () => {
    expect(archiveSource).toContain("ArchiveChronologicalIndex");
    expect(mobileIndexSource).toContain("ARCHIVE_ENTRIES");
    expect(mobileIndexSource).toContain("Chronological index");
    expect(mobileIndexSource).toContain("artifact, claims, and sources");
  });

  it("opens the selected record in the shared drawer on phones and short-wide screens", () => {
    expect(archiveSource).toContain("bind:isOpen={mobileRecordOpen}");
    expect(archiveSource).toContain(
      'placement={isShortWide.current ? "right" : "bottom"}'
    );
    expect(archiveSource).toContain("drawer-neighbors");
  });
});

describe("playable archive: nested artifact controls", () => {
  it("keeps VTG chapter navigation visibly separate from archive selection", () => {
    expect(vtgSource).toContain("SegmentedControl");
    expect(vtgSource).toContain('semantics="tabs"');
    expect(vtgSource).toContain("Choose a chapter");
    expect(vtgSource).toContain("event.stopPropagation()");
  });
});
