<script lang="ts">
  /**
   * Reader companion — the right-hand panel that live-animates the sequence a
   * page hands up. Wraps the standalone InlineAnimationPlayer (real animation
   * engine). Keyed by sequence id so a new click remounts a fresh player.
   */
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let {
    sequence,
    onClose,
  }: {
    sequence: SequenceData | null;
    onClose: () => void;
  } = $props();
</script>

<div class="companion">
  <div class="head">
    <span class="ttl">Animation</span>
    <button class="close" onclick={onClose} aria-label="Close animation">✕</button>
  </div>
  <div class="body">
    {#if sequence}
      {#key sequence.id}
        <InlineAnimationPlayer {sequence} autoPlay={true} />
      {/key}
    {:else}
      <p class="hint">Click a sequence on the page to animate it.</p>
    {/if}
  </div>
</div>

<style>
  .companion {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #eee;
  }
  .ttl {
    font: 700 0.9rem system-ui, sans-serif;
    color: #4a2f8a;
  }
  .close {
    all: unset;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: #6b6386;
  }
  .close:hover {
    background: rgba(120, 90, 200, 0.1);
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
  }
  .hint {
    color: #9a93ad;
    font: italic 0.9rem/1.4 "Cormorant Garamond", Georgia, serif;
    text-align: center;
  }
</style>
