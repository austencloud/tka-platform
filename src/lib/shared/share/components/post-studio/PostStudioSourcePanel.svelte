<script lang="ts">
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";

  let {
    performanceAlignmentDetail = null,
    performanceLibraryError = "",
    onEditSource,
  }: {
    performanceAlignmentDetail?: string | null;
    performanceLibraryError?: string;
    onEditSource?: () => void;
  } = $props();

  const composition = getMediaCompositionContext();

  function sourceIcon(kind: string): string {
    if (kind === "video") return "fa-solid fa-video";
    if (kind === "sequence-animation") return "fa-solid fa-person-running";
    if (kind === "choreo-card") return "fa-solid fa-table-cells-large";
    return "fa-solid fa-photo-film";
  }

  function statusCopy(roleKey: string, status: string, used: boolean): string {
    if (status === "preparing") return "Preparing";
    if (status === "missing") {
      if (!used) return "Optional for this layout";
      return roleKey === "performance-video"
        ? "Choose a video"
        : roleKey === "sequence-animation"
          ? "Create animation"
          : "Prepare source";
    }
    if (roleKey === "performance-video" && performanceAlignmentDetail) {
      return performanceAlignmentDetail;
    }
    return used ? "Used in this layout" : "Available";
  }

  function activateSource(roleKey: string, status: string): void {
    if (status === "missing") {
      composition.requestSource(roleKey);
      return;
    }
    composition.selectRole(roleKey);
    onEditSource?.();
  }
</script>

<section class="source-panel" aria-labelledby="post-studio-sources">
  <div class="panel-heading">
    <div>
      <span class="eyebrow">Media</span>
      <h3 id="post-studio-sources">Sources</h3>
    </div>
    <span class:ready={composition.isReady} class="source-count">
      {composition.activePreset.sourceRoles.length -
        composition.missingRequiredRoles.length}/{composition.activePreset
        .sourceRoles.length}
    </span>
  </div>

  <div class="source-list">
    {#each composition.bindings as binding (binding.roleKey)}
      {@const used = composition.activePreset.sourceRoles.some(
        (role) => role.key === binding.roleKey
      )}
      <button
        type="button"
        class="source-row"
        class:used
        class:missing={binding.status === "missing" && used}
        onclick={() => activateSource(binding.roleKey, binding.status)}
      >
        <span class="source-icon" aria-hidden="true">
          <i
            class={binding.status === "preparing"
              ? "fa-solid fa-circle-notch fa-spin"
              : sourceIcon(binding.kind)}
          ></i>
        </span>
        <span class="source-copy">
          <strong>{binding.label}</strong>
          <small>{statusCopy(binding.roleKey, binding.status, used)}</small>
        </span>
        {#if binding.status === "missing"}
          <span class="source-action">{used ? "Choose" : "Add"}</span>
        {:else if used}
          <i class="fa-solid fa-check source-check" aria-hidden="true"></i>
        {/if}
      </button>
    {/each}
  </div>

  {#if performanceLibraryError}
    <p class="library-error" role="alert">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      {performanceLibraryError}
    </p>
  {/if}

  <p class:ready={composition.isReady} class="readiness" role="status">
    <i
      class={composition.isReady
        ? "fa-solid fa-circle-check"
        : "fa-solid fa-circle-exclamation"}
      aria-hidden="true"
    ></i>
    {composition.isReady
      ? "Ready to render this layout."
      : `${composition.missingRequiredRoles.length} source${composition.missingRequiredRoles.length === 1 ? "" : "s"} needed before render.`}
  </p>
</section>

<style>
  .source-panel {
    display: grid;
    gap: var(--studio-panel-gap, var(--spacing-md));
  }

  .panel-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  .eyebrow {
    display: block;
    margin-bottom: var(--spacing-xs);
    color: var(--theme-text-dim);
    font-size: var(--studio-meta-size, var(--font-size-compact));
    font-weight: 650;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  h3 {
    margin: 0;
    color: var(--theme-text);
    font-size: var(--studio-section-title-size, 1.15rem);
  }

  .source-count {
    display: grid;
    place-items: center;
    min-width: 2.75rem;
    min-height: var(--studio-control-height, 2.75rem);
    border: 1px solid
      color-mix(in srgb, var(--semantic-warning) 42%, transparent);
    border-radius: var(--radius-2026-full);
    color: var(--semantic-warning);
    font-size: var(--studio-meta-size, var(--font-size-compact));
    font-variant-numeric: tabular-nums;
    font-weight: 750;
  }

  .source-count.ready {
    border-color: color-mix(in srgb, var(--semantic-success) 42%, transparent);
    color: var(--semantic-success);
  }

  .source-list {
    display: grid;
    gap: var(--spacing-sm);
  }

  .source-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    min-height: calc(var(--studio-control-height, 2.75rem) + 1.25rem);
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .source-row:hover,
  .source-row.used {
    border-color: var(--theme-stroke-strong);
    background: color-mix(
      in srgb,
      var(--theme-accent) 10%,
      var(--theme-card-bg)
    );
  }

  .source-row.missing {
    border-color: color-mix(
      in srgb,
      var(--semantic-warning) 48%,
      var(--theme-stroke)
    );
  }

  .source-row:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .source-icon {
    display: grid;
    place-items: center;
    width: calc(var(--studio-control-height, 2.75rem) - 0.25rem);
    height: calc(var(--studio-control-height, 2.75rem) - 0.25rem);
    border-radius: var(--radius-2026-sm);
    background: color-mix(
      in srgb,
      var(--theme-accent) 12%,
      var(--theme-card-bg)
    );
    color: var(--theme-accent);
  }

  .source-copy {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .source-copy strong,
  .source-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-copy strong {
    font-size: var(--studio-body-size, var(--font-size-min));
  }

  .source-copy small {
    color: var(--theme-text-dim);
    font-size: var(--studio-meta-size, var(--font-size-compact));
  }

  .source-action {
    padding: 0.3rem 0.5rem;
    border-radius: var(--radius-2026-xs);
    background: color-mix(in srgb, var(--semantic-warning) 14%, transparent);
    color: var(--semantic-warning);
    font-size: var(--studio-meta-size, var(--font-size-compact));
    font-weight: 750;
  }

  .source-check {
    color: var(--semantic-success);
  }

  .readiness {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    margin: 0;
    color: var(--semantic-warning);
    font-size: var(--studio-meta-size, var(--font-size-compact));
    line-height: 1.4;
  }

  .library-error {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    margin: 0;
    color: var(--semantic-warning);
    font-size: var(--studio-meta-size, var(--font-size-compact));
    line-height: 1.4;
  }

  .readiness.ready {
    color: var(--semantic-success);
  }
</style>
