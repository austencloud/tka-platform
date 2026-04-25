<script lang="ts">
  import { setGuideData, setActiveSectionContext } from "../../../../routes/(public)/guide/level-1/_data/guide-data-context";
  import { guideChapters } from "../../../../routes/(public)/guide/level-1/_data/nav-config";
  import type { GuideChapterData } from "../../../../routes/(public)/guide/level-1/_data/guide-types";
  import GuideNav from "../../../../routes/(public)/guide/level-1/_components/GuideNav.svelte";

  import positionsMotionsData from "../../../../routes/(public)/guide/level-1/_data/positions-motions.json";

  import TheGrid from "../../../../routes/(public)/guide/level-1/_sections/ch10/TheGrid.svelte";
  import HandPositions from "../../../../routes/(public)/guide/level-1/_sections/ch10/HandPositions.svelte";
  import HandMotions from "../../../../routes/(public)/guide/level-1/_sections/ch10/HandMotions.svelte";
  import Type1AlphaBeta from "../../../../routes/(public)/guide/level-1/_sections/ch10/Type1AlphaBeta.svelte";
  import Type1Gamma from "../../../../routes/(public)/guide/level-1/_sections/ch10/Type1Gamma.svelte";
  import Type2Shifts from "../../../../routes/(public)/guide/level-1/_sections/ch10/Type2Shifts.svelte";
  import Type3CrossShifts from "../../../../routes/(public)/guide/level-1/_sections/ch10/Type3CrossShifts.svelte";
  import Type4Dash from "../../../../routes/(public)/guide/level-1/_sections/ch10/Type4Dash.svelte";
  import Type5DualDash from "../../../../routes/(public)/guide/level-1/_sections/ch10/Type5DualDash.svelte";
  import Type6Static from "../../../../routes/(public)/guide/level-1/_sections/ch10/Type6Static.svelte";
  import StaffPositions from "../../../../routes/(public)/guide/level-1/_sections/ch10/StaffPositions.svelte";
  import StaffMotions from "../../../../routes/(public)/guide/level-1/_sections/ch10/StaffMotions.svelte";
  import NegativeSpace from "../../../../routes/(public)/guide/level-1/_sections/ch10/NegativeSpace.svelte";

  type ChapterSlug = "" | "positions-motions" | "letters" | "words";

  let activeChapter = $state<ChapterSlug>("");
  let activeSectionId = $state("");
  let contentEl: HTMLElement | undefined = $state();

  setGuideData(positionsMotionsData as unknown as GuideChapterData);
  setActiveSectionContext((id: string) => {
    activeSectionId = id;
  });

  function handleChapterSelect(slug: string) {
    activeChapter = slug as ChapterSlug;
    activeSectionId = "";
    contentEl?.scrollTo({ top: 0 });
  }
</script>

