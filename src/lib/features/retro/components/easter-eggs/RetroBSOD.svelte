<!--
  RetroBSOD — Full-screen Blue Screen of Death easter egg

  Displays a classic Windows 95-style BSOD with TKA-themed error messages.
  Renders above everything (z-index 10000, above CRT overlay at 9999).
  Any keypress or click dismisses the screen via ondismiss callback.

  Domain: Retro Easter Eggs
-->
<script lang="ts">
  let {
    ondismiss,
  }: {
    ondismiss?: () => void;
  } = $props();

  let containerEl: HTMLDivElement | undefined = $state(undefined);

  /** Auto-focus so keydown events register immediately. */
  $effect(() => {
    if (containerEl) {
      containerEl.focus();
    }
  });

  function handleDismiss() {
    ondismiss?.();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="bsod"
  bind:this={containerEl}
  tabindex="0"
  onkeydown={handleDismiss}
  onclick={handleDismiss}
  role="alert"
  aria-label="Blue screen error"
>
  <div class="bsod-content">
    <p class="bsod-header">TKA-OS v1.0</p>

    <p class="bsod-body">
      A fatal exception KE has occurred at 0028:C0011995 in VXD SPIN.386 +
      00004E2A. The current operation will be terminated.
    </p>

    <p class="bsod-body bsod-indented">
      *&nbsp;&nbsp;Press any key to return to TKA-OS. &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;*
    </p>
    <p class="bsod-body bsod-indented">
      *&nbsp;&nbsp;Press CTRL+ALT+DEL to restart your computer. You will &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; *
    </p>
    <p class="bsod-body bsod-indented">
      *&nbsp;&nbsp;lose any unsaved sequences. &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;*
    </p>

    <p class="bsod-body bsod-spacer">
      KINETIC_OVERFLOW — Too much spin detected.
    </p>
    <p class="bsod-body">
      The prop physics engine has exceeded maximum angular velocity.
    </p>

    <p class="bsod-body bsod-spacer">Error code: 0xDEADBEAT</p>

    <p class="bsod-body bsod-spacer">
      Press any key to continue <span class="bsod-cursor">_</span>
    </p>
  </div>
</div>

<style>
  .bsod {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: #000080;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
    outline: none;
  }

  .bsod-content {
    max-width: 680px;
    padding: 32px;
    text-align: center;
  }

  .bsod-header {
    font-family: "Courier New", Courier, monospace;
    font-size: 16px;
    font-weight: bold;
    color: #ffffff;
    margin: 0 0 24px;
  }

  .bsod-body {
    font-family: "Courier New", Courier, monospace;
    font-size: 14px;
    color: #ffffff;
    margin: 0;
    line-height: 1.6;
    text-align: left;
    white-space: pre-wrap;
  }

  .bsod-indented {
    text-align: left;
  }

  .bsod-spacer {
    margin-top: 16px;
  }

  .bsod-cursor {
    animation: bsod-blink 1s step-end infinite;
  }

  @keyframes bsod-blink {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bsod-cursor {
      animation: none;
    }
  }
</style>
