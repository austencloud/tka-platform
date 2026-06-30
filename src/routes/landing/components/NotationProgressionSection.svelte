<script lang="ts">
  /**
   * NotationProgressionSection
   *
   * Shows the full ChoreoCard for the AABB sequence.
   * The hero pictograph (letter A) is already in HearthSection.
   * This section shows what happens when you string letters together.
   */
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  interface Props {
    sequence: SequenceData | null;
    propType?: PropType;
  }

  let { sequence, propType }: Props = $props();
</script>

<section class="progression">
  {#if sequence}
    <div class="container">
      <div class="section-header">
        <span class="label">String them together</span>
        <p class="caption-above">
          Four letters make the word <strong>{sequence.word}</strong>.
          Each cell is one step. Read left to right.
        </p>
      </div>

      <div class="card-showcase">
        <div class="card-frame">
          <ChoreoCard
            {sequence}
            darkMode={true}
            columnCount={4}
            bluePropType={propType}
            redPropType={propType}
            showDifficultyLevel={false}
            showCreatorName={false}
            showNotes={false}
            showBirthday={false}
            showLoopGlyph={false}
          />
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  .progression {
    padding: 40px 24px 100px;
  }

  .container {
    max-width: 700px;
    margin: 0 auto;
  }

  .section-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .label {
    display: block;
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--theme-accent, #6366f1);
    font-weight: 600;
    margin-bottom: 12px;
  }

  .caption-above {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    line-height: 1.7;
    margin: 0;
  }

  .caption-above strong {
    color: var(--theme-text, #fff);
    font-family: var(--landing-heading-font, "Instrument Serif", Georgia, serif);
    font-size: 1.1em;
  }

  .card-showcase {
    display: flex;
    justify-content: center;
  }

  .card-frame {
    width: 100%;
    max-width: 600px;
    height: clamp(220px, 35vw, 380px);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 20px;
    padding: 16px;
    overflow: hidden;
    box-shadow: 0 16px 60px rgba(0, 0, 0, 0.3);
  }

  @media (max-width: 600px) {
    .progression {
      padding: 32px 16px 72px;
    }

    .card-frame {
      height: clamp(180px, 50vw, 280px);
      border-radius: 16px;
      padding: 12px;
    }
  }
</style>
