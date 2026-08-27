<script lang="ts">
  import type { Snippet } from "svelte";
  import { Collapsible } from "bits-ui";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import SmartCollectionRuleSummary from "$lib/features/library/components/SmartCollectionRuleSummary.svelte";
  import type { SmartFilterSpec } from "$lib/shared/library/domain/models/collection";

  interface Props {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
    spec?: SmartFilterSpec | null;
    matchCount?: number | null;
    ruleDisclosureLabel?: string;
    contentFirst?: boolean;
    backLabel?: string;
    loading?: boolean;
    error?: boolean;
    readOnly?: boolean;
    showBack?: boolean;
    editing?: boolean;
    onBack?: () => void;
    onEdit?: () => void;
    onOptions?: (event: MouseEvent) => void;
    onRetry?: () => void;
    titleEditor?: Snippet;
    children?: Snippet;
  }

  let {
    name = "Smart Collection",
    description,
    icon = "fa-wand-magic-sparkles",
    color = "var(--theme-accent, #8b6cff)",
    spec = null,
    matchCount = null,
    ruleDisclosureLabel,
    contentFirst = false,
    backLabel = "Collections",
    loading = false,
    error = false,
    readOnly = false,
    showBack = true,
    editing = false,
    onBack,
    onEdit,
    onOptions,
    onRetry,
    titleEditor,
    children,
  }: Props = $props();

  const sourceLabel = $derived(
    spec?.source === "my-library" ? "My Library" : "Community"
  );
  const empty = $derived(!loading && !error && matchCount === 0);
  let ruleOpen = $state(false);
</script>

<section
  class="smart-detail"
  class:content-first={contentFirst}
  style:--smart-color={color}
  aria-label={name}
