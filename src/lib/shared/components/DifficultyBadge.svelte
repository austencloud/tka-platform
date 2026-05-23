<script lang="ts">
  import { DIFFICULTY_LEVELS, DEFAULT_DIFFICULTY_STYLE } from "$lib/shared/config/difficulty-styles";

  interface Props {
    level: number;
    size?: string;
    fontSize?: string;
    class?: string;
  }

  let { level, size = "28px", fontSize, class: extraClass = "" }: Props = $props();

  const style = $derived(DIFFICULTY_LEVELS[level] ?? DEFAULT_DIFFICULTY_STYLE);
  const computedFontSize = $derived(fontSize ?? `calc(${size} * 0.6)`);
</script>

<span
  class="difficulty-badge {extraClass}"
  style="
    width: {size};
    height: {size};
    background: {style.cssBg};
    border-color: {style.border};
    color: {style.text};
    font-size: {computedFontSize};
  "
>
  {level}
</span>

<style>
  .difficulty-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid;
    font-family: Cambria, Georgia, serif;
    font-weight: 700;
    line-height: 1;
    flex-shrink: 0;
  }
</style>
