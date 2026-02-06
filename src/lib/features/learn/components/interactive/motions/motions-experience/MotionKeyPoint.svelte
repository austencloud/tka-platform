<!--
MotionKeyPoint - Key point display with lightbulb icon
-->
<script lang="ts">
  let {
    text,
    color,
  }: {
    text: string;
    color: string;
  } = $props();
</script>

<div class="key-point" style="--type-color: {color}">
  <i class="fa-solid fa-lightbulb" aria-hidden="true"></i>
  <span>{text}</span>
</div>

<style>
  .key-point {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: color-mix(in srgb, var(--type-color) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--type-color) 20%, transparent);
    border-radius: 10px;
  }

  .key-point i {
    color: var(--type-color);
    font-size: 1.125rem;
  }

  .key-point span {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.85);
  }
</style>
