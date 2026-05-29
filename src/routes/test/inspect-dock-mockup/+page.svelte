<script lang="ts">
  // STATIC VISUAL MOCKUP — inspect modal with reserved footer editor dock.
  // Presentational only. No real positioning logic. Disposable design artifact.
  type DockState = "idle" | "blue" | "red";
  let dock = $state<DockState>("blue");
  let tier = $state<"global" | "special" | "prop">("global");

  const colorToken = $derived(
    dock === "red" ? "var(--prop-red, #f85149)" : "var(--prop-blue, #58a6ff)"
  );
  const colorName = $derived(dock === "red" ? "Red" : "Blue");
  const tierName = $derived(
    tier === "global"
      ? "Global Override"
      : tier === "special"
        ? "Special JSON"
        : "Prop Geometry"
  );
</script>

<div class="stage">
  <div class="toolbar">
    <span>Preview:</span>
    <button class:on={dock === "idle"} onclick={() => (dock = "idle")}>Idle (no selection)</button>
    <button class:on={dock === "blue"} onclick={() => (dock = "blue")}>Blue selected</button>
    <button class:on={dock === "red"} onclick={() => (dock = "red")}>Red selected</button>
  </div>

  <div class="modal-content">
    <!-- Header -->
    <header class="modal-header">
      <div class="hleft">
        <span class="title-icon"><i class="fas fa-magnifying-glass"></i></span>
        <h2>Inspect</h2>
        <span class="chip">Beat 7</span>
        <span class="chip letter">H</span>
      </div>
      <div class="hactions">
        <button class="hbtn"><i class="fas fa-robot"></i> Copy AI</button>
        <button class="hbtn"><i class="fas fa-code"></i> JSON</button>
        <button class="hbtn x"><i class="fas fa-times"></i></button>
      </div>
    </header>

    <!-- Slim full-width info bar (was a whole column) -->
    <div class="info-bar">
      <div class="basic-line">
        <span class="bl letter">H</span>
        <span class="sep">·</span>
        <span class="bl">diamond</span>
        <span class="sep">·</span>
        <span class="bl">staff</span>
        <span class="sep">·</span>
        <span class="bl path">beta5 → beta3</span>
      </div>
      <div class="lookup">
        <span class="lk">ori_key <b>in_in</b></span>
        <span class="lk">turns <b>(0,0)</b></span>
      </div>
    </div>

    <!-- Body: pictograph + two motion columns -->
    <div class="modal-body">
      <div class="inspect-layout">
        <div class="pictograph-rail">
          <div class="pictograph-frame">
            <span class="pic-letter">H</span>
            <span class="pic-hint">live pictograph<br />(click an arrow)</span>
          </div>
        </div>

        <div class="detail-column">
          <!-- Blue Motion -->
          <section class="card" class:sel={dock === "blue"}>
            <div class="card-head"><span class="dot blue"></span> Blue Motion</div>
            <div class="motion-line">
              <span class="mt">anti</span>
              <span class="rot">cw</span>
              <span class="path">s→e</span>
              <span class="ori">in→out</span>
              <span class="turns">0t</span>
            </div>
            <div class="placement-line">
              <span class="pl">640, 675</span>
              <span class="pl">180°</span>
              <span class="pl mir">mirrored</span>
            </div>
            <div class="tier-list">
              <div class="tier" class:active={true}><span class="ic">★</span> Global Override<span class="tv none">none</span></div>
              <div class="tier"><span class="ic">●</span> Special JSON<span class="tv">[15,-50]</span></div>
              <div class="tier"><span class="ic">●</span> Prop Geometry<span class="tv none">none</span></div>
              <div class="tier"><span class="ic">●</span> Default<span class="tv">[45,-55]</span></div>
            </div>
            <div class="summary">base <b>[15,-50]</b> → rotated <b>[15,50]</b></div>
          </section>

          <!-- Red Motion -->
          <section class="card" class:sel={dock === "red"}>
            <div class="card-head"><span class="dot red"></span> Red Motion</div>
            <div class="motion-line">
              <span class="mt">anti</span>
              <span class="rot">cw</span>
              <span class="path">s→e</span>
              <span class="ori">in→out</span>
              <span class="turns">0t</span>
            </div>
            <div class="placement-line">
              <span class="pl">680, 745</span>
              <span class="pl">180°</span>
              <span class="pl mir">mirrored</span>
            </div>
            <div class="tier-list">
              <div class="tier" class:active={true}><span class="ic">★</span> Global Override<span class="tv none">none</span></div>
              <div class="tier"><span class="ic">●</span> Special JSON<span class="tv">[55,-120]</span></div>
              <div class="tier"><span class="ic">●</span> Prop Geometry<span class="tv none">none</span></div>
              <div class="tier"><span class="ic">●</span> Default<span class="tv">[45,-55]</span></div>
            </div>
            <div class="summary">base <b>[55,-120]</b> → rotated <b>[55,120]</b></div>
          </section>
        </div>
      </div>
    </div>

    <!-- Reserved footer dock -->
    <footer class="dock" class:idle={dock === "idle"} style="--c: {colorToken}">
      {#if dock === "idle"}
        <span class="dock-idle"><i class="fas fa-hand-pointer"></i> Select an arrow to adjust its position →</span>
      {:else}
        <div class="dock-head">
          <span class="dock-dot" style="background: {colorToken}"></span>
          <span class="dock-title">{colorName} · {tierName}</span>
        </div>

        <div class="seg">
          <button class:on={tier === "global"} onclick={() => (tier = "global")}>Global</button>
          <button class:on={tier === "special"} onclick={() => (tier = "special")}>Special JSON</button>
          <button class:on={tier === "prop"} onclick={() => (tier = "prop")}>Prop Geometry</button>
        </div>

        <div class="dock-vals">
          <label>X<input type="number" value="15" /></label>
          <label>Y<input type="number" value="-50" /></label>
        </div>

        <span class="dock-hint"><kbd>W A S D</kbd> move · Shift ×4 · Ctrl+Shift ×40</span>

        <div class="dock-actions">
          <button class="btn del"><i class="fas fa-trash-alt"></i></button>
          <button class="btn save"><i class="fas fa-save"></i> Save</button>
        </div>
      {/if}
    </footer>
  </div>
</div>

<style>
  .stage {
    min-height: 100vh;
    background: #05070c;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px;
    font-family: system-ui, sans-serif;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #9aa4b2;
    font-size: 13px;
  }
  .toolbar button {
    min-height: 44px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.03);
    color: #c9d1d9;
    font-size: 14px;
    cursor: pointer;
  }
  .toolbar button.on {
    border-color: #58a6ff;
    color: #58a6ff;
    background: rgba(88, 166, 255, 0.12);
  }

  .modal-content {
    background: var(--theme-panel-bg, rgba(13, 17, 23, 0.98));
    border: 1px solid var(--theme-stroke, #30363d);
    border-radius: 8px;
    width: min(94vw, 1700px);
    max-height: min(88vh, 1000px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.7);
    color: var(--theme-text, #fff);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke, #30363d);
  }
  .hleft { display: flex; align-items: center; gap: 10px; }
  .title-icon {
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    border-radius: 8px; background: color-mix(in srgb, var(--theme-accent, #58a6ff) 16%, transparent);
    color: var(--theme-accent, #58a6ff); font-size: 12px;
  }
  .hleft h2 { margin: 0; font-size: 14px; font-weight: 700; }
  .chip {
    padding: 3px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1); font-size: 12px; color: #9aa4b2; font-weight: 600;
  }
  .chip.letter { color: #fff; }
  .hactions { display: flex; gap: 6px; }
  .hbtn {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 0 14px; min-height: 44px; border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12); background: transparent; color: #c9d1d9;
    font-size: 14px; cursor: pointer;
  }
  .hbtn.x { width: 44px; padding: 0; justify-content: center; }

  .info-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    padding: 10px 18px;
    border-bottom: 1px solid var(--theme-stroke, #30363d);
    background: rgba(255, 255, 255, 0.015);
  }
  .lookup { display: flex; gap: 8px; flex-wrap: wrap; }
  .lk {
    font-size: 12px;
    color: #6b7480;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    padding: 3px 8px;
    font-variant-numeric: tabular-nums;
  }
  .lk b { color: #c9d1d9; font-weight: 700; }

  .modal-body { flex: 0 1 auto; min-height: 0; overflow-y: auto; padding: 16px; }
  .inspect-layout {
    display: grid; grid-template-columns: minmax(280px, 400px) 1fr; gap: 20px; align-items: start;
  }
  .pictograph-rail { align-self: center; }
  .pictograph-frame {
    background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px; padding: 16px; aspect-ratio: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 10px; position: relative;
  }
  .pic-letter { font-size: 64px; font-weight: 800; color: #fff; }
  .pic-hint { color: #6b7480; font-size: 12px; text-align: center; }

  .detail-column {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
    align-items: start; gap: 12px; min-width: 0;
  }
  .card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .card.sel {
    border-color: var(--c, #58a6ff);
    box-shadow: 0 0 0 1px var(--c, #58a6ff), 0 0 24px -8px var(--c, #58a6ff);
  }
  .card-head { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .dot.info { background: #79c0ff; }
  .dot.blue { background: var(--prop-blue, #58a6ff); }
  .dot.red { background: var(--prop-red, #f85149); }
  .rows { display: flex; flex-direction: column; gap: 2px; }
  .rows.two { display: grid; grid-template-columns: 1fr 1fr; column-gap: 16px; row-gap: 2px; }
  .row { display: flex; justify-content: space-between; padding: 4px 8px; border-radius: 6px; gap: 10px; }
  .k { font-size: 12px; color: #8b949e; }
  .v { font-size: 14px; color: #fff; font-variant-numeric: tabular-nums; }
  .v.hl { color: #79c0ff; font-weight: 600; }
  .v.warn { color: #ffa657; font-weight: 600; }

  /* Dense label-less basic line: "H · diamond · staff · beta5→beta3" */
  .basic-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #c9d1d9;
    font-variant-numeric: tabular-nums;
    padding: 2px;
  }
  .basic-line .letter { color: #79c0ff; font-weight: 800; font-size: 19px; }
  .basic-line .path { color: #fff; }
  .basic-line .sep { color: #3a4250; }

  /* Dense label-less motion shorthand: "anti cw s→e in→out 0t" */
  .motion-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 10px;
    font-size: 17px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    padding: 2px 2px 4px;
  }
  .motion-line .mt { color: #ffa657; }
  .motion-line .rot { color: #d2a8ff; }
  .motion-line .path { color: #fff; }
  .motion-line .ori { color: #79c0ff; }
  .motion-line .turns { color: #8b949e; }
  .placement-line {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-size: 13px;
    color: #8b949e;
    font-variant-numeric: tabular-nums;
  }
  .placement-line .pl { color: #c9d1d9; }
  .placement-line .mir { color: #6b7480; font-style: italic; }

  .tier-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
  .tier {
    display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.02); font-size: 14px;
  }
  .tier.active { border-color: #3fb950; background: rgba(63, 185, 80, 0.08); }
  .tier .ic { color: #6b7480; width: 14px; text-align: center; }
  .tier.active .ic { color: #3fb950; }
  .tv { margin-left: auto; font-variant-numeric: tabular-nums; }
  .tv.none { color: #6b7480; font-style: italic; }
  .summary { text-align: center; font-size: 13px; color: #9aa4b2; padding-top: 6px; }
  .summary b { color: #fff; }

  /* Reserved footer dock — constant height, idle or active */
  .dock {
    flex: none;
    min-height: 64px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 18px;
    border-top: 1px solid var(--theme-stroke, #30363d);
    background: color-mix(in srgb, var(--c, #58a6ff) 8%, var(--theme-panel-bg, #0d1117));
  }
  .dock.idle { background: var(--theme-panel-bg, #0d1117); }
  .dock-idle { color: #6b7480; font-size: 14px; display: flex; align-items: center; gap: 8px; }

  .dock-head { display: flex; align-items: center; gap: 8px; }
  .dock-dot { width: 12px; height: 12px; border-radius: 50%; }
  .dock-title { font-size: 14px; font-weight: 700; white-space: nowrap; }

  .seg { display: flex; gap: 4px; background: rgba(0, 0, 0, 0.25); padding: 4px; border-radius: 12px; }
  .seg button {
    min-height: 44px; padding: 0 16px; border-radius: 9px; border: none; background: transparent;
    color: #9aa4b2; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .seg button.on { background: var(--c, #58a6ff); color: #fff; }

  .dock-vals { display: flex; gap: 12px; }
  .dock-vals label { display: flex; align-items: center; gap: 6px; color: #8b949e; font-size: 14px; font-weight: 600; }
  .dock-vals input {
    width: 76px; min-height: 44px; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(0, 0, 0, 0.25); color: #fff; font-size: 18px; font-weight: 700; text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .dock-hint { color: #6b7480; font-size: 12px; display: flex; align-items: center; gap: 8px; }
  .dock-hint kbd {
    background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px; padding: 3px 9px; font-size: 12px; font-weight: 700;
  }

  .dock-actions { margin-left: auto; display: flex; gap: 8px; }
  .btn {
    padding: 0 20px; min-height: 44px; border-radius: 10px; font-size: 14px; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  .btn.del { background: transparent; color: #f85149; border-color: rgba(248, 81, 73, 0.4); width: 44px; padding: 0; }
  .btn.save { background: #238636; color: #fff; border-color: #238636; }
</style>