<div class="guide-tab">
  <aside class="guide-sidebar">
    <GuideNav
      bind:activeSectionId
      activeChapter={activeChapter || null}
      onChapterSelect={handleChapterSelect}
    />
  </aside>

  <main class="guide-content" bind:this={contentEl}>
    {#if activeChapter === "" || activeChapter === undefined}
      <div class="landing">
        <img
          class="cover-art"
          src="/guide/level-1/images/_shared/level-1-front-cover.png"
          alt="The Kinetic Alphabet Level 1 cover"
        />
        <h1>The Kinetic Alphabet</h1>
        <p class="subtitle">Level 1 — Positions, Motions, Letters & Words</p>
        <p class="byline">Created by Austen Cloud &middot; v 0.5</p>

        <section class="read-me-first">
          <h2>Read Me First</h2>
          <p>
            You've come across The Kinetic Alphabet, a notation system designed to
            help you craft and communicate your own unique choreography. This grid-based
            language is designed for music, using pictographs and letters that combine like
            puzzle pieces for each beat. This system has propelled my sequence creation to
            new heights, and I hope it will do the same for you!
          </p>
          <p>
            The Kinetic Alphabet is a fusion of elements from VTG (Vulcan Tech Gospel),
            siteswap (Juggling Notation), and musical notation. Although it can be introduced to beginners, it's designed for intermediate learners, bridging the gap between improvisation and choreography. Originally built for double staves, it can
            be applied to any dual wielded static prop like clubs, fans, triads, buugeng, and
            more.
          </p>
          <p>
            Pictographs form the core of The Kinetic Alphabet.
          </p>
          <p>
            The letters are a useful tool to categorize and communicate the pictographs,
            but they are secondary to the pictographs themselves. It's not necessary to memorize the letters immediately to benefit from this system.
          </p>
          <p>
            This is a work-in-progress and is continually growing. Whether you fully
            embrace this system, draw inspiration from certain parts, or follow a different
            path altogether, I hope the ideas presented here contribute to your creative
            growth.
          </p>
          <p>I can't wait to see the unique choreography you'll create!</p>
          <p class="sign-off">
            With love,<br />
            Austen Cloud
          </p>
        </section>

        <nav class="toc" aria-label="Table of contents">
          <h2>Chapters</h2>
          <ol>
            <li>
              <button class="toc-card" onclick={() => handleChapterSelect("positions-motions")}>
                <strong>1.0 — Positions & Motions</strong>
                <span>The grid, hand positions, hand motions, Types 1–6, staff positions, negative space</span>
              </button>
            </li>
            <li>
              <button class="toc-card" onclick={() => handleChapterSelect("letters")}>
                <strong>1.1 — Letters</strong>
                <span>Codex, Type 1 letters, compound letters, gamma letters, Types 2–6</span>
              </button>
            </li>
            <li>
              <button class="toc-card" onclick={() => handleChapterSelect("words")}>
                <strong>1.2 — Words & CAPs</strong>
                <span>Words, CAPs, reversals, 16-count sequences, 8-letter words</span>
              </button>
            </li>
          </ol>
        </nav>

        <section class="download">
          <h2>PDF Version</h2>
          <p>
            <a href="/guides/level-1.pdf" download>Download Level 1 PDF</a> (v0.5)
          </p>
        </section>
      </div>
    {:else if activeChapter === "positions-motions"}
      <h1>Positions & Motions</h1>
      <TheGrid />
      <HandPositions />
      <HandMotions />
      <Type1AlphaBeta />
      <Type1Gamma />
      <Type2Shifts />
      <Type3CrossShifts />
      <Type4Dash />
      <Type5DualDash />
      <Type6Static />
      <StaffPositions />
      <StaffMotions />
      <NegativeSpace />
    {:else if activeChapter === "letters"}
      <div class="coming-soon">
        <h1>1.1 — Letters</h1>
        <p>Chapter content in Phase 2.</p>
      </div>
    {:else if activeChapter === "words"}
      <div class="coming-soon">
        <h1>1.2 — Words & CAPs</h1>
        <p>Chapter content in Phase 3.</p>
      </div>
    {/if}
  </main>
</div>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap");

  .guide-tab {
    display: flex;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: #fafafa;
    color: #1a1a1a;
  }

  .guide-sidebar {
    width: 240px;
    min-width: 240px;
    height: 100%;
    overflow-y: auto;
    background: #fff;
    border-right: 1px solid #e5e5e5;
    padding: 1rem 0;
  }

  .guide-content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem 2rem 4rem;
    max-width: 860px;
  }

  /* Typography — mirror guide.css */
  .guide-content :global(h1) {
    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
    font-style: italic;
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 1rem;
    color: #1a1a1a;
  }

  .guide-content :global(h2) {
    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
    font-style: italic;
    font-size: 1.75rem;
    font-weight: 600;
    margin: 3rem 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e5e5e5;
    color: #1a1a1a;
  }

  .guide-content :global(h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 2rem 0 0.75rem;
    color: #333;
  }

  .guide-content :global(p) {
    font-size: 1.05rem;
    line-height: 1.7;
    margin: 0 0 1rem;
    color: #333;
  }

  /* Section spacing */
  .guide-content :global(.guide-section) {
    margin-bottom: 4rem;
  }

  .guide-content :global(.guide-section + .guide-section) {
    padding-top: 1rem;
  }

  /* Pictograph grid */
  .guide-content :global(.guide-pictograph-grid) {
    display: grid;
    gap: 0.75rem;
    margin: 1.5rem 0;
  }

  .guide-content :global(.guide-pictograph) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .guide-content :global(.guide-pictograph .pictograph-wrapper) {
    border-radius: 6px;
    overflow: hidden;
    background: #fff;
  }

  .guide-content :global(.guide-pictograph.bordered .pictograph-wrapper) {
    border: 1px solid #e0e0e0;
  }

  .guide-content :global(.guide-pictograph .pictograph-label) {
    font-size: 0.85rem;
    font-weight: 600;
    color: #444;
    text-align: center;
  }

  .guide-content :global(.guide-pictograph.size-sm .pictograph-wrapper) { width: 120px; height: 120px; }
  .guide-content :global(.guide-pictograph.size-md .pictograph-wrapper) { width: 180px; height: 180px; }
  .guide-content :global(.guide-pictograph.size-lg .pictograph-wrapper) { width: 280px; height: 280px; }

  /* Diagram */
  .guide-content :global(.guide-diagram) {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 1.5rem 0;
  }

  .guide-content :global(.guide-diagram img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }

  .guide-content :global(.guide-diagram figcaption) {
    font-size: 0.9rem;
    color: #666;
    margin-top: 0.5rem;
    text-align: center;
    font-style: italic;
  }

  /* Sequence player */
  .guide-content :global(.guide-sequence-player) {
    margin: 1.5rem 0;
    padding: 1rem;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
  }

  /* Type color coding */
  .guide-content :global(.type-dual-shift) { color: #4ea7e8; }
  .guide-content :global(.type-shift) { color: #6c5ba8; }
  .guide-content :global(.type-cross-shift) { color: #2d8f5e; }
  .guide-content :global(.type-dash) { color: #d4832f; }
  .guide-content :global(.type-dual-dash) { color: #2a9d9d; }
  .guide-content :global(.type-static) { color: #808080; }
  .guide-content :global(.hand-blue) { color: #1d3a86; }
  .guide-content :global(.hand-red) { color: #c1272d; }

  /* Grid headers/labels */
  .guide-content :global(.guide-pictograph-grid .column-headers) { display: contents; }
  .guide-content :global(.guide-pictograph-grid .column-header) {
    font-weight: 600;
    font-size: 0.9rem;
    text-align: center;
    color: #555;
    padding-bottom: 0.25rem;
  }
  .guide-content :global(.guide-pictograph-grid .row-label) {
    display: flex;
    flex-direction: column;
    justify-content: center;
    font-weight: 600;
    font-size: 0.9rem;
    color: #333;
    padding-right: 0.75rem;
  }
  .guide-content :global(.guide-pictograph-grid .row-sublabel) {
    font-weight: 400;
    font-size: 0.8rem;
    color: #888;
    display: block;
  }

  /* Landing page */
  .landing {
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
  }

  .cover-art {
    width: 100%;
    max-width: 400px;
    border-radius: 8px;
    margin-bottom: 2rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }

  .subtitle {
    font-size: 1.2rem;
    color: #666;
    margin-bottom: 0.5rem;
  }

  .byline {
    font-size: 0.95rem;
    color: #888;
    margin-bottom: 2rem;
  }

  .sign-off {
    margin-top: 1.5rem;
    font-style: italic;
  }

  .read-me-first, .download {
    text-align: left;
    margin: 2rem 0;
  }

  .download a {
    color: #4ea7e8;
  }

  .toc {
    text-align: left;
    margin: 2rem 0;
  }

  .toc ol {
    list-style: none;
    padding: 0;
  }

  .toc li {
    margin-bottom: 1rem;
  }

  .toc-card {
    all: unset;
    display: block;
    width: 100%;
    padding: 1rem;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
  }

  .toc-card:hover {
    border-color: #4ea7e8;
    box-shadow: 0 2px 8px rgba(78, 167, 232, 0.15);
  }

  .toc-card span {
    display: block;
    font-size: 0.9rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .coming-soon {
    text-align: center;
    padding: 4rem 2rem;
    color: #888;
  }

  .coming-soon p {
    color: #888;
  }

  /* Nav button in sidebar */
  .guide-sidebar :global(.nav-title-btn) {
    all: unset;
    cursor: pointer;
    font-weight: 700;
    font-size: 1.1rem;
    min-height: 48px;
    padding: 0.5rem 0.75rem;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    box-sizing: border-box;
  }

  /* Nav styling passthrough */
  .guide-sidebar :global(.guide-nav) { padding: 0 1rem; }
  .guide-sidebar :global(.guide-nav .nav-title) {
    font-weight: 700;
    font-size: 1rem;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
  }
  .guide-sidebar :global(.chapter-group) { margin-bottom: 1rem; }
  .guide-sidebar :global(.chapter-title) {
    all: unset;
    font-weight: 600;
    font-size: 1rem;
    min-height: 48px;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    box-sizing: border-box;
  }
  .guide-sidebar :global(.chapter-title:hover) { background: #f5f5f5; }
  .guide-sidebar :global(.chapter-title.active) { color: #4ea7e8; background: #eef6fd; }
  .guide-sidebar :global(.section-list) { list-style: none; padding: 0; margin: 0; }
  .guide-sidebar :global(.section-link) {
    display: flex;
    align-items: center;
    font-size: 1rem;
    min-height: 48px;
    padding: 0.25rem 0.75rem 0.25rem 1.25rem;
    color: #1a1a1a;
    text-decoration: none;
    border-radius: 4px;
    transition: color 0.1s, background 0.1s;
    box-sizing: border-box;
  }
  .guide-sidebar :global(.section-link:hover) { color: #1a1a1a; background: #f5f5f5; }
  .guide-sidebar :global(.section-link.active) { color: #4ea7e8; font-weight: 600; }
</style>
