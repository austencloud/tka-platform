<!--
CircleQuarterIcon.svelte - Custom SVG icon showing a 90° quarter circle segment
Matches the visual style of Font Awesome's circle-half-stroke icon
-->
<script lang="ts">
  let { size = "1em", color = "currentColor" } = $props<{
    size?: string;
    color?: string;
  }>();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 512 512"
  width={size}
  height={size}
  fill={color}
  aria-hidden="true"
  role="img"
>
  <!-- Outer circle (stroke only) -->
  <path
    d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512z"
    fill={color}
  />
  <!-- Quarter segment (90° filled wedge from 12 o'clock to 3 o'clock) -->
  <path d="M256 256V48c114.9 0 208 93.1 208 208H256z" fill={color} />
</svg>

<style>
  svg {
    display: inline-block;
    vertical-align: middle;
    line-height: 1;
  }
</style>
