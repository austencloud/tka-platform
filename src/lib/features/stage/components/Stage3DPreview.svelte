<script lang="ts">
  import { getStageChoreographyState } from "../state/stage-choreography-state.svelte";

  const state = getStageChoreographyState();
</script>

<div class="stage-3d-preview">
  <div class="placeholder">
    <i class="fas fa-cube" aria-hidden="true"></i>
    <p>3D Preview</p>
    <p class="hint">Coming soon — Threlte-based live formation preview</p>
  </div>
</div>

<style>
  .stage-3d-preview {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-primary, #0f0f1a);
  }
  .placeholder {
    text-align: center;
    color: #4a4a6a;
  }
  .placeholder i {
    font-size: 48px;
    color: #06b6d4;
    margin-bottom: 16px;
    display: block;
  }
  .placeholder p {
    font-size: 16px;
    color: #8888aa;
    margin: 4px 0;
  }
  .hint {
    font-size: 12px;
    color: #5a5a7a;
  }
</style>
