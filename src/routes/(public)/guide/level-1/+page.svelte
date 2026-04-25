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
