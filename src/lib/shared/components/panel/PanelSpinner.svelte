<script lang="ts">
  /**
   * PanelSpinner - Loading spinner component
   */

  interface Props {
    /** Optional size in pixels (default: 40) */
    size?: number;
  }

  let { size = 40 }: Props = $props();
</script>

<div
  class="panel-spinner"
  style:width="{size}px"
  style:height="{size}px"
  role="status"
  aria-label="Loading"
></div>

<style>
  .panel-spinner {
    border: 3px solid var(--theme-stroke);
    border-top-color: #06b6d4;
    border-radius: 50%;
    animation: panel-spin 0.8s linear infinite;
  }

  @keyframes panel-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel-spinner {
      animation: none;
      border-top-color: #06b6d4;
      border-right-color: #06b6d4;
    }
  }
</style>
