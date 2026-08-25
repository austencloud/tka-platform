<!--
  FilmCollectionGallery — the saved-films shelf as a Library Art gallery.

  The Library's art-detail pane clips its own overflow and mounts each gallery
  with no props, so the scroll shell has to come from the gallery. The shelf
  itself stays a flowing block, which is what the Director's marquee wants.
-->
<script lang="ts">
  import FilmCollectionModule from "./FilmCollectionModule.svelte";
</script>

<div class="film-gallery">
  <FilmCollectionModule
    emptyHint="Films you save from the director show up here. Open one to play it on the director's stage."
  />
</div>

<style>
  .film-gallery {
    height: 100%;
    padding: 1rem;
    overflow-y: auto;
  }
</style>
