<script lang="ts">
  import { getFestivalContext } from "../../context/festival-context";

  const { state } = getFestivalContext();

  const portfolio = $derived(state.portfolio);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard unavailable — silently skip
    }
  }

  function formatSocialLabel(key: string): string {
    const labels: Record<string, string> = {
      website: "Website",
      instagram: "Instagram",
      facebook: "Facebook",
      youtube: "YouTube",
      tiktok: "TikTok",
    };
    return labels[key] ?? key;
  }
</script>

{#if portfolio}
  <div class="materials-panel">
    <h3 class="section-title">My Materials</h3>

    <!-- My Classes -->
    <details class="collapsible" open>
      <summary class="collapsible-summary">
        <span>My Classes</span>
        <span class="count-chip">{portfolio.classes.length}</span>
        <i class="fas fa-chevron-down chevron" aria-hidden="true"></i>
      </summary>
      <div class="collapsible-body">
        {#if portfolio.classes.length === 0}
          <p class="empty-note">No workshop templates added yet.</p>
        {:else}
          {#each portfolio.classes as workshop}
            <div class="material-item">
              <div class="item-header">
                <span class="item-title">{workshop.title}</span>
                <button
                  class="copy-btn"
                  onclick={() => copy(`${workshop.title}\n\n${workshop.description}`)}
                  aria-label={`Copy ${workshop.title}`}
                >
                  <i class="far fa-copy" aria-hidden="true"></i>
                  Copy
                </button>
              </div>
              <p class="item-body">{workshop.description}</p>
              {#if workshop.props.length > 0}
                <div class="item-tags">
                  {#each workshop.props as prop}
                    <span class="tag">{prop}</span>
                  {/each}
                  <span class="tag tag-level">{workshop.level}</span>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </details>

    <!-- My Bios -->
    <details class="collapsible">
      <summary class="collapsible-summary">
        <span>My Bios</span>
        <span class="count-chip">{portfolio.bios.length}</span>
        <i class="fas fa-chevron-down chevron" aria-hidden="true"></i>
      </summary>
      <div class="collapsible-body">
        {#if portfolio.bios.length === 0}
          <p class="empty-note">No bios saved yet.</p>
        {:else}
          {#each portfolio.bios as bio}
            <div class="material-item">
              <div class="item-header">
                <span class="item-title">{bio.label}</span>
                <div class="item-header-right">
                  <span class="char-count">{bio.text.length} chars</span>
                  <button
                    class="copy-btn"
                    onclick={() => copy(bio.text)}
                    aria-label={`Copy ${bio.label} bio`}
                  >
                    <i class="far fa-copy" aria-hidden="true"></i>
                    Copy
                  </button>
                </div>
              </div>
              <p class="item-body bio-text">{bio.text}</p>
            </div>
          {/each}
        {/if}
      </div>
    </details>

    <!-- My Links -->
    <details class="collapsible">
      <summary class="collapsible-summary">
        <span>My Links</span>
        <i class="fas fa-chevron-down chevron" aria-hidden="true"></i>
      </summary>
      <div class="collapsible-body">
        {#if Object.entries(portfolio.socialLinks).filter(([, v]) => !!v).length === 0}
          <p class="empty-note">No social links added yet.</p>
        {:else}
          <div class="links-list">
            {#each Object.entries(portfolio.socialLinks).filter(([, v]) => !!v) as [key, value]}
              <div class="link-row">
                <span class="link-label">{formatSocialLabel(key)}</span>
                <span class="link-value">{value}</span>
                <button
                  class="copy-btn"
                  onclick={() => copy(value as string)}
                  aria-label={`Copy ${formatSocialLabel(key)} link`}
                >
                  <i class="far fa-copy" aria-hidden="true"></i>
                  Copy
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </details>
  </div>
{/if}

<style>
  .materials-panel {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 20px 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .section-title {
    margin: 0 0 8px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    opacity: 0.7;
  }

  /* Collapsible */
  .collapsible {
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    overflow: hidden;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
  }

  .collapsible-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    cursor: pointer;
    list-style: none;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text, #ffffff);
    user-select: none;
    transition: background-color 0.15s ease;
  }

  .collapsible-summary::-webkit-details-marker {
    display: none;
  }

  .collapsible-summary:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.06));
  }

  .count-chip {
    margin-left: 2px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 10px;
    padding: 1px 7px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
  }

  .chevron {
    margin-left: auto;
    font-size: 11px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
    transition: transform 0.2s ease;
  }

  details[open] .chevron {
    transform: rotate(180deg);
  }

  .collapsible-body {
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Material items */
  .material-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
  }

  .item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .item-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .item-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    flex: 1;
    min-width: 0;
  }

  .item-body {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.65));
    line-height: 1.5;
  }

  .bio-text {
    white-space: pre-wrap;
    max-height: 120px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.15)) transparent;
  }

  .item-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .tag {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    background: rgba(255, 255, 255, 0.07);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tag-level {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    color: var(--theme-accent, #6366f1);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
  }

  .char-count {
    font-size: 11px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
    white-space: nowrap;
  }

  /* Copy button */
  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 6px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  .copy-btn:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  /* Links list */
  .links-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .link-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
  }

  .link-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    width: 72px;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .link-value {
    flex: 1;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, #ffffff);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty-note {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
    font-style: italic;
    padding: 4px 0;
  }
</style>
