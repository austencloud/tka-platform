<script lang="ts">
  import GuideSeo from "./_components/GuideSeo.svelte";
</script>

<GuideSeo
  kind="Course"
  title="Level 1 Guide: The Kinetic Alphabet"
  description="The Kinetic Alphabet Level 1 guide: positions, motions, letters, words, and LOOPs — a grid-based notation system for double staves and dual-wielded props."
  path="/guide/level-1"
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "Guide", path: "/guide" },
    { name: "Level 1", path: "/guide/level-1" },
  ]}
/>

<div class="landing">
  <div class="cover-art">
    <!-- Crop the baked bottom byline ("v 0.5") off the cover art; version is v1.0
         from the byline text below. -->
    <img
      src="/guide/level-1/images/_shared/level-1-front-cover.png"
      alt="The Kinetic Alphabet Level 1 cover"
    />
  </div>

  <h1>The Kinetic Alphabet</h1>
  <p class="subtitle">Level 1 - Positions, Motions, Letters & Words</p>
  <p class="byline">Created by Austen Cloud &middot; v1.0</p>

  <section class="read-me-first">
    <h2>Read Me First</h2>
    <p>
      You've come across The Kinetic Alphabet, a notation system designed to
      help you craft and communicate your own unique choreography. This grid-based
      language is designed for music, using pictographs and letters that combine like
      puzzle pieces for each step. This system has propelled my sequence creation to
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
      This system is continually growing. Whether you fully embrace it, draw
      inspiration from certain parts, or follow a different path altogether, I hope
      the ideas presented here contribute to your creative growth.
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
        <a href="/guide/level-1/positions-motions">
          <strong>1.0 - Positions & Motions</strong>
          <span>The grid, hand positions, hand motions, Types 1–6, staff positions, negative space</span>
        </a>
      </li>
      <li>
        <a href="/guide/level-1/letters">
          <strong>1.1 - Letters</strong>
          <span>Codex, Type 1 letters, compound letters, gamma letters, Types 2–6</span>
        </a>
      </li>
      <li>
        <a href="/guide/level-1/words">
          <strong>1.2 - Words & LOOPs</strong>
          <span>Words, LOOPs, reversals, 16-count sequences, 8-letter words</span>
        </a>
      </li>
    </ol>
  </nav>

  <section class="download">
    <h2>Print &amp; PDF</h2>
    <p>
      <a href="/guide/level-1/print">Open the printable version</a>, then use your
      browser's Print or Save as PDF to hand it out.
    </p>
    <p>
      <a href="/guides/level-1.pdf" download>Download Level 1 PDF</a> (v1.0)
    </p>
  </section>
</div>

<style>
  .landing {
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
    padding-top: 2rem;
  }

  .cover-art {
    width: 100%;
    max-width: 400px;
    aspect-ratio: 613 / 714;
    margin: 0 auto 2rem;
    overflow: hidden;
    border-radius: 16px;
    box-shadow: 0 8px 40px oklch(0.05 0.02 270 / 0.5);
    border: 1px solid oklch(0.30 0.04 270 / 0.15);
    background: #fff;
  }

  .cover-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
  }

  .subtitle {
    font-size: 1.2rem;
    color: oklch(0.55 0.02 270);
    margin-bottom: 0.5rem;
  }

  .byline {
    font-size: 0.95rem;
    color: oklch(0.45 0.02 270);
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
    border: 1px solid oklch(0.30 0.04 270 / 0.15);
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    background: oklch(0.16 0.018 270 / 0.4);
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }

  .toc a:hover {
    border-color: oklch(0.50 0.15 270 / 0.4);
    box-shadow: 0 4px 16px oklch(0.45 0.15 270 / 0.12);
  }

  .toc span {
    display: block;
    font-size: 0.9rem;
    color: oklch(0.50 0.02 270);
    margin-top: 0.25rem;
  }

  .download a {
    color: oklch(0.70 0.18 270);
  }
</style>
