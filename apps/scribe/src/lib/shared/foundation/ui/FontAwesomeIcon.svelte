<!--
FontAwesomeIcon.svelte - Reusable Font Awesome icon component
Renders Font Awesome icons with customizable size, color, and style
-->
<script lang="ts">
  let {
    icon,
    style = "solid",
    size = "1em",
    color,
    class: className = "",
    title,
    ariaLabel,
    ariaHidden = false,
  } = $props<{
    icon: string;
    style?: "solid" | "regular" | "brands";
    size?: string;
    color?: string;
    class?: string;
    title?: string;
    ariaLabel?: string;
    ariaHidden?: boolean;
  }>();

  // Map style to Font Awesome class
  const styleClass = $derived.by(() => {
    switch (style) {
      case "regular":
        return "far";
      case "brands":
        return "fab";
      case "solid":
      default:
        return "fas";
    }
  });

  // Build the full icon class
  const iconClass = $derived(`${styleClass} fa-${icon} ${className}`.trim());
</script>

<i
  class={iconClass}
  style:font-size={size}
  style:color
  {title}
  aria-label={ariaLabel}
  aria-hidden={ariaHidden}
></i>

<style>
  i {
    display: inline-block;
    line-height: 1;
  }
</style>
