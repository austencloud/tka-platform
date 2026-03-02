<script lang="ts">
  interface Props {
    onAdvance: () => void;
  }
  const { onAdvance }: Props = $props();
</script>

<div class="tutorial-step">
  <h1>Play your sequence</h1>
  <button onclick={onAdvance}>Next</button>
</div>
