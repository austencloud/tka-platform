<!--
  LibrarySourceButton.svelte

  Button to open the audio library panel.
-->
<script lang="ts">
  let {
    onclick,
  }: {
    onclick?: (e: MouseEvent) => void;
  } = $props();
</script>

<button class="library-source-btn" {onclick}>
  <div class="icon-container">
    <i class="fas fa-folder-open" aria-hidden="true"></i>
  </div>
  <div class="content">
    <div class="title">My Library</div>
    <div class="description">Select from previously uploaded audio</div>
  </div>
  <i class="fas fa-chevron-right arrow" aria-hidden="true"></i>
</button>

<style>
  .library-source-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    width: 300px;
    max-width: 100%;
  }

  .library-source-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(139, 92, 246, 0.3);
  }

  .icon-container {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 8px;
  }

  .icon-container i {
    font-size: 1.1rem;
    color: rgba(167, 139, 250, 0.9);
  }

  .content {
    flex: 1;
    text-align: left;
  }

  .title {
    font-size: 0.9rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin-bottom: 0.15rem;
  }

  .description {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  .arrow {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
  }
</style>
