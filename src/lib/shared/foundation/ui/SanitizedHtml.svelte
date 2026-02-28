<!--
  SanitizedHtml - Renders pre-sanitized HTML content.

  All HTML passed to this component MUST be sanitized (e.g. via DOMPurify)
  before passing. This component centralizes the {@html} directive so consuming
  components don't need to use it directly.

  Renders without a wrapper element to avoid extra DOM nesting.
-->
<script lang="ts">
  let {
    html,
  }: {
    html: string;
  } = $props();
</script>

{#if html}{@html html}{/if}
