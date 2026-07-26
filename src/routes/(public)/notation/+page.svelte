<!--
  /notation — GATED 2026-07-26.

  The hub page is being rebuilt. Production shows the shared UnderConstruction
  note; dev renders the old draft (_components/NotationHubDraft.svelte) so the
  rebuild has something to work against. The sub-pages under /notation
  (letters, per-prop, shape-matrix, loops, caps) are unaffected and stay live.

  To un-gate: delete the `dev` branch below, restore the SEO head from the draft
  onto this file, and re-add `{ url: "notation" }` to src/routes/sitemap.xml.
-->
<script lang="ts">
  import { dev } from "$app/environment";
  import UnderConstruction from "$lib/shared/landing/components/UnderConstruction.svelte";
  import NotationHubDraft from "./_components/NotationHubDraft.svelte";
</script>

<!-- svelte:head has to sit at the top level of the component, so the gated
     head is an {#if} inside it rather than a branch around it. The draft
     carries its own full SEO head for the dev branch. -->
<svelte:head>
  {#if !dev}
    <title>Flow Arts Notation | The Kinetic Alphabet</title>
    <meta
      name="description"
      content="The Flow Arts Notation overview is being rebuilt. The letters, props, shape matrix, LOOP algebra, and CAP pages are all still here."
    />
    <!-- Gated: keep it out of search until the rebuilt page ships. -->
    <meta name="robots" content="noindex, follow" />
  {/if}
</svelte:head>

{#if dev}
  <NotationHubDraft />
{:else}
  <UnderConstruction
    title="Flow Arts Notation"
    note="This overview is being rebuilt from scratch. Everything it linked to is still here and still works."
    destinations={[
      { label: "The letter index", href: "/notation/letters", icon: "fa-language" },
      { label: "Shape Matrix", href: "/notation/shape-matrix", icon: "fa-diagram-project" },
      { label: "The LOOP algebra", href: "/notation/loops", icon: "fa-rotate" },
      { label: "CAPs", href: "/notation/caps", icon: "fa-circle-nodes" },
    ]}
  />
{/if}
