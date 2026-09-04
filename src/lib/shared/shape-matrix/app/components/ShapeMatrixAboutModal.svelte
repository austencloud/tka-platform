<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  const state = getShapeMatrixAppContext();
</script>

{#snippet header()}
  <ModalHeader
    id="shape-matrix-about-title"
    title="About Shape Matrix Explorer"
    subtitle="Lorq’s foundation and what this app adds"
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
      Lorq Nichols created the Shape Matrix and publishes as
      <a
        href="http://spinscience.xyz/"
        target="_blank"
        rel="noopener noreferrer">Spin Science</a
      >. His framework pairs one hand's driving style with the other hand's to
      map a field of shapes.
    </p>
    <p>
      Shape Matrix Explorer is an independently built app based on that
      foundation. It does not reproduce Nichols' original diagram or present
      itself as an official Spin Science release. TKA levels, quarter-turn and
      mixed-axis bands, prop selection, hand/prop relationship derivation,
      animation, and pictograph readouts are additions made here.
    </p>
    <p>
      <strong>Element relationships.</strong> Choose a hand timing and direction.
      The prop result follows automatically. When the selected flowers support two
      exact prop phases, both choices appear so you can pick the result you want.
    </p>
    <p>
      <strong>Theory.</strong> The Theory view opens the rational field past what
      either notation names. Kinetic Alphabet levels name turn values down to a
      quarter turn, which inside this field covers Float, 1:2 and isolation and
      nothing finer, so a ratio like 1:3 or 4:9 has no turn, no letter and no
      level. VTG classifies timing and direction rather than the whole field.
      Those shapes are exact and worth exploring; they stand outside both
      notations rather than at the top of either.
    </p>
    <div class="source-links">
      <a
        href="http://spinscience.xyz/2014/07/10/144-shape-matrix-even-petaled-flowers-rework/"
        target="_blank"
        rel="noopener noreferrer"
      >
        View the original 144 Shape Matrix
        <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
      </a>
      <a
        href="http://spinscience.xyz/work/"
        target="_blank"
        rel="noopener noreferrer"
      >
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
