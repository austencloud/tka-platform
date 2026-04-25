<script lang="ts">
</script>

<svelte:head>
  <title>Level 1 — The Kinetic Alphabet</title>
  <meta name="description" content="The Kinetic Alphabet Level 1 guide — positions, motions, letters, words, and CAPs for double staves." />
</svelte:head>

<div class="landing">
  <img
    class="cover-art"
    src="/guide/level-1/images/_shared/level-1-front-cover.png"
    alt="The Kinetic Alphabet Level 1 cover"
  />

  <h1>The Kinetic Alphabet</h1>
  <p class="subtitle">Level 1 — Positions, Motions, Letters & Words</p>

  <section class="read-me-first">
    <h2>Read Me First</h2>
    <p>
      The Kinetic Alphabet (TKA) is a writing system for object manipulation.
      Each letter represents a unique combination of hand motions performed
      with gripped props — staves, fans, clubs, or buugeng.
    </p>
    <p>
      This guide covers Level 1: the grid, hand and staff positions, six motion types,
      the complete Level 1 letter set, and how letters combine into words, CAPs, and reversals.
    </p>
  </section>

  <nav class="toc" aria-label="Table of contents">
    <h2>Chapters</h2>
    <ol>
      <li>
        <a href="/guide/level-1/positions-motions">
          <strong>1.0 — Positions & Motions</strong>
          <span>The grid, hand positions, hand motions, Types 1–6, staff positions, negative space</span>
        </a>
      </li>
      <li>
        <a href="/guide/level-1/letters">
          <strong>1.1 — Letters</strong>
          <span>Codex, Type 1 letters, compound letters, gamma letters, Types 2–6</span>
        </a>
      </li>
      <li>
        <a href="/guide/level-1/words">
          <strong>1.2 — Words & CAPs</strong>
          <span>Words, CAPs, reversals, 16-count sequences, 8-letter words</span>
        </a>
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

<style>
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
    margin-bottom: 2rem;
  }

  .read-me-first, .download {
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
