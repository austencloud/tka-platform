<script lang="ts">
</script>

<svelte:head>
  <title>Level 2 — Turns</title>
  <meta name="description" content="The Kinetic Alphabet Level 2 guide — adding prop rotations (1-turns and 2-turns) to the base motions." />
</svelte:head>

<div class="landing">
  <h1>The Kinetic Alphabet</h1>
  <p class="subtitle">Level 2 — Turns</p>
  <p class="byline">Created by Austen Cloud</p>

  <section class="intro">
    <p>
      Level 2 introduces turns — 180° and 360° prop rotations layered onto the base motions
      from Level 1. Each turn adds a thumb switch. The glyph system expands with high/low
      slots, PADS ordering, and rotational-relationship dots.
    </p>
  </section>

  <nav class="toc" aria-label="Table of contents">
    <h2>Chapters</h2>
    <ol>
      <li>
        <a href="/guide/level-2/turns">
          <strong>2.0 — 1-Turns</strong>
          <span>Shifts, dashes, static turns, glyphs/PADS, Types 1–6 with turns, opening/closing, 1|1 turns</span>
        </a>
      </li>
      <li>
        <a href="/guide/level-2/double-turns">
          <strong>2.1 — 2-Turns</strong>
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
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
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
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .toc a:hover {
    border-color: #4ea7e8;
    box-shadow: 0 2px 8px rgba(78, 167, 232, 0.15);
  }

  .toc span {
    display: block;
    font-size: 0.9rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .download a {
    color: #4ea7e8;
  }
</style>
