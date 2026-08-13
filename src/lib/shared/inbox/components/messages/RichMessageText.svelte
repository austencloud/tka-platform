<script lang="ts">
  import { parseMessageText } from "../../domain/message-link-parts";

  interface Props {
    content: string;
    isOwn: boolean;
    attachment?: boolean;
    linkify?: boolean;
  }

  let { content, isOwn, attachment = false, linkify = true }: Props = $props();

  const parts = $derived(
    linkify
      ? parseMessageText(content)
      : ([{ kind: "text", text: content }] as const)
  );
</script>

<p
  class="message-text"
  class:own={isOwn}
  class:attachment
  data-message-selectable="true"
>
  {#each parts as part, index (`${part.kind}-${index}`)}
    {#if part.kind === "link"}
      <a
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        data-message-link="true">{part.text}</a
      >
    {:else}{part.text}{/if}
  {/each}
</p>

<style>
  .message-text {
    margin: 0 0 4px;
    font-size: var(--font-size-sm);
    line-height: 1.4;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--theme-text);
    cursor: text;
    -webkit-user-select: text;
    user-select: text;
    -webkit-touch-callout: default;
  }

  .message-text.own {
    color: white;
  }

  .message-text.attachment {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke);
  }

  a {
    color: var(--theme-accent, var(--semantic-info));
    font-weight: 600;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .own a {
    color: white;
    text-decoration-color: rgba(255, 255, 255, 0.72);
  }

  a:hover {
    text-decoration-thickness: 2px;
  }

  a:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
    border-radius: 2px;
  }

  .message-text::selection,
  .message-text *::selection {
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--semantic-info)) 42%,
      transparent
    );
  }

  .message-text.own::selection,
  .message-text.own *::selection {
    color: var(--theme-text, #111827);
    background: rgba(255, 255, 255, 0.82);
  }
</style>
