<script lang="ts">
  interface Props {
    onAdvance: () => void;
  }
  const { onAdvance }: Props = $props();
</script>

<div class="tutorial-step">
  <h1>Add a beat</h1>
  <button onclick={onAdvance}>Next</button>
</div>
