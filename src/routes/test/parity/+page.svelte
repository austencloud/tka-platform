<script lang="ts">
  /** Hardcoded index of every parity test harness. Add a row to register one. */
  const tests = [
    {
      href: "/test/trail-export-parity",
      title: "Trail Export Parity",
      desc: "Live render → real MP4 export → decode. Encoder + live-vs-offscreen gates.",
    },
    {
      href: "/test/card-back-parity",
      title: "Card Parity",
      desc: "Card back (old DOM vs new BackJob) and front (worker pool vs main thread).",
    },
  ];
</script>

<svelte:head><title>Parity Tests</title></svelte:head>

<div class="page">
  <h1>Parity Tests</h1>
  <p class="sub">
    Image-vs-image render parity harnesses. Each runs two sources, pixel-diffs them, and
    reports a PASS/FAIL verdict.
  </p>
  <ul>
    {#each tests as t (t.href)}
      <li>
        <a href={t.href}><span class="t">{t.title}</span><span class="d">{t.desc}</span></a>
      </li>
    {/each}
  </ul>
</div>

<style>
  .page {
    padding: 24px;
    background: #0d0d14;
    color: #eee;
    min-height: 100vh;
    font-family: system-ui, sans-serif;
  }
  h1 {
    margin: 0 0 4px;
  }
  .sub {
    color: #8a8aa0;
    margin: 0 0 18px;
    max-width: 70ch;
    font-size: 13px;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 720px;
  }
  a {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px 16px;
    border: 1px solid #2a2a40;
    border-radius: 8px;
    background: #11111f;
    text-decoration: none;
    color: inherit;
  }
  a:hover {
    border-color: #4c6ef5;
    background: #15152a;
  }
  .t {
    font-weight: 600;
    font-size: 15px;
    color: #fff;
  }
  .d {
    font-size: 13px;
    color: #8a8aa0;
  }
</style>
