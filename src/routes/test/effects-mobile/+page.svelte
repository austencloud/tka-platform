<script lang="ts">
  // INTERACTIVE chooser for the dense mobile Effects section (tunnel + 2D share
  // it). Pure local state, no app imports (avoids the /test module-state
  // redirect). Real effect registry data transcribed so tiles look authentic.
  // CURRENT mimics today's density (static, for reference). A / B / C are the
  // three redesign directions — TAP THEM. Austen picks; then the real
  // EffectsPanel gets refactored to the winner.
  type Fx = { id: string; label: string; icon: string; color: string };
  const effects: Fx[] = [
    { id: "trails", label: "Trails", icon: "fa-route", color: "#60a5fa" },
    { id: "fire", label: "Fire", icon: "fa-fire", color: "#f97316" },
    { id: "led", label: "LED", icon: "fa-lightbulb", color: "#22c55e" },
    { id: "charcoal", label: "Coal", icon: "fa-diamond", color: "#a855f7" },
    { id: "zap", label: "Zap", icon: "fa-bolt", color: "#38bdf8" },
    { id: "sparkles", label: "Sparkle", icon: "fa-star", color: "#fbbf24" },
    { id: "ghost", label: "Ghost", icon: "fa-ghost", color: "#22d3ee" },
    { id: "bloom", label: "Bloom", icon: "fa-sun", color: "#f472b6" },
    { id: "goo", label: "Goo", icon: "fa-droplet", color: "#3a7fd9" },
    { id: "bubbles", label: "Bubbles", icon: "fa-circle-notch", color: "#c8e0ff" },
    { id: "petals", label: "Petals", icon: "fa-leaf", color: "#ffc0d8" },
    { id: "smoke", label: "Smoke", icon: "fa-smog", color: "#c0c0c8" },
    { id: "ink", label: "Ink", icon: "fa-paint-brush", color: "#b8956a" },
    { id: "frost", label: "Frost", icon: "fa-snowflake", color: "#a0d8ff" },
    { id: "silk", label: "Silk", icon: "fa-wind", color: "#c0c0d0" },
    { id: "pulse", label: "Pulse", icon: "fa-bullseye", color: "#38bdf8" },
  ];
  const looks = ["Default", "Classic", "Blue Flame", "Spirit"];
  const FIRE: Fx = { id: "fire", label: "Fire", icon: "fa-fire", color: "#f97316" };
  const byId = (id: string): Fx => effects.find((e) => e.id === id) ?? FIRE;

  // ── A: drill-down ──
  let aView = $state<"picker" | "detail">("picker");
  let aFxId = $state("fire");
  let aLook = $state("Classic");
  let aIntensity = $state(70);
  let aMore = $state(false);
  const aFx = $derived(byId(aFxId));
  function aPick(id: string) {
    aFxId = id;
    aView = "detail";
  }

  // ── B: snap sheet ──
  const B_PEEK = 208;
  const B_FULL = 452;
  let bH = $state(B_PEEK);
  let bDragging = $state(false);
  let bStartY = 0;
  let bStartH = 0;
  let bFxId = $state("fire");
  let bLook = $state("Classic");
  let bIntensity = $state(70);
  function bDown(e: PointerEvent) {
    bDragging = true;
    bStartY = e.clientY;
    bStartH = bH;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function bMove(e: PointerEvent) {
    if (!bDragging) return;
    bH = Math.min(B_FULL + 20, Math.max(120, bStartH + (bStartY - e.clientY)));
  }
  function bUp() {
    if (!bDragging) return;
    bDragging = false;
    bH = Math.abs(bH - B_PEEK) < Math.abs(bH - B_FULL) ? B_PEEK : B_FULL;
  }
  function bToggle() {
    bH = bH < (B_PEEK + B_FULL) / 2 ? B_FULL : B_PEEK;
  }
  const bFull = $derived(bH > (B_PEEK + B_FULL) / 2);

  // ── C: segmented ──
  let cSeg = $state<"effect" | "look" | "tune">("effect");
  let cFxId = $state("fire");
  let cLook = $state("Classic");
  let cIntensity = $state(70);
  const cFx = $derived(byId(cFxId));
  const segs = [
    { id: "effect", label: "Effect" },
    { id: "look", label: "Look" },
    { id: "tune", label: "Tune" },
  ] as const;
</script>

{#snippet chrome()}
  <div class="hdr">Sequence Viewer</div>
{/snippet}

{#snippet art(label: string)}
  <div class="art"><span>{label}</span></div>
{/snippet}

{#snippet dockbar()}
  <div class="dockbar">
    <button class="dtab"><i class="fas fa-fan"></i><span>Tunnel</span></button>
    <button class="dtab on"><i class="fas fa-wand-magic-sparkles"></i><span>Effects</span></button>
    <button class="dtab"><i class="fas fa-person-running"></i><span>Effort</span></button>
    <button class="dtab"><i class="fas fa-play"></i><span>Playback</span></button>
    <button class="dl" aria-label="Export video"><i class="fas fa-film"></i></button>
  </div>
{/snippet}

{#snippet tuneSliders(intensity: number)}
  <label class="srow">
    <span class="slbl">Intensity</span>
    <input type="range" min="0" max="100" value={intensity} />
    <span class="sval">{intensity}%</span>
  </label>
  <label class="srow">
    <span class="slbl">Speed</span>
    <input type="range" min="0" max="100" value="45" />
    <span class="sval">45%</span>
  </label>
  <label class="srow">
    <span class="slbl">Size</span>
    <input type="range" min="0" max="100" value="60" />
    <span class="sval">60%</span>
  </label>
  <label class="srow">
    <span class="slbl">Glow</span>
    <input type="range" min="0" max="100" value="30" />
    <span class="sval">30%</span>
  </label>
{/snippet}

<div class="page">
  <h1>Effects on mobile — tap each one, pick a direction</h1>
  <p class="sub">
    iPhone SE frames (375px). CURRENT is today's pileup, for reference.
    <strong>A, B, C are live — tap tiles, drag the B handle, switch C segments.</strong>
  </p>

  <div class="row">
    <!-- ── CURRENT (static reference) ─────────────────────────── -->
    <section class="col">
      <div class="tag current">CURRENT — static reference</div>
      <div class="phone">
        {@render chrome()}
        {@render art("tunnel / 2D art")}
        <div class="tray cur-tray">
          <div class="rainbow"><i class="fas fa-rainbow"></i> Rainbow spectrum</div>
          <div class="hint">Every kaleidoscope copy fans across the spectrum.</div>
          <div class="fxrow clip">
            {#each effects.slice(0, 6) as e (e.id)}
              <div class="ftile" class:sel={e.id === "fire"} style:--c={e.color}>
                <i class="fas {e.icon}"></i><span>{e.label}</span>
              </div>
            {/each}
          </div>
          <div class="chips clip">
            {#each looks.slice(1) as l (l)}
              <div class="chip" class:sel={l === "Classic"}>{l}</div>
            {/each}
          </div>
          <label class="srow">
            <span class="slbl">Intensity</span>
            <input type="range" min="0" max="100" value="70" />
            <span class="sval">70%</span>
          </label>
          <button class="more">More tuning <i class="fas fa-chevron-down"></i></button>
        </div>
        {@render dockbar()}
      </div>
      <p class="cap">6 stacked groups fight for ~300px. Everything half-visible, nothing comfortable.</p>
    </section>

    <!-- ── A: DRILL-DOWN ──────────────────────────────────────── -->
    <section class="col">
      <div class="tag a">A — DRILL-DOWN (tap a tile)</div>
      <div class="phone">
        {@render chrome()}
        {@render art("tunnel / 2D art")}
        <div class="tray fixed-a">
          {#if aView === "picker"}
            <div class="aview">
              <div class="a-title">PICK AN EFFECT</div>
              <div class="grid">
                {#each effects as e (e.id)}
                  <button class="gtile" class:sel={e.id === aFxId} style:--c={e.color} onclick={() => aPick(e.id)}>
                    <i class="fas {e.icon}"></i><span>{e.label}</span>
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <div class="aview">
              <div class="a-head">
                <button class="back" onclick={() => (aView = "picker")} aria-label="Back to effects">
                  <i class="fas fa-arrow-left"></i>
                </button>
                <i class="fas {aFx.icon} a-fxicon" style:color={aFx.color}></i>
                <span class="a-name">{aFx.label}</span>
              </div>
              <div class="chips">
                {#each looks as l (l)}
                  <button class="chip" class:sel={l === aLook} onclick={() => (aLook = l)}>{l}</button>
                {/each}
              </div>
              <label class="srow">
                <span class="slbl">Intensity</span>
                <input type="range" min="0" max="100" bind:value={aIntensity} />
                <span class="sval">{aIntensity}%</span>
              </label>
              <button class="more" onclick={() => (aMore = !aMore)}>
                More tuning <i class="fas fa-chevron-{aMore ? 'up' : 'down'}"></i>
              </button>
              {#if aMore}
                <div class="deep">
                  <label class="srow"><span class="slbl">Speed</span><input type="range" min="0" max="100" value="45" /><span class="sval">45%</span></label>
                  <label class="srow"><span class="slbl">Size</span><input type="range" min="0" max="100" value="60" /><span class="sval">60%</span></label>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        {@render dockbar()}
      </div>
      <p class="cap">Tray = roomy picker. Tap effect → its own focused screen, back arrow returns. One job per screen.</p>
    </section>

    <!-- ── B: SNAP SHEET ──────────────────────────────────────── -->
    <section class="col">
      <div class="tag b">B — SNAP SHEET (drag the handle)</div>
      <div class="phone">
        {@render chrome()}
        {@render art("tunnel / 2D art")}
        <div class="sheet" class:dragging={bDragging} style:height="{bH}px">
          <button
            class="handle"
            onpointerdown={bDown}
            onpointermove={bMove}
            onpointerup={bUp}
            onpointercancel={bUp}
            onclick={bToggle}
            aria-label={bFull ? "Collapse tuning" : "Expand tuning"}
          >
            <span class="grab"></span>
            <i class="fas fa-chevron-{bFull ? 'down' : 'up'}"></i>
          </button>
          <div class="sheet-body">
            <div class="fxrow scroll">
              {#each effects as e (e.id)}
                <button class="ftile" class:sel={e.id === bFxId} style:--c={e.color} onclick={() => (bFxId = e.id)}>
                  <i class="fas {e.icon}"></i><span>{e.label}</span>
                </button>
              {/each}
            </div>
            <div class="chips">
              {#each looks as l (l)}
                <button class="chip" class:sel={l === bLook} onclick={() => (bLook = l)}>{l}</button>
              {/each}
            </div>
            <label class="srow">
              <span class="slbl">Intensity</span>
              <input type="range" min="0" max="100" bind:value={bIntensity} />
              <span class="sval">{bIntensity}%</span>
            </label>
            <div class="deep-label">DEEP TUNING <span class="deep-hint">{bFull ? "" : "— pull up"}</span></div>
            <div class="deep">
              <label class="srow"><span class="slbl">Speed</span><input type="range" min="0" max="100" value="45" /><span class="sval">45%</span></label>
              <label class="srow"><span class="slbl">Size</span><input type="range" min="0" max="100" value="60" /><span class="sval">60%</span></label>
              <label class="srow"><span class="slbl">Glow</span><input type="range" min="0" max="100" value="30" /><span class="sval">30%</span></label>
              <label class="srow"><span class="slbl">Fade</span><input type="range" min="0" max="100" value="55" /><span class="sval">55%</span></label>
            </div>
          </div>
        </div>
        {@render dockbar()}
      </div>
      <p class="cap">One sheet, two heights. Peek = pick + look + intensity. Pull up (or tap chevron) = everything.</p>
    </section>

    <!-- ── C: SEGMENTED ───────────────────────────────────────── -->
    <section class="col">
      <div class="tag c">C — SEGMENTED (switch Effect·Look·Tune)</div>
      <div class="phone">
        {@render chrome()}
        {@render art("tunnel / 2D art")}
        <div class="tray fixed-c">
          <div class="seg">
            {#each segs as s (s.id)}
              <button class="segbtn" class:on={cSeg === s.id} onclick={() => (cSeg = s.id)}>{s.label}</button>
            {/each}
          </div>
          <div class="seg-body">
            {#if cSeg === "effect"}
              <div class="grid">
                {#each effects as e (e.id)}
                  <button class="gtile" class:sel={e.id === cFxId} style:--c={e.color} onclick={() => (cFxId = e.id)}>
                    <i class="fas {e.icon}"></i><span>{e.label}</span>
                  </button>
                {/each}
              </div>
            {:else if cSeg === "look"}
              <div class="look-rows">
                {#each looks as l (l)}
                  <button class="look-row" class:sel={l === cLook} onclick={() => (cLook = l)}>
                    <i class="fas {cFx.icon}" style:color={cFx.color}></i>
                    <span>{l}</span>
                    {#if l === cLook}<i class="fas fa-check chk"></i>{/if}
                  </button>
                {/each}
              </div>
            {:else}
              <div class="tune-stack">
                {@render tuneSliders(cIntensity)}
              </div>
            {/if}
          </div>
        </div>
        {@render dockbar()}
      </div>
      <p class="cap">Third nav layer inside the tray, but zero hidden gestures and no screen changes.</p>
    </section>
  </div>
</div>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
  />
</svelte:head>

<style>
  .page {
    min-height: 100vh;
    background: #0b0b12;
    color: #e8e8f0;
    padding: 20px 16px 60px;
    font-family: system-ui, sans-serif;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #9aa; font-size: 13px; margin: 0 0 20px; max-width: 720px; }
  .row { display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-start; }
  .col { display: flex; flex-direction: column; gap: 8px; }
  .tag {
    font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
    padding: 4px 10px; border-radius: 6px; align-self: flex-start;
  }
  .tag.current { background: #3a2530; color: #f0a0b0; }
  .tag.a { background: #1e3a2f; color: #6ee7a0; }
  .tag.b { background: #1e2f3a; color: #6ec3e7; }
  .tag.c { background: #332a3e; color: #c0a0f0; }
  .cap { max-width: 375px; font-size: 12px; color: #9aa; margin: 0; line-height: 1.45; }

  .phone {
    width: 375px; height: 667px; border-radius: 24px; overflow: hidden;
    background: #05050a; border: 1px solid #2a2a3a;
    display: flex; flex-direction: column; position: relative;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    flex: 0 0 auto;
  }
  .hdr {
    height: 44px; flex: 0 0 44px; display: flex; align-items: center;
    padding: 0 14px; font-size: 13px; font-weight: 600; color: #ccd;
    background: rgba(18, 18, 28, 0.96); border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    z-index: 3;
  }
  .art {
    flex: 1; display: flex; align-items: center; justify-content: center;
    background:
      radial-gradient(circle at 50% 45%, rgba(99, 102, 241, 0.25), transparent 55%),
      conic-gradient(from 0deg at 50% 45%, #14142a, #1c1436, #14142a, #101c30, #14142a);
    color: rgba(255, 255, 255, 0.35); font-size: 13px; letter-spacing: 0.05em;
  }
  .dockbar {
    flex: 0 0 auto; display: flex; gap: 4px; padding: 8px 6px;
    background: rgba(18, 18, 28, 0.98); border-top: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 3;
  }
  .dtab {
    flex: 1 1 0; min-height: 52px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 2px;
    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;
    background: rgba(255, 255, 255, 0.03); color: #99a; font-size: 10px; font-weight: 600;
  }
  .dtab i { font-size: 15px; }
  .dtab.on {
    background: rgba(99, 102, 241, 0.35); border-color: rgba(99, 102, 241, 0.6); color: #fff;
  }
  .dl {
    flex: 0 0 46px; min-height: 52px; border-radius: 12px;
    border: 1px solid rgba(99, 102, 241, 0.5); background: rgba(99, 102, 241, 0.25);
    color: #fff; font-size: 15px;
  }
  button { cursor: pointer; font-family: inherit; }

  /* ── shared tray bits ── */
  .tray {
    flex: 0 0 auto; padding: 10px 12px 8px;
    background: rgba(18, 18, 28, 0.97); border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex; flex-direction: column; gap: 8px;
    z-index: 2;
  }
  .fixed-a { height: 300px; overflow: hidden; }
  .fixed-c { height: 300px; overflow: hidden; }

  .fxrow { display: flex; gap: 6px; }
  .fxrow.scroll { overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
  .fxrow.clip { overflow: hidden; }
  .ftile {
    flex: 0 0 56px; height: 54px; border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.03);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    color: #aab; font-size: 9px; font-weight: 600;
  }
  .ftile i { font-size: 15px; color: var(--c); }
  .ftile.sel { border-color: var(--c); background: color-mix(in srgb, var(--c) 18%, transparent); color: #fff; }

  .chips { display: flex; gap: 6px; flex-wrap: nowrap; }
  .chips.clip { overflow: hidden; }
  .chip {
    padding: 7px 12px; border-radius: 999px; font-size: 11px; font-weight: 600;
    border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.04);
    color: #aab; white-space: nowrap;
  }
  .chip.sel { background: rgba(99, 102, 241, 0.35); border-color: rgba(99, 102, 241, 0.7); color: #fff; }

  .srow { display: flex; align-items: center; gap: 8px; min-height: 32px; }
  .slbl { flex: 0 0 58px; font-size: 11px; font-weight: 600; color: #9aa; }
  .srow input[type="range"] { flex: 1; accent-color: #6366f1; min-height: 24px; }
  .sval { flex: 0 0 34px; font-size: 11px; color: #ccd; text-align: right; font-variant-numeric: tabular-nums; }

  .more {
    align-self: flex-start; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 600;
    border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.04); color: #aab;
    display: flex; align-items: center; gap: 6px;
  }
  .deep { display: flex; flex-direction: column; gap: 4px; }
  .rainbow {
    padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
    border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.04);
    color: #ccd; align-self: flex-start;
  }
  .hint { font-size: 10px; color: #778; }
  .cur-tray { gap: 6px; }

  /* ── A drill-down ── */
  .aview { display: flex; flex-direction: column; gap: 10px; height: 100%; }
  .a-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #889; }
  .grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
    overflow-y: auto; padding-bottom: 4px;
  }
  .gtile {
    height: 58px; border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.03);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    color: #aab; font-size: 9.5px; font-weight: 600;
  }
  .gtile i { font-size: 17px; color: var(--c); }
  .gtile.sel { border-color: var(--c); background: color-mix(in srgb, var(--c) 20%, transparent); color: #fff; }
  .a-head { display: flex; align-items: center; gap: 10px; }
  .back {
    width: 40px; height: 40px; border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.05);
    color: #ccd; font-size: 14px;
  }
  .a-fxicon { font-size: 18px; }
  .a-name { font-size: 15px; font-weight: 700; color: #fff; }

  /* ── B snap sheet ── */
  .sheet {
    position: absolute; left: 0; right: 0; bottom: 68px;
    background: rgba(18, 18, 28, 0.97); border-top: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px 16px 0 0;
    display: flex; flex-direction: column;
    transition: height 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    z-index: 2; overflow: hidden;
    box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.4);
  }
  .sheet.dragging { transition: none; }
  .handle {
    flex: 0 0 34px; display: flex; align-items: center; justify-content: center; gap: 10px;
    background: transparent; border: none; color: #778; font-size: 11px;
    touch-action: none;
  }
  .grab { width: 42px; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, 0.25); }
  .sheet-body {
    flex: 1; min-height: 0; overflow: hidden;
    display: flex; flex-direction: column; gap: 8px; padding: 0 12px 10px;
  }
  .deep-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #889; margin-top: 2px; }
  .deep-hint { color: #556; font-weight: 600; letter-spacing: 0.02em; }

  /* ── C segmented ── */
  .seg {
    display: flex; gap: 4px; padding: 3px; border-radius: 10px;
    background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .segbtn {
    flex: 1 1 0; padding: 8px 0; border-radius: 8px; font-size: 12px; font-weight: 600;
    border: none; background: transparent; color: #99a;
  }
  .segbtn.on { background: rgba(99, 102, 241, 0.4); color: #fff; }
  .seg-body { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }
  .look-rows { display: flex; flex-direction: column; gap: 6px; }
  .look-row {
    display: flex; align-items: center; gap: 10px; padding: 0 12px; min-height: 46px;
    border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03); color: #ccd; font-size: 13px; font-weight: 600;
  }
  .look-row.sel { border-color: rgba(99, 102, 241, 0.7); background: rgba(99, 102, 241, 0.18); color: #fff; }
  .look-row .chk { margin-left: auto; color: #8b8df0; }
  .tune-stack { display: flex; flex-direction: column; gap: 6px; padding-top: 4px; }
</style>
