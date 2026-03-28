<script lang="ts">
  interface Props {
    sequenceId: string;
  }

  let { sequenceId }: Props = $props();
</script>

<div class="sequence-view">
  <div class="sequence-placeholder">
    <i class="fas fa-film" aria-hidden="true"></i>
    <p class="sequence-label">Sequence</p>
    <p class="sequence-id">{sequenceId}</p>
    <p class="sequence-note">Pictograph rendering available in Phase 2</p>
  </div>
</div>

<style>
  .sequence-view {
    padding: 16px;
  }

  .sequence-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 16px;
    background: rgba(200, 180, 140, 0.04);
    border: 1px dashed rgba(200, 180, 140, 0.15);
    border-radius: 8px;
    text-align: center;
  }

  .sequence-placeholder i {
    font-size: 1.5rem;
    color: rgba(200, 180, 140, 0.3);
  }

  .sequence-label {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: rgba(200, 180, 140, 0.5);
    font-weight: 500;
  }

  .sequence-id {
    margin: 0;
    font-family: monospace;
    font-size: var(--font-size-compact, 12px);
    color: rgba(200, 180, 140, 0.35);
  }

  .sequence-note {
    margin: 8px 0 0;
    font-size: var(--font-size-compact, 12px);
    color: rgba(200, 180, 140, 0.25);
    font-style: italic;
  }
</style>
