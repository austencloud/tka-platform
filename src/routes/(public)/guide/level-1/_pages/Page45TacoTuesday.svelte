<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={45}
  title="Buy me a taco!"
  figureSrc="/guide/level-1/artboards/VTG Links and Changelog.png"
  figureAlt="Taco Tuesday Flow Jams location and details, plus VTG links"
>
  {#snippet intro()}
    <p class="center">
      Taco Tuesday Flow Jams are a celebration of flow arts and community!
      They're located in Chicago, IL in the heart of Palmer Square Park (2200 N Kedzie Blvd).
    </p>
    <p class="center">
      They've been around since 2017 and continue to be a weekly oasis for flow artists, jugglers,
      and acrobats to gather and share the joy of our art forms.
    </p>
    <p class="center">
      As a public outdoor event, it's sustained by the attendance of the people who show.
      If you're thinking "Is it happening this week? I'd love to go!", then ask:
      <br />
      • Is the weather nice? &nbsp; • Is it Tuesday?
      <br />
      If the answer is yes to both, then there will surely be people gathering in the park
      in the afternoon/evening, regardless of an event page or announcement!
    </p>
    <p class="center"><em>Our glorious deity TacoCat welcomes you with paws wide open!</em></p>
  {/snippet}
</HybridPage>
