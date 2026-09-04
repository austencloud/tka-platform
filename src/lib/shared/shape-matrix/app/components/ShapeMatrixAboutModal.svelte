<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import {
    KINETIC_SHAPE_ENGINE_NAME,
    ORIGINAL_SHAPE_MATRIX_URL,
    SPIN_SCIENCE_URL,
    SPIN_SCIENCE_WORK_URL,
  } from "../shape-engine-identity";

  const state = getShapeMatrixAppContext();
</script>

{#snippet header()}
  <ModalHeader
    id="shape-matrix-about-title"
    title={`About ${KINETIC_SHAPE_ENGINE_NAME}`}
    subtitle="Lorq’s foundation and what this engine adds"
    icon="fa-table-cells-large"
    iconColor="#d9901a"
    onClose={state.closeAbout}
  />
{/snippet}

<BaseModal
  open={state.aboutOpen}
  onclose={state.closeAbout}
  size="fit"
  labelledBy="shape-matrix-about-title"
  {header}
>
  <div class="about-copy">
    <p>
      <strong>The foundation.</strong> Lorq Nichols created the original 144
      Shape Matrix and publishes as
      <a href={SPIN_SCIENCE_URL} target="_blank" rel="noopener noreferrer"
        >Spin Science</a
      >. His matrix pairs one hand's driving style with the other hand's so the
      resulting flower shapes can be seen together.
    </p>
    <p>
      <strong>What this engine adds.</strong>
      {KINETIC_SHAPE_ENGINE_NAME} keeps that pairing model as its starting point.
      The Shape Matrix view extends it through TKA Levels 1–4 with independently selected
      turn bands. The Theory Matrix builds exact flower paths from whole-number spin
      ratios. Prop selection, element relationships, live animation, and pictograph
      readouts are additions made here.
    </p>
    <p>
      <strong>Independent work.</strong> This app was built independently by The Kinetic
      Alphabet. It does not reproduce Nichols' original diagram and is not an official
      Spin Science release.
    </p>
    <p>
      <strong>Element relationships.</strong> Choose a hand timing and direction.
      The prop result follows automatically. When the selected flowers support two
      exact prop phases, both choices appear so you can pick the result you want.
    </p>
    <p>
      <strong>The Theory Matrix.</strong> Its two axes contain exact whole-number
      spin ratios. The widest current band spans values from 0 through 15, except
      0:0, and every cell resolves to a closed flower path. TKA Levels 1–4 name zero,
      whole, half, Float, and quarter-turn values. Ratios such as 1:3 or 4:9 have
      no TKA turn, letter, or level. VTG can classify timing and direction where they
      apply, but it does not name the complete ratio pair.
    </p>
    <div class="source-links">
      <a
        href={ORIGINAL_SHAPE_MATRIX_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        View Lorq Nichols’ 144 Shape Matrix
        <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
      </a>
      <a href={SPIN_SCIENCE_WORK_URL} target="_blank" rel="noopener noreferrer">
        Explore Spin Science
        <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
      </a>
    </div>
  </div>
</BaseModal>

<style>
  .about-copy {
    display: grid;
    gap: 1rem;
    max-width: 42rem;
    padding: 1.25rem;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.72));
    font-size: 0.98rem;
    line-height: 1.65;
  }

  p {
    margin: 0;
  }

  p a {
    color: #f4b54c;
    text-underline-offset: 0.2em;
  }

  p strong {
    color: var(--theme-text, #fff);
    font-weight: 650;
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

  @media (max-width: 36rem) {
    .source-links {
      grid-template-columns: 1fr;
    }
    .about-copy {
      padding: 1rem;
    }
  }
</style>
