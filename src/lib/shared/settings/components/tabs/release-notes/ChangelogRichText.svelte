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
  import { toChangelogSegments } from "$lib/shared/versioning/domain/utils/changelog-rich-text";

  let {
    text,
    onNavigate,
  }: {
    text: string;
    /** Called when an internal link is clicked (hosts close their modal). */
    onNavigate?: () => void;
  } = $props();

  const segments = $derived(toChangelogSegments(text));
</script>

<span class="rich-text">
  {#each segments as segment}
    {#if segment.kind === "text"}{segment.value}{:else if segment.kind === "link"}<a
        class="entry-link"
        href={segment.href}
        target={segment.external ? "_blank" : undefined}
        rel={segment.external ? "noopener noreferrer" : undefined}
        onclick={(e) => {
          e.stopPropagation();
          if (!segment.external) onNavigate?.();
        }}
        >{segment.label}{#if segment.external}<i
            class="fas fa-external-link-alt external-mark"
            aria-hidden="true"
          ></i>{/if}</a
      >{:else}<span class="inline-icon" aria-hidden="true"
        ><i class="fas {segment.name}"></i></span
      >{/if}
  {/each}
</span>

<style>
  .rich-text {
    display: inline;
  }

  .entry-link {
    color: var(--theme-accent, #6ea8fe);
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: color-mix(
      in srgb,
      var(--theme-accent, #6ea8fe) 45%,
      transparent
    );
    text-underline-offset: 3px;
    transition:
      color 0.15s,
      text-decoration-color 0.15s;
  }

  .entry-link:hover {
    color: color-mix(in srgb, var(--theme-accent, #6ea8fe) 80%, white);
    text-decoration-color: currentColor;
  }

  .external-mark {
    margin-left: 0.35em;
    font-size: 0.7em;
    vertical-align: baseline;
    opacity: 0.75;
  }

  .inline-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5em;
    height: 1.5em;
    margin: 0 0.15em;
    vertical-align: -0.35em;
    background: color-mix(
      in srgb,
      var(--theme-accent, #6ea8fe) 18%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #6ea8fe) 35%, transparent);
    border-radius: 50%;
    color: var(--theme-accent, #6ea8fe);
    font-size: 0.85em;
  }

  .inline-icon i {
    font-size: 0.7em;
  }
</style>
