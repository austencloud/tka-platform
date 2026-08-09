<svelte:head><title>Replay fixture</title></svelte:head>

<main class="player-fixture" aria-label="Replay fixture">
  <div class="browser-frame">
    <div class="browser-bar">
      <span></span><span></span><span></span>
      <div>tkaflowarts.com/create</div>
    </div>
    <div class="recorded-app">
      <aside></aside>
      <section>
        <span>Recorded app viewport</span>
        <div class="pictograph"></div>
      </section>
      <i class="cursor fas fa-arrow-pointer" aria-hidden="true"></i>
    </div>
  </div>
  <div class="controls">
    <i class="fas fa-pause" aria-hidden="true"></i>
    <span>00:16</span>
    <div><span></span></div>
    <span>02:41</span>
    <strong>1×</strong>
  </div>
</main>

<style>
  :global(html),
  :global(body) {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    background: #101827;
    color: #eef2ff;
    font-family: Inter, system-ui, sans-serif;
  }

  .player-fixture {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    width: 100%;
    height: 100%;
  }

  .browser-frame {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    margin: 1rem 1rem 0;
    overflow: hidden;
    border: 1px solid #334155;
    border-radius: 0.6rem;
    background: #070b14;
  }

  .browser-bar {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 0.7rem;
    background: #1e293b;
  }

  .browser-bar > span {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: #64748b;
  }

  .browser-bar div {
    flex: 1;
    margin-left: 0.4rem;
    padding: 0.25rem 0.6rem;
    border-radius: 0.3rem;
    background: #0f172a;
    color: #94a3b8;
    font-size: 0.72rem;
  }

  .recorded-app {
    position: relative;
    display: grid;
    grid-template-columns: 3rem 1fr;
    min-height: 0;
  }

  .recorded-app aside {
    background: #020617;
    border-right: 1px solid #1e293b;
  }

  .recorded-app section {
    display: grid;
    place-items: center;
    color: #64748b;
    font-size: 0.8rem;
  }

  .pictograph {
    width: 5rem;
    height: 5rem;
    border: 2px solid #22c55e;
    border-radius: 50%;
    box-shadow: 0 0 2.5rem rgb(34 197 94 / 25%);
  }

  .cursor {
    position: absolute;
    top: 54%;
    left: 57%;
    color: white;
    filter: drop-shadow(0 1px 2px black);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #111827;
    color: #cbd5e1;
    font-size: 0.75rem;
  }

  .controls > div {
    flex: 1;
    height: 0.25rem;
    overflow: hidden;
    border-radius: 999px;
    background: #334155;
  }

  .controls > div span {
    display: block;
    width: 18%;
    height: 100%;
    background: #f97316;
  }
</style>
