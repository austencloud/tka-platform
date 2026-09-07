<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import {
    KINETIC_SHAPE_ENGINE_AUTHOR,
    KINETIC_SHAPE_ENGINE_NAME,
    ORIGINAL_SHAPE_MATRIX_URL,
    ORIGINAL_SHAPE_MATRIX_VTG_RATIOS,
    SPIN_SCIENCE_URL,
  } from "../shape-engine-identity";

  const state = getShapeMatrixAppContext();
</script>

{#snippet header()}
  <ModalHeader
    id="shape-matrix-about-title"
    title={`About ${KINETIC_SHAPE_ENGINE_NAME}`}
    subtitle="Vulcan Tech Gospel, Lorq’s matrix, and Austen’s Shape Engine"
    icon="fa-table-cells-large"
    iconColor="#d9901a"
    onClose={state.closeAbout}
  />
{/snippet}

<BaseModal
  open={state.aboutOpen}
  onclose={state.closeAbout}
  size="xl"
  labelledBy="shape-matrix-about-title"
  {header}
>
  <div class="about-copy">
    <p>
      {KINETIC_SHAPE_ENGINE_NAME} is an independent exploration tool by
      {KINETIC_SHAPE_ENGINE_AUTHOR}. It is part of
      <a href="/composer">Flow Arts Composer</a>, also available as a standalone
      app.
    </p>
    <div class="about-columns">
      <section>
        <span class="section-kicker">Notation in this app</span>
        <h2>VTG ratios and TKA turns</h2>
        <p>
          Vulcan Tech Gospel (VTG) was developed by Noel Yee and spinners at the
          Vulcan Lofts in Oakland. The Level Matrix uses TKA turn values. The
          Ratio Playground uses exact whole-number spin ratios, including the
          VTG families {ORIGINAL_SHAPE_MATRIX_VTG_RATIOS}. Levels add finer turn
          increments and more possible paths as they progress. A higher level
          does not make every pattern harder.
        </p>
      </section>

      <section>
        <span class="section-kicker">Source inspiration</span>
        <h2>Lorq Nichols’ 144 Shape Matrix</h2>
        <p>
          Lorq Nichols, publishing as
          <a href={SPIN_SCIENCE_URL} target="_blank" rel="noopener noreferrer"
            >Spin Science</a
          >, created the original matrix. It pairs twelve driving styles for
          each hand into 144 combinations. Shape Engine takes inspiration from
          that row-and-column format.
        </p>
        <p>
          Austen built this app independently, including its prop selection,
          relationship solving, live animation, and pictograph readouts. It is
          not an official Spin Science release.
        </p>
      </section>
    </div>
    <div class="source-links">
      <a href="/guide/ratios">
        Read ratios in TKA
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </a>
      <a
        href={ORIGINAL_SHAPE_MATRIX_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        View Lorq Nichols’ 144 Shape Matrix
        <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
      </a>
    </div>
  </div>
</BaseModal>

<style>
  .about-copy {
    display: grid;
    gap: 1.5rem;
    padding: clamp(1rem, 2.2vw, 2rem);
    color: var(--theme-text-dim, rgb(255 255 255 / 0.72));
    font-size: 0.98rem;
    line-height: 1.65;
  }

  .about-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(1.5rem, 4vw, 4rem);
  }

  section {
    display: grid;
    align-content: start;
    gap: 0.8rem;
  }

  p {
    margin: 0;
    max-inline-size: var(--measure-prose, 68ch);
  }

  p a {
    color: #f4b54c;
    text-underline-offset: 0.2em;
  }

  h2 {
    color: var(--theme-text, #fff);
  }

  .section-kicker {
    color: #f4b54c;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 750;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h2 {
    margin: -0.25rem 0 0;
    font-size: clamp(1.2rem, 1.8vw, 1.55rem);
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .source-links {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
    margin-top: 0.25rem;
  }

  .source-links a {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.55rem 0.8rem;
    border: 1px solid rgb(245 158 11 / 0.42);
    border-radius: 12px;
    background: rgb(245 158 11 / 0.08);
    color: var(--theme-text, #fff);
    font-weight: 600;
    text-align: center;
    text-decoration: none;
  }

  .source-links a:hover {
    background: rgb(245 158 11 / 0.14);
    border-color: rgb(245 158 11 / 0.7);
  }

  .source-links a:focus-visible {
    outline: 2px solid #f59e0b;
    outline-offset: 2px;
  }

  @media (max-width: 52rem) {
    .about-columns {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 36rem) {
    .source-links {
      grid-template-columns: 1fr;
    }

    .about-copy {
      padding: 1rem;
    }
  }
</style>
