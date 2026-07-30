<!--
  ChangelogRichText - renders changelog entry text with inline links and icons

  Entry text supports two tokens, both authored by the release pipeline:
    [label](url)   -> real link. Internal URLs (tkaflowarts.com / relative)
                      client-route in-app; external URLs open a new tab.
    {icon:name}    -> inline FontAwesome glyph, e.g. {icon:play}

  Shared by WhatsNewModal and the Release Notes tab so both surfaces render
  identically. Plain text passes through untouched — no @html anywhere.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { toChangelogSegments } from "$lib/shared/versioning/domain/utils/changelog-rich-text";

  type ChangelogAction = {
    label: string;
    href: string;
    external: boolean;
  };

  let {
    text,
    onNavigate,
  }: {
    text: string;
    /** Called when an internal link is clicked (hosts close their modal). */
    onNavigate?: () => void;
  } = $props();

  function handleActionClick(event: MouseEvent, action: ChangelogAction): void {
    const isModifiedClick =
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey;

    if (action.external || event.defaultPrevented || isModifiedClick) return;

    event.preventDefault();
    void goto(action.href);
    onNavigate?.();
  }

  // Prose stays prose: link labels render as emphasized text inside the
  // sentence, and the links themselves drop below as a row of real buttons.
  // A verb phrase mid-sentence should never look like a button.
  const parts = $derived.by(() => {
    const raw = toChangelogSegments(text);
    const actions: ChangelogAction[] = [];
    for (const s of raw) {
      if (s.kind === "link" && !actions.some((a) => a.href === s.href)) {
        actions.push({
          label: s.label.charAt(0).toUpperCase() + s.label.slice(1),
          href: s.href,
          external: s.external,
        });
      }
    }
    return { segments: raw, actions };
  });
</script>

<span class="rich-text">
  <span class="prose">
    {#each parts.segments as segment}
      {#if segment.kind === "text"}{segment.value}{:else if segment.kind === "link"}<span
          class="link-label">{segment.label}</span
        >{:else}<span class="inline-icon" aria-hidden="true"
          ><i class="fas {segment.name}"></i></span
        >{/if}
    {/each}
  </span>
  {#if parts.actions.length > 0}
    <span class="action-row">
      {#each parts.actions as action}
        <a
          class="action-btn"
          href={action.href}
          target={action.external ? "_blank" : undefined}
          rel={action.external ? "noopener noreferrer" : undefined}
          onclick={(event) => handleActionClick(event, action)}
        >
          {action.label}
          <i
            class="fas {action.external
              ? 'fa-external-link-alt'
              : 'fa-angle-right'} action-mark"
            aria-hidden="true"
          ></i>
        </a>
      {/each}
    </span>
  {/if}
</span>

<style>
  .rich-text {
    display: inline;
  }

  .prose {
    display: inline;
  }

  /* The word the button refers to, emphasized but NOT interactive —
     the action row below is the click target. */
  .link-label {
    color: color-mix(
      in srgb,
      var(--theme-accent, #6ea8fe) 70%,
      var(--theme-text, #fff)
    );
    font-weight: 600;
  }

  .action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  /* Real button: anchor with button appearance, 44px-friendly padding. */
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
    min-height: 32px;
    padding: 5px 14px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #6ea8fe) 12%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #6ea8fe) 32%, transparent);
    border-radius: 999px;
    color: var(--theme-accent, #6ea8fe);
    font-size: 0.92em;
    font-weight: 600;
    line-height: 1.2;
    text-decoration: none;
    position: relative;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

  /* Invisible hit-area extension: effective touch target clears 44px. */
  .action-btn::after {
    content: "";
    position: absolute;
    inset: -7px 0;
  }

  .action-btn:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent, #6ea8fe) 22%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #6ea8fe) 55%,
      transparent
    );
    color: color-mix(in srgb, var(--theme-accent, #6ea8fe) 75%, white);
  }

  .action-mark {
    font-size: 0.75em;
    opacity: 0.8;
  }

  .inline-icon {
    display: inline;
    margin: 0 0.1em;
    color: var(--theme-accent, #6ea8fe);
    font-size: 0.85em;
  }
</style>
