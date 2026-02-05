<!--
  AnimationViewerHelpSheet.svelte

  Responsive help panel showing animation viewer keyboard shortcuts and usage tips.
  - Desktop: Slides from right as a side panel
  - Mobile: Slides from bottom as a sheet
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { ANIMATION_SHORTCUTS } from "../utils/register-animation-shortcuts";

  let {
    isOpen = $bindable(false),
    isSideBySideLayout = false,
    onClose = () => {},
  }: {
    isOpen?: boolean;
    isSideBySideLayout?: boolean;
    onClose?: () => void;
  } = $props();

  function handleClose() {
    isOpen = false;
    onClose();
  }

  // Responsive placement - right panel on desktop, bottom sheet on mobile
  const placement = $derived(isSideBySideLayout ? "right" : "bottom");

  // Snap points only apply to bottom placement
  const snapPoints = $derived(isSideBySideLayout ? undefined : ["65%", "90%"]);
</script>

<Drawer
  bind:isOpen
  {placement}
  {snapPoints}
  closeOnBackdrop={true}
  closeOnEscape={true}
  ariaLabel="Animation Viewer Help"
  showHandle={!isSideBySideLayout}
  class="help-sheet-drawer {isSideBySideLayout ? 'side-panel' : 'bottom-sheet'}"
>
  <div class="help-content">
    <header class="help-header">
      <div class="header-info">
        <h2 class="help-title">Animation Viewer</h2>
        <p class="help-subtitle">Keyboard shortcuts & tips</p>
      </div>
      <button
        class="close-btn"
        onclick={handleClose}
        aria-label="Close help"
        type="button"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </header>

    <div class="help-body">
      <!-- Keyboard Shortcuts Section -->
      <section class="help-section">
        <h3 class="section-title">
          <i class="fas fa-keyboard" aria-hidden="true"></i>
          Keyboard Shortcuts
        </h3>
        <div class="shortcuts-list">
          {#each ANIMATION_SHORTCUTS as shortcut}
            <div class="shortcut-item">
              <div class="shortcut-info">
                <span class="shortcut-label">{shortcut.label}</span>
                <span class="shortcut-desc">{shortcut.description}</span>
              </div>
              <kbd class="shortcut-key">{shortcut.key}</kbd>
            </div>
          {/each}
        </div>
      </section>

      <!-- Usage Tips Section -->
      <section class="help-section">
        <h3 class="section-title">
          <i class="fas fa-lightbulb" aria-hidden="true"></i>
          Tips
        </h3>
        <ul class="tips-list">
          <li>
            Use the step buttons to analyze specific positions in the animation
          </li>
          <li>Toggle motion visibility to focus on one prop at a time</li>
          <li>Adjust BPM to slow down complex sequences for study</li>
          <li>Enable trails to visualize the motion path over time</li>
        </ul>
      </section>
    </div>
  </div>
</Drawer>

<style>
  /* Side panel (desktop) specific styles */
  :global(.help-sheet-drawer.side-panel[data-placement="right"]) {
    width: min(380px, 90vw);
    height: 100%;
  }

  .help-content {
    display: flex;
    flex-direction: column;
    padding: 0 20px 20px;
    min-width: 280px;
    max-height: 100%;
    height: 100%;
  }

  .help-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 16px;
    flex-shrink: 0;
  }

  .header-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .help-title {
    font-size: 1.2rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin: 0;
  }

  .help-subtitle {
    font-size: 0.8rem;
    color: var(--theme-text-dim);
    margin: 0;
  }

  .close-btn {
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text);
  }

  .help-body {
    display: flex;
    flex-direction: column;
    gap: 24px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .help-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
  }

  .section-title i {
    font-size: 0.85rem;
    color: rgba(139, 92, 246, 0.8);
  }

  /* Shortcuts List */
  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    gap: 12px;
  }

  .shortcut-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .shortcut-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--theme-text);
  }

  .shortcut-desc {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  .shortcut-key {
    font-size: 0.75rem;
    font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
    padding: 4px 8px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 4px;
    color: rgba(167, 139, 250, 1);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Tips List */
  .tips-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tips-list li {
    position: relative;
    padding-left: 20px;
    font-size: 0.85rem;
    color: var(--theme-text-dim);
    line-height: 1.5;
  }

  .tips-list li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 8px;
    width: 6px;
    height: 6px;
    background: rgba(139, 92, 246, 0.6);
    border-radius: 50%;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .help-content {
      padding: 0 16px 16px;
    }

    .shortcut-item {
      padding: 8px 10px;
    }

    .shortcut-desc {
      display: none;
    }
  }
</style>
