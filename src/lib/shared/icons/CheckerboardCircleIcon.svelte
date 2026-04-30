<script lang="ts">
  let { size = "1em", color = "currentColor" } = $props<{ size?: string; color?: string }>();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 512 512"
  width={size}
  height={size}
  aria-hidden="true"
  role="img"
>
  <path
    d="M256 0C397.4 0 512 114.6 512 256C512 397.4 397.4 512 256 512C114.6 512 0 397.4 0 256C0 114.6 114.6 0 256 0ZM256 64C150 64 64 150 64 256C64 362 150 448 256 448C362 448 448 362 448 256C448 150 362 64 256 64ZM256 256L256 64C362 64 448 150 448 256ZM256 256L256 448C150 448 64 362 64 256Z"
    fill={color}
  />
</svg>

<style>
  svg {
    display: inline-block;
    vertical-align: middle;
    line-height: 1;
  }
</style>
