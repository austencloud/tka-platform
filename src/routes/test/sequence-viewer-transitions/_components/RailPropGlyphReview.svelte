<script lang="ts">
  import RailPropGlyph from "$lib/shared/components/RailPropGlyph.svelte";
  import {
    getAllPropTypes,
    getPropTypeDisplayInfo,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";

  const propTypes = getAllPropTypes();
</script>

<svelte:head>
  <title>Sequence Viewer prop glyph fit</title>
</svelte:head>

<main class="glyph-review">
  <header>
    <span>Visual contract</span>
    <h1>Rail prop glyph fit</h1>
    <p>
      Every supported prop in the production desktop rail and mobile dock
      geometry. Artwork should feel confident without touching the button edge.
    </p>
  </header>

  <section class="glyph-grid" aria-label="All prop rail glyphs">
    {#each propTypes as propType}
      {@const info = getPropTypeDisplayInfo(propType)}
      <article class="glyph-card" data-prop-type={propType}>
        <div class="button-pair" aria-hidden="true">
          <div class="rail-button">
            <RailPropGlyph {propType} size={26} />
          </div>
          <div class="dock-button">
            <RailPropGlyph {propType} size={20} />
          </div>
        </div>
        <strong>{info.label}</strong>
        <small>{propType}</small>
      </article>
    {/each}
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    min-height: 100%;
    background: var(--theme-bg, #090b11);
  }

  .glyph-review {
    box-sizing: border-box;
    min-height: 100dvh;
    padding: clamp(18px, 3vw, 42px);
    background:
      radial-gradient(
        circle at 12% 5%,
        color-mix(in srgb, var(--theme-accent, #8b6cff) 14%, transparent),
        transparent 28%
      ),
      var(--theme-bg, #090b11);
    color: var(--theme-text, #f7f8fb);
  }

  .glyph-review > header,
  .glyph-grid {
    width: min(100%, 1560px);
    margin-inline: auto;
  }

  .glyph-review > header > span {
    color: var(--theme-accent, #9b7cff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h1,
  p {
    margin: 0;
  }

  h1 {
    margin-top: 4px;
    font-size: clamp(30px, 4vw, 54px);
    line-height: 1.05;
  }

  p {
    max-width: 720px;
    margin-top: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.64));
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
  }

  .glyph-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 10px;
    margin-top: 24px;
  }

  .glyph-card {
    display: grid;
    min-width: 0;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-items: center;
    gap: 2px 12px;
    padding: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
  }

  .button-pair {
    display: flex;
    grid-row: 1 / 3;
    align-items: center;
    gap: 6px;
  }

  .rail-button,
  .dock-button {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid
      color-mix(in srgb, var(--prop-blue-text, #818cf8) 56%, transparent);
    background: color-mix(
      in srgb,
      var(--prop-blue-text, #818cf8) 12%,
      var(--theme-card-bg, #141620)
    );
    box-shadow: 0 0 14px
      color-mix(in srgb, var(--prop-blue-text, #818cf8) 10%, transparent);
  }

  .rail-button {
    width: 56px;
    height: 56px;
    border-radius: 13px;
  }

  .dock-button {
    width: 44px;
    height: 44px;
    border-radius: 10px;
  }

  .glyph-card strong,
  .glyph-card small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .glyph-card strong {
    align-self: end;
    font-size: var(--font-size-min, 14px);
  }

  .glyph-card small {
    align-self: start;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-compact, 12px);
  }

  @media (max-width: 560px) {
    .glyph-review {
      padding: 14px;
    }

    .glyph-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
