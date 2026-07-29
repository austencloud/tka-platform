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

  // Trailing punctuation after a chip ("...yourself].") would otherwise wrap
  // onto its own line when the chip breaks; glue it to the chip instead.
  const segments = $derived.by(() => {
    const raw = toChangelogSegments(text);
    return raw.map((segment, i) => {
      if (segment.kind === "link") {
        const next = raw[i + 1];
        const suffix =
          next?.kind === "text"
            ? (next.value.match(/^[.,!?;:)]+/)?.[0] ?? "")
            : "";
        return { ...segment, suffix };
      }
      if (segment.kind === "text" && raw[i - 1]?.kind === "link") {
        return {
          ...segment,
          value: segment.value.replace(/^[.,!?;:)]+/, ""),
        };
      }
      return segment;
    });
  });
</script>

<span class="rich-text">
  {#each segments as segment}
    {#if segment.kind === "text"}{segment.value}{:else if segment.kind === "link"}<span
        class="chip-glue"
        ><a
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
        >{segment.suffix}</span
      >{:else}<span class="inline-icon" aria-hidden="true"
        ><i class="fas {segment.name}"></i></span
      >{/if}
  {/each}
</span>

<style>
  .rich-text {
    display: inline;
  }

  /* Chip + its trailing punctuation move as one unit across line breaks. */
  .chip-glue {
    white-space: nowrap;
  }

  /* Inline pill chip: reads as a button, flows inside the sentence.
     Anchor semantics kept — it navigates. */
  .entry-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.15em 0.65em;
    margin: 0.1em 0.05em;
    background: color-mix(
      in srgb,
      var(--theme-accent, #6ea8fe) 14%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #6ea8fe) 35%, transparent);
    border-radius: 999px;
    color: var(--theme-accent, #6ea8fe);
    font-weight: 600;
    text-decoration: none;
    white-space: normal; /* long labels wrap INSIDE the pill (chip-glue is nowrap) */
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

  /* Invisible hit-area extension so the effective touch target clears the
     44px floor without inflating the line box. */
  .entry-link::after {
    content: "";
    position: absolute;
    inset: -0.6em -0.3em;
  }

  .entry-link:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent, #6ea8fe) 24%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #6ea8fe) 60%,
      transparent
    );
    color: color-mix(in srgb, var(--theme-accent, #6ea8fe) 75%, white);
  }

  .entry-link::before {
    content: "\f105"; /* fa-angle-right: "this takes you somewhere" */
    font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
    font-weight: 900;
    font-size: 0.75em;
    opacity: 0.8;
    order: 2;
  }

  .external-mark {
    font-size: 0.7em;
    opacity: 0.75;
    order: 3;
  }

  /* External chips show the external mark instead of the chevron. */
  .entry-link:has(.external-mark)::before {
    content: none;
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
