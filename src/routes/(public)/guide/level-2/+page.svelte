<script lang="ts">
  import GuideSeo from "../level-1/_components/GuideSeo.svelte";
</script>

<GuideSeo
  kind="Course"
  title="Level 2 Guide: Turns | The Kinetic Alphabet"
  description="The Kinetic Alphabet Level 2 guide: adding prop rotations (1-turns and 2-turns) to the base motions, with expanded glyphs, PADS ordering, and rotational-relationship dots."
  path="/guide/level-2"
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "Guide", path: "/guide" },
    { name: "Level 2", path: "/guide/level-2" },
  ]}
/>

<div class="landing">
  <h1>The Kinetic Alphabet</h1>
  <p class="subtitle">Level 2: Turns</p>
  <p class="byline">Created by Austen Cloud</p>

  <section class="intro">
    <p>
      Level 2 introduces turns: 180° and 360° prop rotations layered onto the base motions
      from Level 1. Each turn adds a thumb switch. The glyph system expands with high/low
      slots, PADS ordering, and rotational-relationship dots.
    </p>
  </section>

  <nav class="toc" aria-label="Table of contents">
    <h2>Chapters</h2>
    <ol>
      <li>
        <a href="/guide/level-2/turns">
          <strong>2.0: 1-Turns</strong>
          <span>Shifts, dashes, static turns, glyphs/PADS, Types 1–6 with turns, opening/closing, 1|1 turns</span>
        </a>
      </li>
      <li>
        <a href="/guide/level-2/double-turns">
          <strong>2.1: 2-Turns</strong>
          <span>Double-turning shifts, dashes, static, and codex reference pages</span>
        </a>
      </li>
    </ol>
  </nav>

  <section class="download">
    <h2>PDF Version</h2>
    <p>
      <a href="/guides/level-2.pdf" download>Download Level 2 PDF</a>
    </p>
  </section>
</div>

<style>
  .landing {
    /* rem (not the old 600px) so the landing rides guide.css's >=1680px root
       ramp with the rest of the shell; 42rem also gives the chapter cards a
       little more room at every size. */
    max-width: 42rem;
    margin: 0 auto;
    padding-top: 1.5rem;
    text-align: center;
  }

  /* Title in the guide's calligraphic script - parity with the hub's hero and
     the level-1 topic heroes, instead of the generic Inter h1 the shared
     .guide-content rule applies. */
  .landing h1 {
    font-family: var(--guide-script, "Cormorant Garamond", Georgia, serif);
    font-weight: var(--guide-script-weight, 700);
    font-variation-settings: normal;
    letter-spacing: 0;
    line-height: 0.95;
    font-size: clamp(3rem, 2rem + 2vw, 4.6rem);
    padding: 1.5rem 0 0.5rem;
  }

  /* The level-2 layout renders on the dark guide scroller background
     (.guide-layout is oklch(0.13 0.015 270)), so all colors here must be
     dark-theme values - the old #666/#888/#e5e5e5 set was written for a white
     page and was near-invisible. */
  .subtitle {
    font-size: 1.2rem;
    color: oklch(0.68 0.02 270);
    margin-bottom: 0.5rem;
  }

  .byline {
    font-size: 0.95rem;
    color: oklch(0.58 0.02 270);
    margin-bottom: 2rem;
  }

  .intro, .download {
    text-align: left;
    margin: 2rem 0;
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

  .toc a {
    display: block;
    padding: 1rem;
    background: oklch(0.18 0.02 270 / 0.6);
    border: 1px solid oklch(0.45 0.04 270 / 0.35);
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .toc a:hover {
    border-color: #4ea7e8;
    box-shadow: 0 2px 8px rgba(78, 167, 232, 0.25);
  }

  .toc span {
    display: block;
    font-size: 0.9rem;
    color: oklch(0.68 0.02 270);
    margin-top: 0.25rem;
  }

  .download a {
    color: #4ea7e8;
  }
</style>
