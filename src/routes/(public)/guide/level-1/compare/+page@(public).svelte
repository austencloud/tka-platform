<script lang="ts">
  /**
   * Side-by-side proof: the OLD v0.5 book (left) vs the NEW live rebuild (right),
   * each independently scrollable. Left is the frozen original PDF; right is the
   * live print route, so it always reflects the latest page work.
   */
  let home = $state(false); // toggle the right pane between navy + home editions
  const OLD_PDF = "/guides/_proof/level-1-v05.pdf#view=FitH&toolbar=0";
  const newSrc = $derived("/guide/level-1/print" + (home ? "?theme=home" : ""));
</script>

<svelte:head><title>Guide Compare — Level 1</title></svelte:head>

<div class="wrap">
  <div class="bar">
    <span class="t">Old v0.5 <b>·</b> New rebuild</span>
    <div class="ctrls">
      <button class:on={!home} onclick={() => (home = false)}>New: Navy</button>
      <button class:on={home} onclick={() => (home = true)}>New: Home (light)</button>
    </div>
  </div>
  <div class="cols">
    <div class="col">
      <div class="cap">Old — v0.5</div>
      <iframe class="pane" src={OLD_PDF} title="Old guide v0.5"></iframe>
    </div>
    <div class="col">
      <div class="cap">New — rebuild ({home ? "home" : "navy"})</div>
      <iframe class="pane" src={newSrc} title="New rebuild"></iframe>
    </div>
  </div>
</div>

<style>
  .wrap { height: 100vh; display: flex; flex-direction: column; background: #1b1b22; color: #eaeaf2; font-family: system-ui, sans-serif; }
  .bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid #33333f; flex: 0 0 auto; }
  .t { font-size: 14px; color: #cfcfe0; } .t b { color: #6f6f8a; }
  .ctrls { display: flex; gap: 8px; }
  .ctrls button { font: 500 12px system-ui; padding: 6px 12px; border-radius: 999px; border: 1px solid #3a3a48; background: #26262f; color: #c8c8db; cursor: pointer; }
  .ctrls button.on { background: #3730a3; border-color: #3730a3; color: #fff; }

  .cols { flex: 1 1 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #33333f; min-height: 0; }
  .col { display: flex; flex-direction: column; min-height: 0; background: #2b2b33; }
  .cap { flex: 0 0 auto; font-size: 12px; color: #9a9ab0; text-align: center; padding: 4px; }
  .pane { flex: 1 1 auto; width: 100%; border: 0; background: #fff; }
</style>
