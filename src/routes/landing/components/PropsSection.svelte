<script lang="ts">
  import { PROPS_LIST } from "../landing-content";
</script>

<section class="props-section" id="props">
  <div class="container">
    <h2>30+ Supported Props</h2>
    <p class="section-intro">
      TKA Composer works with virtually every flow prop — both unilateral
      (one-handed) and bilateral (two-handed).
    </p>

    <div class="props-showcase">
      {#each PROPS_LIST as prop}
        <div class="prop-tag">{prop}</div>
      {/each}
      <div class="prop-tag more">+ many more</div>
    </div>
  </div>
</section>

<style>
  .props-section {
    padding: 120px 24px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 600;
    line-height: 1.2;
  }

  .section-intro {
    text-align: center;
    font-size: 1.125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 700px;
    margin: 0 auto 3rem;
  }

  /* Props showcase */
  .props-showcase {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .prop-tag {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding: 10px 20px;
    border-radius: 100px;
    font-size: var(--font-size-sm, 0.875rem);
    transition: all var(--duration-normal) ease;
  }

  .prop-tag:hover {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
  }

  .prop-tag.more {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-style: italic;
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-tag {
      transition: none;
    }
  }
</style>