>
  {#if contentFirst}
    {#if showBack && onBack}
      <div class="content-first-back">
        <button
          type="button"
          class="icon-button back-button"
          aria-label={`Back to ${backLabel}`}
          onclick={onBack}
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          <span>{backLabel}</span>
        </button>
      </div>
    {/if}
  {:else}
    <header class="detail-head">
    {#if showBack && onBack}
      <button
        type="button"
        class="icon-button back-button"
        aria-label="Back to collections"
        onclick={onBack}
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
      </button>
    {/if}

    <span class="collection-icon" aria-hidden="true">
      <i class={`fas ${icon}`}></i>
    </span>

    {#if editing && titleEditor}
      <div class="title-editor">
        {@render titleEditor()}
      </div>
    {:else}
      <div class="title-block">
        <div class="title-line">
          <h2>{name}</h2>
          {#if readOnly}
            <span class="built-in-badge">
              <i class="fas fa-lock" aria-hidden="true"></i>
              Built in
            </span>
          {/if}
        </div>
        <p>
          {description ??
            (readOnly
              ? "A Smart Collection maintained by TKA."
              : "A live collection built from saved filters.")}
        </p>
      </div>
    {/if}

    {#if !readOnly && !editing}
      <div class="head-actions">
        {#if onEdit}
          <PanelButton
            variant="secondary"
            ariaLabel="Edit Smart Collection rule"
            onclick={onEdit}
          >
            <i class="fas fa-sliders" aria-hidden="true"></i>
            <span class="edit-label">Edit rule</span>
          </PanelButton>
        {/if}
        {#if onOptions}
          <button
            type="button"
            class="icon-button"
            aria-label="Smart Collection options"
            onclick={onOptions}
          >
            <i class="fas fa-ellipsis-vertical" aria-hidden="true"></i>
          </button>
        {/if}
      </div>
    {/if}
    </header>
  {/if}

  {#if spec && !contentFirst}
    <div class="rule-wrap">
      {#if ruleDisclosureLabel}
        <Collapsible.Root bind:open={ruleOpen}>
          <Collapsible.Trigger class="rule-disclosure-trigger">
            <span class="rule-disclosure-icon" aria-hidden="true">
              <i class="fas fa-circle-info"></i>
            </span>
            <span class="rule-disclosure-copy">
              <strong>{ruleDisclosureLabel}</strong>
              <span>Collection details</span>
            </span>
            <i
              class="fas fa-chevron-down rule-disclosure-chevron"
              class:open={ruleOpen}
              aria-hidden="true"
            ></i>
          </Collapsible.Trigger>

          <Collapsible.Content class="rule-disclosure-content">
            <div class="rule-disclosure-content-inner">
              <SmartCollectionRuleSummary
                {spec}
                {matchCount}
                builtIn={readOnly}
                countUnavailable={error}
              />
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      {:else}
        <SmartCollectionRuleSummary
          {spec}
          {matchCount}
          builtIn={readOnly}
          countUnavailable={error}
        />
      {/if}
    </div>
  {/if}

  <div class="detail-body">
    {#if error}
      <PanelState
        type="error"
        title="Couldn't load this Smart Collection"
        message="Check your connection, then try again."
        onretry={onRetry}
      />
    {:else if loading}
      <PanelState
        type="loading"
        title="Checking the saved rule"
        message={`Looking for matches in ${sourceLabel}.`}
      />
    {:else if empty}
      {#if !readOnly && onEdit}
        <PanelState
          type="empty"
          icon="fa-wand-magic-sparkles"
          title="No sequences match this rule"
          message="The rule is active, but its current source has no matches."
        >
          {#snippet actions()}
            <PanelButton variant="primary" onclick={onEdit}>
              <i class="fas fa-sliders" aria-hidden="true"></i>
              Edit rule
            </PanelButton>
          {/snippet}
        </PanelState>
      {:else}
        <PanelState
          type="empty"
          icon="fa-wand-magic-sparkles"
          title="No sequences match this rule"
          message="Nothing in the current source matches this built-in rule."
        />
      {/if}
    {:else if children}
      {@render children()}
    {/if}
  </div>
</section>

<style>
  .smart-detail {
    container: smart-detail / inline-size;
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    background:
      radial-gradient(
        circle at 92% 0%,
        color-mix(in srgb, var(--smart-color) 8%, transparent),
        transparent 30cqi
      ),
      var(--theme-bg, transparent);
  }

  .detail-head {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 12px;
    padding: clamp(12px, 2cqi, 20px);
  }

  .icon-button {
    display: inline-flex;
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, white);
    cursor: pointer;
  }

  .icon-button:hover {
    border-color: color-mix(in srgb, var(--smart-color) 45%, transparent);
    background: color-mix(
      in srgb,
      var(--smart-color) 10%,
      var(--theme-card-bg, transparent)
    );
  }

  .icon-button:focus-visible {
    outline: 2px solid var(--smart-color);
    outline-offset: 2px;
  }

  .collection-icon {
    display: inline-flex;
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--smart-color) 35%, transparent);
    border-radius: 14px;
    background: color-mix(in srgb, var(--smart-color) 18%, transparent);
    color: color-mix(in srgb, var(--smart-color) 78%, white);
    font-size: 18px;
  }

  .title-block,
  .title-editor {
    min-width: 0;
    flex: 1;
  }

  .title-line {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
  }

  .title-block h2 {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--theme-text, white);
    font-size: clamp(18px, 3cqi, 26px);
    font-weight: 750;
    letter-spacing: -0.015em;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title-block p {
    margin: 4px 0 0;
    overflow: hidden;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.64));
    font-size: var(--font-size-sm, 14px);
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .built-in-badge {
    display: inline-flex;
    min-height: 28px;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    padding: 5px 9px;
    border: 1px solid color-mix(in srgb, var(--smart-color) 30%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--smart-color) 11%, transparent);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.78));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    white-space: nowrap;
  }

  .head-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 8px;
  }

  .rule-wrap {
    flex: 0 0 auto;
    padding: 0 clamp(12px, 2cqi, 20px) clamp(12px, 2cqi, 18px);
  }

  :global(.rule-disclosure-trigger) {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    width: 100%;
    min-height: 48px;
    align-items: center;
    gap: 10px;
    padding: 6px 12px 6px 7px;
    border: 1px solid
      color-mix(
        in srgb,
        var(--smart-color) 28%,
        var(--theme-stroke, rgba(255, 255, 255, 0.1))
      );
    border-radius: 12px;
    background: color-mix(
      in srgb,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 92%,
      var(--smart-color) 8%
    );
    color: var(--theme-text, white);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }

  :global(.rule-disclosure-trigger:hover) {
    border-color: color-mix(in srgb, var(--smart-color) 48%, transparent);
    background: color-mix(
      in srgb,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 86%,
      var(--smart-color) 14%
    );
  }

  :global(.rule-disclosure-trigger:focus-visible) {
    outline: 2px solid var(--smart-color);
    outline-offset: 2px;
  }

  .rule-disclosure-icon {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 9px;
    background: color-mix(in srgb, var(--smart-color) 16%, transparent);
    color: color-mix(in srgb, var(--smart-color) 74%, white);
    font-size: 13px;
  }

  .rule-disclosure-copy {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: 8px;
  }

  .rule-disclosure-copy strong {
    color: var(--theme-text, white);
    font-size: var(--font-size-sm, 14px);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    white-space: nowrap;
  }

  .rule-disclosure-copy span {
    overflow: hidden;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.64));
    font-size: var(--font-size-compact, 12px);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rule-disclosure-chevron {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.64));
    font-size: 12px;
    transition: transform 160ms ease;
  }

  .rule-disclosure-chevron.open {
    transform: rotate(180deg);
  }

  :global(.rule-disclosure-content) {
    overflow: hidden;
  }

  .rule-disclosure-content-inner {
    padding-top: 8px;
  }

  .detail-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .content-first .detail-body {
    border-top: 0;
  }

  .content-first-back {
    flex: 0 0 auto;
    padding: 8px 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .content-first-back .back-button {
    width: auto;
    gap: 8px;
    padding: 0 12px;
    font-family: inherit;
    font-size: var(--font-size-sm, 14px);
    font-weight: 650;
  }

  @container smart-detail (max-width: 560px) {
    .detail-head {
      gap: 8px;
      padding: 10px;
    }

    .content-first-back {
      padding: 6px 10px;
    }

    .collection-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      font-size: 16px;
    }

    /* The one-line description survives on phones — hiding it left built-in
       collections explained by nothing but a padlock (audit X-18). */
    .title-block p {
      font-size: var(--font-size-compact, 12px);
    }

    .built-in-badge {
      min-height: 24px;
      padding: 4px 7px;
    }

    .edit-label {
      display: none;
    }

    .head-actions :global(.panel-btn) {
      width: 44px;
      padding: 0;
    }

    .rule-wrap {
      padding: 0 10px 10px;
    }

    :global(.rule-disclosure-trigger) {
      min-height: 44px;
      grid-template-columns: 30px minmax(0, 1fr) auto;
      padding: 5px 10px 5px 6px;
    }

    .rule-disclosure-icon {
      width: 30px;
      height: 30px;
    }
  }

  @container smart-detail (max-width: 410px) {
    .collection-icon {
      display: none;
    }

    /* Keep the words: a lone padlock with clipped transparent text was an
       unlabeled glyph on phones (audit X-18). */
    .built-in-badge {
      min-height: 22px;
      gap: 4px;
      padding: 3px 6px;
      font-size: 11px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .icon-button,
    .rule-disclosure-chevron {
      transition: none;
    }
  }
</style>
