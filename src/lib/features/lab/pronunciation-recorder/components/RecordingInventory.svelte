<script lang="ts">
  import { getPronunciationRecorderContext } from "../context/pronunciation-recorder-context";

  const { state } = getPronunciationRecorderContext();
  const columnLabels = ["Solo", "First", "Middle", "Last"];
</script>

<aside class="inventory" aria-labelledby="recording-inventory-title">
  <div class="inventory-heading">
    <div>
      <h2 id="recording-inventory-title">Recording map</h2>
      <p>One approved take in each box.</p>
    </div>
    <span>{state.acceptedCount}/{state.jobs.length}</span>
  </div>

  <div class="column-headings" aria-hidden="true">
    <span></span>
    {#each columnLabels as label}
      <span>{label}</span>
    {/each}
  </div>

  <div class="inventory-rows themed-scrollbar">
    {#each state.rows as row}
      <div class="inventory-row">
        <div class="letter-name" title={row.spokenName}>
          <strong>{row.letter}</strong>
          <span>{row.spokenName}</span>
        </div>
        {#each row.jobs as job}
          <button
            type="button"
            class:current={job.id === state.currentJob.id}
            class:accepted={state.isAccepted(job.id)}
            class="job-button"
            onclick={() => state.selectJob(job.id)}
            disabled={state.navigationLocked}
            aria-label={`${row.spokenName}, ${job.contextLabel}${state.isAccepted(job.id) ? ", approved" : ", not recorded"}`}
            aria-current={job.id === state.currentJob.id ? "step" : undefined}
          >
            {#if state.isAccepted(job.id)}
              <i class="fas fa-check" aria-hidden="true"></i>
            {:else}
              <span aria-hidden="true"></span>
            {/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>
</aside>

<style>
  .inventory {
    --inventory-surface: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
    --inventory-border: var(--theme-stroke, rgba(255, 255, 255, 0.13));
    --inventory-muted: var(--theme-text-dim, rgba(255, 255, 255, 0.64));
    display: grid;
    min-width: 0;
    max-height: min(760px, calc(100dvh - 250px));
    grid-template-rows: auto auto minmax(0, 1fr);
    border: 1px solid var(--inventory-border);
    border-radius: 18px;
    background: var(--inventory-surface);
    overflow: hidden;
  }

  .inventory-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 18px 14px;
  }

  .inventory-heading h2 {
    margin: 0 0 3px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-lg, 18px);
  }

  .inventory-heading p {
    margin: 0;
    color: var(--inventory-muted);
    font-size: var(--font-size-compact, 12px);
  }

  .inventory-heading > span {
    color: var(--theme-accent, #a78bfa);
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-sm, 14px);
    font-weight: 750;
    font-variant-numeric: tabular-nums;
  }

  .column-headings,
  .inventory-row {
    display: grid;
    grid-template-columns: minmax(74px, 1fr) repeat(4, 44px);
    gap: 5px;
    align-items: center;
  }

  .column-headings {
    padding: 0 12px 8px;
    color: var(--inventory-muted);
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
  }

  .inventory-rows {
    min-height: 0;
    padding: 0 8px 12px;
    overflow-y: auto;
  }

  .inventory-row {
    min-height: 50px;
    padding: 3px 4px;
    border-top: 1px solid
      color-mix(in srgb, var(--inventory-border) 65%, transparent);
  }

  .letter-name {
    min-width: 0;
    padding-left: 4px;
  }

  .letter-name strong,
  .letter-name span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .letter-name strong {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
  }

  .letter-name span {
    color: var(--inventory-muted);
    font-size: 10px;
  }

  .job-button {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border: 1px solid var(--inventory-border);
    border-radius: 10px;
    background: var(--theme-background, rgba(0, 0, 0, 0.18));
    color: var(--theme-text, #fff);
    cursor: pointer;
  }

  .job-button > span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--inventory-border);
  }

  .job-button:hover:not(:disabled),
  .job-button.current {
    border-color: var(--theme-accent, #a78bfa);
    box-shadow: inset 0 0 0 1px var(--theme-accent, #a78bfa);
  }

  .job-button.current {
    background: color-mix(
      in srgb,
      var(--theme-accent, #a78bfa) 17%,
      transparent
    );
  }

  .job-button.accepted {
    border-color: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 52%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 13%,
      transparent
    );
    color: var(--semantic-success, #4ade80);
  }

  .job-button:disabled {
    cursor: not-allowed;
  }

  @container (max-width: 880px) {
    .inventory {
      max-height: 540px;
    }
  }
</style>
