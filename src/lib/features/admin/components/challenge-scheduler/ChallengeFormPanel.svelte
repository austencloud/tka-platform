<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import type { BrowseThumbnailProvider } from "$lib/shared/browse/services/browse-thumbnail-provider";
  import { getBrowseThumbnailProvider } from "$lib/shared/browse/get-browse-thumbnail-provider";

  interface Props {
    selectedDate: string | null;
    showPanel: boolean;
    onClose: () => void;
    onSchedule: (data: {
      sequenceId: string;
      sequenceName: string;
      title: string;
      description: string;
      difficulty: "beginner" | "intermediate" | "advanced";
      xpReward: number;
    }) => void;
  }

  let { selectedDate, showPanel, onClose, onSchedule }: Props = $props();

  // Services - resolved synchronously via ITI
  const thumbnailService: BrowseThumbnailProvider | null = getBrowseThumbnailProvider() ?? null;

  // Local form state
  let showSequenceBrowser = $state(false);
  let selectedSequence = $state<SequenceData | null>(null);
  let customTitle = $state("");
  let customDescription = $state("");
  let customDifficulty = $state<"beginner" | "intermediate" | "advanced">(
    "intermediate"
  );
  let customXP = $state(50);

  // Get cover URL for selected sequence
  function getCoverUrl(sequence: SequenceData): string | undefined {
    if (!thumbnailService) return undefined;
    const firstThumbnail = sequence.thumbnails?.[0];
    if (!firstThumbnail) return undefined;
    try {
      return thumbnailService.getThumbnailUrl(sequence.id, firstThumbnail);
    } catch {
      return undefined;
    }
  }

  function handleSequenceSelect(sequence: SequenceData) {
    selectedSequence = sequence;
    showSequenceBrowser = false;
    if (!customTitle) {
      customTitle = `Daily Challenge: ${sequence.name}`;
    }
    if (!customDescription) {
      customDescription = `Complete this sequence to earn XP!`;
    }
  }

  function handleSchedule() {
    if (!selectedSequence) return;
    onSchedule({
      sequenceId: selectedSequence.id,
      sequenceName: selectedSequence.name,
      title: customTitle || `Daily Challenge: ${selectedSequence.name}`,
      description: customDescription || `Complete this sequence to earn XP!`,
      difficulty: customDifficulty,
      xpReward: customXP,
    });
  }

  function handleClose() {
    // Reset local state
    showSequenceBrowser = false;
    selectedSequence = null;
    customTitle = "";
    customDescription = "";
    customDifficulty = "intermediate";
    customXP = 50;
    onClose();
  }

  const formattedDate = $derived(
    selectedDate
      ? new Date(selectedDate).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : ""
  );
</script>

