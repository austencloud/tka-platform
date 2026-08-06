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
  import { openSheet } from "$lib/shared/navigation/services/sheet-router";
  import { toChangelogSegments } from "$lib/shared/versioning/domain/utils/changelog-rich-text";

  let {
    text,
    onNavigate,
  }: {
    text: string;
    /** Called when an internal link is clicked (hosts close their modal). */
    onNavigate?: () => void;
  } = $props();

  function handleLinkClick(
    event: MouseEvent,
    href: string,
    external: boolean
  ): void {
    const isModifiedClick =
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey;

    if (external || event.defaultPrevented || isModifiedClick) return;

    event.preventDefault();
    onNavigate?.();

    const destination = new URL(href, "https://tkaflowarts.com");
    if (destination.searchParams.get("sheet") === "inbox") {
      openSheet("inbox");
      return;
    }

    void goto(href);
  }

  const segments = $derived(toChangelogSegments(text));
</script>

<span class="rich-text">
  {#each segments as segment}
    {#if segment.kind === "text"}{segment.value}{:else if segment.kind === "link"}<a
        class="entry-link"
        href={segment.href}
        target={segment.external ? "_blank" : undefined}
        rel={segment.external ? "noopener noreferrer" : undefined}
        onclick={(event) =>
          handleLinkClick(event, segment.href, segment.external)}
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

  /* Release-note destinations are references inside a sentence. Keeping the
     linked phrase in place lets the note read naturally without repeating it
     as a second action underneath. */
  .entry-link {
    color: color-mix(
      in srgb,
      var(--theme-accent, #6ea8fe) 70%,
      var(--theme-text, #fff)
    );
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: color-mix(
      in srgb,
      var(--theme-accent, #6ea8fe) 42%,
      transparent
    );
    text-decoration-thickness: 1px;
    text-underline-offset: 0.18em;
    transition:
      color 0.15s,
      text-decoration-color 0.15s;
  }

  .entry-link:hover {
    color: color-mix(in srgb, var(--theme-accent, #6ea8fe) 78%, white);
    text-decoration-color: currentColor;
  }

  .entry-link:focus-visible {
    border-radius: 2px;
    outline: 2px solid var(--theme-accent, #6ea8fe);
    outline-offset: 2px;
  }

  .external-mark {
    margin-left: 0.35em;
    font-size: 0.7em;
    opacity: 0.75;
  }

  .inline-icon {
    display: inline;
    margin: 0 0.1em;
    color: var(--theme-accent, #6ea8fe);
    font-size: 0.85em;
  }
</style>
