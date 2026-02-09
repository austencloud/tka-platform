<!--
  PhotoPickerLab.svelte - Before/After comparison for ProfilePhotoPicker improvements

  Shows the actual ProfilePhotoPicker modal so we can preview aesthetic changes.
-->
<script lang="ts">
  import ProfilePhotoPicker from "$lib/shared/settings/components/ProfilePhotoPicker.svelte";
  import type { PhotoSelection } from "$lib/shared/settings/domain/photo-picker-types";

  let isPickerOpen = $state(false);

  async function handlePhotoSelected(_photoData: PhotoSelection) {
    isPickerOpen = false;
  }
</script>

<div class="photo-picker-lab">
  <header class="lab-header">
    <h1>Profile Photo Picker</h1>
    <p>Testing aesthetic improvements to the side-by-side modal layout</p>
  </header>

  <section class="controls">
    <button class="open-btn" onclick={() => (isPickerOpen = true)}>
      <i class="fas fa-image"></i>
      <span>Open Photo Picker</span>
    </button>
  </section>

  <section class="notes">
    <h2>Proposed Improvements</h2>
    <ul>
      <li><strong>Live preview on left panel</strong> - Show generated avatar as user customizes on right</li>
      <li><strong>Accent color from gradient</strong> - Use selected gradient's color for UI elements</li>
      <li><strong>Better vertical centering</strong> - Balance empty space in left panel</li>
      <li><strong>Visual connection</strong> - Both panels feel unified, not separate UIs</li>
    </ul>
  </section>

  <ProfilePhotoPicker
    bind:isOpen={isPickerOpen}
    onClose={() => (isPickerOpen = false)}
    onPhotoSelected={handlePhotoSelected}
  />
</div>

<style>
  .photo-picker-lab {
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding: 32px;
    height: 100%;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
  }

  .lab-header {
    text-align: center;
  }

  .lab-header h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .lab-header p {
    font-size: 14px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .controls {
    display: flex;
    justify-content: center;
  }

  .open-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 32px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .open-btn:hover {
    filter: brightness(1.1);
    transform: scale(1.02);
  }

  .open-btn:active {
    transform: scale(0.98);
  }

  .open-btn i {
    font-size: 20px;
  }

  .notes {
    max-width: 600px;
    margin: 0 auto;
    padding: 24px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
  }

  .notes h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 16px 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .notes ul {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .notes li {
    font-size: 14px;
    line-height: 1.5;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .notes li strong {
    color: var(--theme-text, #ffffff);
  }
</style>