<div class="detail-panel" class:active={showPanel}>
  {#if showPanel && selectedDate}
    <div class="creation-form">
      <div class="form-header">
        <h3>
          <i class="fas fa-plus-circle" aria-hidden="true"></i>
          Schedule Challenge
        </h3>
        <button
          class="close-btn"
          onclick={handleClose}
          aria-label="Close panel"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <div class="date-display">
        <i class="fas fa-calendar" aria-hidden="true"></i>
        {formattedDate}
      </div>

      <!-- Sequence Selection -->
      <div class="form-section">
        <span class="section-label">Select Sequence</span>
        {#if selectedSequence}
          {@const coverUrl = getCoverUrl(selectedSequence)}
          <button
            class="selected-sequence-card"
            onclick={() => (showSequenceBrowser = true)}
          >
            {#if coverUrl}
              <img
                class="sequence-thumbnail"
                src={coverUrl}
                alt={selectedSequence.name}
              />
            {:else}
              <div class="sequence-icon-large">
                <i class="fas fa-layer-group" aria-hidden="true"></i>
              </div>
            {/if}
            <div class="sequence-info-large">
              <span class="sequence-name">{selectedSequence.name}</span>
              <span class="sequence-details">
                {selectedSequence.steps?.length ?? 0} steps • {selectedSequence.word ||
                  "Unknown"}
              </span>
            </div>
            <div class="change-sequence">
              <i class="fas fa-exchange-alt" aria-hidden="true"></i>
              <span>Change</span>
            </div>
          </button>
        {:else}
          <button
            class="select-sequence-btn"
            onclick={() => (showSequenceBrowser = true)}
          >
            <div class="btn-icon">
              <i class="fas fa-plus-circle" aria-hidden="true"></i>
            </div>
            <span>Browse Sequences</span>
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        {/if}
      </div>

      {#if selectedSequence}
        <!-- Challenge Details Form -->
        <div class="form-section">
          <span class="section-label">Challenge Details</span>

          <div class="form-group">
            <label for="title">Title</label>
            <input
              id="title"
              type="text"
              bind:value={customTitle}
              placeholder="Daily Challenge: Sequence Name"
            />
          </div>

          <div class="form-group">
            <label for="description">Description</label>
            <textarea
              id="description"
              bind:value={customDescription}
              placeholder="Complete this sequence to earn XP!"
              rows="2"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="difficulty">Difficulty</label>
              <select id="difficulty" bind:value={customDifficulty}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div class="form-group">
              <label for="xp">XP Reward</label>
              <input
                id="xp"
                type="number"
                bind:value={customXP}
                min="10"
                max="500"
                step="10"
              />
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <button class="cancel-btn" onclick={handleClose}> Cancel </button>
          <button class="schedule-btn" onclick={handleSchedule}>
            <i class="fas fa-check" aria-hidden="true"></i>
            Schedule Challenge
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="empty-detail">
      <div class="empty-icon">
        <i class="fas fa-mouse-pointer" aria-hidden="true"></i>
      </div>
      <h3>Select a Date</h3>
      <p>Click on a date in the calendar to schedule a new challenge</p>
    </div>
  {/if}
</div>

<!-- Sequence Picker Modal -->
<SequencePickerModal
  open={showSequenceBrowser}
  onSelect={handleSequenceSelect}
  onClose={() => (showSequenceBrowser = false)}
  title="Select Challenge Sequence"
/>

<style>
  .detail-panel {
    /* Brand purple gradient (shared with SchedulerTimelineView). No global token
       matches this exact 2-stop ramp; scoped per never-hand-roll fix pattern. */
    --challenge-brand-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .empty-detail {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    opacity: 0.5;
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    background: var(--theme-card-bg);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    margin-bottom: 1rem;
  }

  .empty-detail h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.2rem;
  }

  .empty-detail p {
    margin: 0;
    font-size: 0.9rem;
    max-width: 200px;
  }

  .creation-form {
    flex: 1;
    padding: 1.25rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .form-header h3 {
    margin: 0;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .close-btn {
    width: var(--min-touch-target); /* WCAG AA touch target */
    height: var(--min-touch-target);
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-normal) ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .date-display {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 8px;
    font-weight: 500;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-label {
    font-size: 0.9rem;
    font-weight: 600;
    opacity: 0.8;
  }

  /* Browse Sequences Button */
  .select-sequence-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 1rem;
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    border: 2px dashed color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 10px;
    color: #fff;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .select-sequence-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .select-sequence-btn .btn-icon {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    color: var(--theme-accent);
  }

  .select-sequence-btn span {
    flex: 1;
    text-align: left;
    font-weight: 500;
  }

  .select-sequence-btn .fa-chevron-right {
    opacity: 0.5;
  }

  /* Selected Sequence Card */
  .selected-sequence-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem;
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 10px;
    color: #fff;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    text-align: left;
  }

  .selected-sequence-card:hover {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .sequence-thumbnail {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 8px;
    object-fit: cover;
    background: rgba(0, 0, 0, 0.2);
  }

  .sequence-icon-large {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .sequence-info-large {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .sequence-name {
    font-size: 0.95rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sequence-details {
    font-size: 0.8rem;
    opacity: 0.6;
  }

  .change-sequence {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
    transition: all var(--duration-normal) ease;
  }

  .selected-sequence-card:hover .change-sequence {
    opacity: 1;
    background: rgba(255, 255, 255, 0.2);
  }

  .change-sequence i {
    font-size: 0.9rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .form-group label {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    padding: 0.6rem 0.85rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: #fff;
    font-size: 0.9rem;
    transition: all var(--duration-normal) ease;
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    background: var(--theme-card-bg);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 60px;
    font-family: inherit;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: auto;
    padding-top: 1rem;
  }

  .cancel-btn,
  .schedule-btn {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.95rem;
    transition: all var(--duration-normal) ease;
  }

  .cancel-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .schedule-btn {
    background: var(--challenge-brand-gradient);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .schedule-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .creation-form::-webkit-scrollbar {
    width: 6px;
  }

  .creation-form::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .creation-form::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
  }

  @media (max-width: 1024px) {
    .detail-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      max-width: 400px;
      transform: translateX(100%);
      transition: transform var(--duration-emphasis) ease;
      z-index: 100;
      border-radius: 0;
    }

    .detail-panel.active {
      transform: translateX(0);
    }
  }

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
