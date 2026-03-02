<script lang="ts">
  interface Props {
    onAdvance: () => void;
  }
  const { onAdvance }: Props = $props();
</script>

<div class="tutorial-step">
  <h1>Open actions</h1>
  <button onclick={onAdvance}>Next</button>
</div>
