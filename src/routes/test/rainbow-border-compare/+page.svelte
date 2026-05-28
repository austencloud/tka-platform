<script lang="ts">
  const RAINBOW = [
    "#cc0000", "#cc3300", "#cc6600", "#cc9900",
    "#cccc00", "#66cc00", "#00cc00", "#00cc66",
    "#0066cc", "#0033cc", "#6600cc", "#cc0066",
  ];

  const cols = 3;
  const rows = 3;
  const cards = cols * rows;
</script>

<svelte:head>
  <title>Rainbow Border Comparison</title>
</svelte:head>

<div class="page">
  <h1>Rainbow Border — Two Approaches</h1>

  <div class="comparison">
    <div class="option">
      <h2>Option A: Vertical gradient (1×)</h2>
      <p class="desc">Full rainbow bottom→top on each card. Top/bottom edges = uniform color. Left/right edges = full spectrum but consistent on both sides.</p>
      <div class="sheet">
        {#each Array(rows) as _, row}
          {#each Array(cols) as _, col}
            {@const idx = row * cols + col}
            <div
              class="card"
              style="border: 8px solid transparent; border-image: linear-gradient(to top, #cc0000, #cc6600, #cccc00, #00cc00, #0066cc, #6600cc, #cc0066) 1;"
            >
              <div class="card-inner">
                <span class="card-label">Card {idx + 1}</span>
              </div>
            </div>
          {/each}
        {/each}
      </div>
      <p class="verdict">Top/bottom cuts = one color. Sides = smooth gradient, same on both edges.</p>
    </div>

    <div class="option">
      <h2>Option B: Vertical gradient (2×)</h2>
      <p class="desc">Rainbow repeats twice bottom→top. Denser color bands, more vibrant. Same cut tolerance as A.</p>
      <div class="sheet">
        {#each Array(rows) as _, row}
          {#each Array(cols) as _, col}
            {@const idx = row * cols + col}
            <div
              class="card"
              style="border: 8px solid transparent; border-image: linear-gradient(to top, #cc0000, #cc6600, #cccc00, #00cc00, #0066cc, #6600cc, #cc0066, #cc0000, #cc6600, #cccc00, #00cc00, #0066cc, #6600cc, #cc0066) 1;"
            >
              <div class="card-inner">
                <span class="card-label">Card {idx + 1}</span>
              </div>
            </div>
          {/each}
        {/each}
      </div>
      <p class="verdict">Same cut tolerance — twice the rainbow density.</p>
    </div>
  </div>

  <div class="comparison">
    <div class="option">
      <h2>Option A — zoomed side edge</h2>
      <p class="desc">What an imperfect vertical cut looks like:</p>
      <div class="zoom-demo">
        <div class="zoom-card vertical" style="background: linear-gradient(to top, #cc0000, #cc6600, #cccc00, #00cc00, #0066cc, #6600cc, #cc0066);">
          <div class="cut-line-vertical"></div>
          <span class="cut-label-v">← cut shifts left/right — same colors top to bottom on both sides</span>
        </div>
      </div>
    </div>

    <div class="option">
      <h2>Option B — zoomed side edge</h2>
      <p class="desc">What an imperfect vertical cut looks like:</p>
      <div class="zoom-demo">
        <div class="zoom-card vertical" style="background: linear-gradient(to top, #cc0000, #cc6600, #cccc00, #00cc00, #0066cc, #6600cc, #cc0066, #cc0000, #cc6600, #cccc00, #00cc00, #0066cc, #6600cc, #cc0066);">
          <div class="cut-line-vertical"></div>
          <span class="cut-label-v">← same tolerance, tighter color bands</span>
        </div>
      </div>
    </div>
  </div>

  <div class="comparison">
    <div class="option">
      <h2>Top/bottom edge (both options)</h2>
      <p class="desc">Horizontal cut at top or bottom:</p>
      <div class="zoom-demo">
        <div class="zoom-card" style="background: #cc0066;">
          <div class="cut-line"></div>
          <span class="cut-label">← cut here (any drift) — still one color</span>
        </div>
      </div>
    </div>

    <div class="option">
      <h2>Diagonal 135° (current theme)</h2>
      <p class="desc">For reference — what the current rainbow border does:</p>
      <div class="zoom-demo">
        <div class="zoom-card" style="background: linear-gradient(135deg, #cc0000, #cc6600, #cccc00, #00cc00, #0066cc, #6600cc, #cc0066, #cc0000);">
          <div class="cut-line"></div>
          <span class="cut-label">← current 135° — color shifts on every edge</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .page {
    width: 100vw;
    min-height: 100vh;
    background: #0f1117;
    color: #e0e0e0;
    padding: 40px;
    font-family: system-ui, -apple-system, sans-serif;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 32px;
    text-align: center;
  }

  .comparison {
    display: flex;
    gap: 48px;
    justify-content: center;
    margin-bottom: 48px;
    flex-wrap: wrap;
  }

  .option {
    max-width: 420px;
  }

  h2 {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 8px;
  }

  .desc {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0 0 16px;
    line-height: 1.5;
  }

  .verdict {
    font-size: 13px;
    font-weight: 600;
    color: #a78bfa;
    margin: 12px 0 0;
    text-align: center;
  }

  .sheet {
    display: grid;
    grid-template-columns: repeat(3, 120px);
    gap: 4px;
    background: #1a1a2e;
    padding: 16px;
    border-radius: 8px;
    justify-content: center;
  }

  .card {
    aspect-ratio: 2.5 / 3.5;
    border-radius: 4px;
    overflow: hidden;
  }

  .card-inner {
    width: 100%;
    height: 100%;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
  }

  .card-label {
    font-size: 11px;
    color: #666;
    font-weight: 500;
  }

  .zoom-demo {
    background: #1a1a2e;
    padding: 24px;
    border-radius: 8px;
  }

  .zoom-card {
    width: 100%;
    height: 60px;
    border-radius: 4px;
    position: relative;
    display: flex;
    align-items: center;
  }

  .cut-line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 30%;
    width: 2px;
    background: #fff;
    opacity: 0.8;
    box-shadow: 0 0 8px rgba(255,255,255,0.5);
  }

  .cut-label {
    font-size: 11px;
    color: #fff;
    margin-left: calc(30% + 12px);
    text-shadow: 0 1px 4px rgba(0,0,0,0.8);
  }

  .zoom-card.vertical {
    height: 160px;
    width: 60px;
  }

  .cut-line-vertical {
    position: absolute;
    left: 0;
    right: 0;
    top: 40%;
    height: 2px;
    background: #fff;
    opacity: 0.8;
    box-shadow: 0 0 8px rgba(255,255,255,0.5);
  }

  .cut-label-v {
    position: absolute;
    font-size: 11px;
    color: #fff;
    left: 72px;
    top: calc(40% - 8px);
    white-space: nowrap;
    text-shadow: 0 1px 4px rgba(0,0,0,0.8);
  }
</style>
