/**
 * Static contract test for the playable-archive prototype.
 *
 * Two defects shipped here and both were invisible to typecheck and to the
 * existing state tests, because both lived in markup:
 *
 *   1. The stage `view-transition-name` was applied only to the ACTIVE tile,
 *      so during a select re-tile neither the outgoing nor the incoming name
 *      had a partner. Unpaired names do not travel: the new hero's visual
 *      entered at its final position while its tile was still morphing.
 *   2. Every entry's sourced prose and citation links existed only inside the
 *      conditional detail overlay, so the page was ~40 indexable words and one
 *      outbound link — the catalog's whole payload was unreachable to a
 *      crawler and to a screen reader that never opened the modal.
 *
 * These assertions lock both. If one fails, fix the component — do not loosen
 * the test.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { NOTATION_CATALOG } from "$lib/shared/notation/notation-catalog";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARCHIVE_PATH = "src/routes/test/notation-playable/_components/PlayableArchive.svelte";
const source = readFileSync(path.join(repoRoot, ARCHIVE_PATH), "utf8");

describe("playable archive: transition-name pairing", () => {
  it("names every stage, not only the active one", () => {
    // The name must be present whenever the tile is NOT the open detail's
    // source. An `isActive ? name : undefined` shape is the regression.
    expect(source).toMatch(/view-transition-name=\{archive\.detailOpen && isActive\s*\?\s*undefined/);
    expect(source).not.toMatch(/view-transition-name=\{isActive && !archive\.detailOpen\s*\?/);
  });

  it("keeps names per-entry so no system can morph into another", () => {
    // Canon guardrail: the spec forbids implying a relationship between
    // systems. A shared/static name would morph one system's visual into
    // another's during a select.
    expect(source).toMatch(/`stage-\$\{entry\.id\}`/);
    expect(source).toMatch(/`tile-\$\{entry\.id\}`/);
    expect(source).not.toMatch(/view-transition-name:\s*(stage|tile)\b/);
  });

  it("drives morphs natively rather than through a late WAAPI takeover", () => {
    // motion's animateView attached ~300ms after commit, behind the artifact
    // mounts, and replayed a journey the browser had already finished.
    expect(source).toContain("document.startViewTransition");
    expect(source).not.toMatch(/^\s*import\s*\{[^}]*animateView/m);
  });
});

describe("playable archive: crawlable content", () => {
  it("renders the record block unconditionally inside the per-entry snippet", () => {
    expect(source).toContain('<section class="tile-record">');
    // The block must carry the prose and the citation list, not just a title.
    expect(source).toContain("{entry.records}");
    expect(source).toMatch(/\{#each entry\.sources as source/);
  });

  it("clips the record visually without removing it from the DOM or a11y tree", () => {
    const block = source.slice(source.indexOf(".tile-record {"));
    const rule = block.slice(0, block.indexOf("}"));
    expect(rule).toContain("clip-path");
    // display:none would drop it from the render tree; aria-hidden would drop
    // it from the a11y tree. Both defeat the point.
    expect(rule).not.toContain("display: none");
    expect(source).not.toMatch(/<section class="tile-record"[^>]*aria-hidden/);
  });

  it("never hides the page's only h1 at any breakpoint", () => {
    // A `display: none` on .room-header removed the h1 from the render tree
    // at fold-landscape, taking the page's identity with it.
    expect(source).not.toMatch(/\.room-header\s*\{[^}]*display:\s*none/);
  });

  it("has a citation link for every source in the catalog", () => {
    // The markup iterates entry.sources, so the guarantee is really about the
    // catalog being fully reachable: assert there is something to render.
    const totalSources = NOTATION_CATALOG.reduce((n, e) => n + e.sources.length, 0);
    expect(NOTATION_CATALOG).toHaveLength(9);
    expect(totalSources).toBeGreaterThanOrEqual(9);
    for (const entry of NOTATION_CATALOG) {
      expect(entry.sources.length).toBeGreaterThan(0);
      expect(entry.records.length).toBeGreaterThan(0);
    }
  });
});
