<script lang="ts">
  interface Props {
    onAdvance: () => void;
  }
  const { onAdvance }: Props = $props();
</script>

<div class="tutorial-step">
  <h1>You're ready</h1>
  <button onclick={onAdvance}>Finish</button>
</div>
