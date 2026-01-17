<!--
  EmptyEditState.svelte

  Shown when no sequence is loaded in the Edit module.
  Provides options to load a sequence from various sources.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";

  interface Props {
    onLoadSequence: (sequence: SequenceData) => void;
    onBrowseSequences: () => void;
  }

  let { onLoadSequence, onBrowseSequences }: Props = $props();

  function navigateToCreate() {
    handleModuleChange("create");
  }

  function navigateToExplore() {
    handleModuleChange("discover");
  }
</script>

<div class="empty-edit-state">
  <div class="empty-content">
    <div class="icon-container">
      <i class="fas fa-pen-to-square" aria-hidden="true"></i>
    </div>

    <h2 class="title">No Sequence Selected</h2>
    <p class="description">
      Select a sequence to start editing. You can load sequences from the Create
      or Discover modules.
    </p>

    <div class="action-buttons">
      <button class="action-btn browse" onclick={onBrowseSequences}>
        <i class="fas fa-folder-open" aria-hidden="true"></i>
        <span>Browse Sequences</span>
        <span class="btn-hint">Select from gallery</span>
      </button>

      <button class="action-btn create" onclick={navigateToCreate}>
        <i class="fas fa-plus-circle" aria-hidden="true"></i>
        <span>Create New</span>
        <span class="btn-hint">Build from scratch</span>
      </button>
    </div>

    <div class="info-section">
      <h3>Edit Capabilities</h3>
      <ul class="info-list">
        <li>
          <i class="fas fa-pen" aria-hidden="true"></i>
          <span
            ><strong>Beat Mode</strong>: Adjust turns, rotation direction for
            each beat</span
          >
        </li>
        <li>
          <i class="fas fa-layer-group" aria-hidden="true"></i>
          <span
            ><strong>Sequence Mode</strong>: Mirror, rotate, swap colors,
            reverse</span
          >
        </li>
      </ul>
    </div>
  </div>
</div>

<style>
  .empty-edit-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 32px;
    text-align: center;
  }

  .empty-content {
    max-width: 480px;
  }

  .icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    margin: 0 auto 24px;
    border-radius: 50%;
    background: rgba(6, 182, 212, 0.1);
    border: 2px solid rgba(6, 182, 212, 0.3);
  }

  .icon-container i {
    font-size: var(--font-size-3xl);
    color: #06b6d4;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text);
    margin: 0 0 12px 0;
  }

  .description {
    font-size: 1rem;
    color: var(--theme-text-dim);
    margin: 0 0 32px 0;
    line-height: 1.5;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 32px;
  }

  @media (min-width: 500px) {
    .action-buttons {
      flex-direction: row;
      justify-content: center;
    }
  }

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px 24px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-width: 160px;
  }

  .action-btn:hover {
    transform: translateY(-2px);
  }

  .action-btn.browse {
    border-color: rgba(6, 182, 212, 0.3);
  }

  .action-btn.browse:hover {
    background: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.5);
  }

  .action-btn.browse i {
    color: #06b6d4;
  }

  .action-btn.create {
    border-color: rgba(34, 197, 94, 0.3);
  }

  .action-btn.create:hover {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .action-btn.create i {
    color: var(--semantic-success);
  }

  .action-btn i {
    font-size: var(--font-size-2xl);
    margin-bottom: 4px;
  }

  .action-btn span {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--theme-text);
  }

  .btn-hint {
    font-size: 0.8rem !important;
    font-weight: 400 !important;
    color: var(--theme-text-dim) !important;
  }

  .info-section {
    padding: 20px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--theme-stroke);
    text-align: left;
  }

  .info-section h3 {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 12px 0;
  }

  .info-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .info-list li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 0.9rem;
    color: var(--theme-text-dim);
    line-height: 1.4;
  }

  .info-list li i {
    color: #06b6d4;
    font-size: 0.8rem;
    margin-top: 4px;
    flex-shrink: 0;
  }

  .info-list strong {
    color: rgba(255, 255, 255, 0.8);
  }
</style>
