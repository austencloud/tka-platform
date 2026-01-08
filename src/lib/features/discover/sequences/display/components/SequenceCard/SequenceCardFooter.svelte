<!--
SequenceCardFooter - Footer component for SequenceCard

Ultra-minimal footer with centered title only.
Applies difficulty-based background styling.

All actions are in the detail panel (accessed by clicking the card).
-->
<script lang="ts">
  const { title, levelStyle } = $props<{
    title: string;
    levelStyle: { background: string; textColor: string };
  }>();
</script>

<div
  class="metadata"
  style="background: {levelStyle.background}; color: {levelStyle.textColor};"
>
  <p class="title" {title}>{title}</p>
</div>

<style>
  .metadata {
    padding: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .title {
    font-size: 1.35rem;
    font-weight: 700;
    text-align: center;
    margin: 0;
    line-height: 1.2;
    width: 100%;
  }

  /* Container query responsive sizing */
  @container sequence-card (max-width: 249px) {
    .title {
      font-size: 1rem;
    }

    .metadata {
      padding: 10px;
    }
  }

  @container sequence-card (min-width: 252px) and (max-width: 299px) {
    .title {
      font-size: 1.15rem;
    }

    .metadata {
      padding: 11px;
    }
  }

  @container sequence-card (min-width: 300px) {
    .title {
      font-size: 1.35rem;
    }
  }
</style>
