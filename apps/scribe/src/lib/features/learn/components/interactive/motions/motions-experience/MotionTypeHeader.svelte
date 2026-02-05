<!--
MotionTypeHeader - Type intro with icon and description
-->
<script lang="ts">
  import type { MotionInfo } from "../../../../domain/constants/motion-experience-data";

  let { info }: { info: MotionInfo } = $props();
</script>

<div class="type-intro" style="--type-color: {info.color}">
  <div class="type-icon">
    <i class="fa-solid {info.icon}" aria-hidden="true"></i>
  </div>
  <p class="type-description">{info.description}</p>
</div>

<style>
  .type-intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    border-radius: 16px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--type-color) 10%, transparent) 0%,
      transparent 100%
    );
    border: 1px solid color-mix(in srgb, var(--type-color) 25%, transparent);
  }

  .type-icon {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--type-color) 20%, transparent);
    color: var(--type-color);
    font-size: 1.5rem;
  }

  .type-description {
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--type-color);
    margin: 0;
    text-align: center;
  }
</style>
