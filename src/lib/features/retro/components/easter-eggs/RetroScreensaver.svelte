<!--
  RetroScreensaver — Flying Props screensaver for TKA-OS v1.0

  Bouncing emoji props on a black screen, DVD logo style. Each prop
  has random starting position, velocity, and size. Click anywhere
  or press any key to dismiss.

  Domain: Retro Easter Eggs
-->
<script lang="ts">
  let {
    ondismiss,
  }: {
    ondismiss?: () => void;
  } = $props();

  /* ------------------------------------------------------------------ */
  /* Prop emojis                                                         */
  /* ------------------------------------------------------------------ */

  const PROP_EMOJIS: string[] = ["\u{1F3D1}", "\u2694\uFE0F", "\u{1FAAD}", "\u{1F525}", "\u2600\uFE0F", "\u{1F300}", "\u{1F4AB}", "\u{1F3AD}"];

  /* ------------------------------------------------------------------ */
  /* Types                                                               */
  /* ------------------------------------------------------------------ */

  interface FloatingProp {
    emoji: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
  }

  /* ------------------------------------------------------------------ */
  /* Initialize floating items with random state                         */
  /* ------------------------------------------------------------------ */

  function randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function randomVelocity(): number {
    const speed = randomBetween(1, 3);
    return Math.random() > 0.5 ? speed : -speed;
  }

  const floatingCount = Math.floor(randomBetween(5, 9));

  let floaters = $state<FloatingProp[]>(
    Array.from({ length: floatingCount }, (_, i) => ({
      emoji: PROP_EMOJIS[i % PROP_EMOJIS.length]!,
      x: Math.random() * 80 + 5,   /* % of container */
      y: Math.random() * 80 + 5,
      vx: randomVelocity(),
      vy: randomVelocity(),
      size: Math.floor(randomBetween(24, 49)),
    }))
  );

  /* ------------------------------------------------------------------ */
  /* Animation loop                                                      */
  /* ------------------------------------------------------------------ */

  let containerEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!containerEl) return;

    let frameId: number;

    function animate() {
      if (!containerEl) return;

      const rect = containerEl.getBoundingClientRect();
      const containerW = rect.width;
      const containerH = rect.height;

      for (const p of floaters) {
        /* Convert percentage position to pixels for boundary check */
        const pxX = (p.x / 100) * containerW;
        const pxY = (p.y / 100) * containerH;

        /* Move in pixel space */
        const newPxX = pxX + p.vx;
        const newPxY = pxY + p.vy;

        /* Bounce off edges */
        if (newPxX <= 0 || newPxX + p.size >= containerW) {
          p.vx = -p.vx;
        }
        if (newPxY <= 0 || newPxY + p.size >= containerH) {
          p.vy = -p.vy;
        }

        /* Update percentage position */
        p.x = ((pxX + p.vx) / containerW) * 100;
        p.y = ((pxY + p.vy) / containerH) * 100;

        /* Clamp to bounds */
        p.x = Math.max(0, Math.min(p.x, 100 - (p.size / containerW) * 100));
        p.y = Math.max(0, Math.min(p.y, 100 - (p.size / containerH) * 100));
      }

      frameId = requestAnimationFrame(animate);
    }

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  });

  /* ------------------------------------------------------------------ */
  /* Dismiss handlers                                                    */
  /* ------------------------------------------------------------------ */

  function dismiss() {
    ondismiss?.();
  }

  $effect(() => {
    function handleKeydown() {
      dismiss();
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="screensaver"
  bind:this={containerEl}
  onclick={dismiss}
  role="presentation"
>
  {#each floaters as floater, i (i)}
    <span
      class="floating-prop"
      style="
        left: {floater.x}%;
        top: {floater.y}%;
        font-size: {floater.size}px;
      "
      aria-hidden="true"
    >
      {floater.emoji}
    </span>
  {/each}
</div>

<style>
  /* ------------------------------------------------------------------ */
  /* Fullscreen black background                                         */
  /* ------------------------------------------------------------------ */
  .screensaver {
    position: fixed;
    inset: 0;
    z-index: 9500;
    background: #000;
    cursor: none;
    overflow: hidden;
  }

  /* ------------------------------------------------------------------ */
  /* Floating prop emoji                                                 */
  /* ------------------------------------------------------------------ */
  .floating-prop {
    position: absolute;
    line-height: 1;
    pointer-events: none;
    user-select: none;
    will-change: left, top;
  }

  /* ------------------------------------------------------------------ */
  /* Reduced motion: freeze props in place                               */
  /* ------------------------------------------------------------------ */
  @media (prefers-reduced-motion: reduce) {
    .floating-prop {
      animation: none;
    }
  }
</style>
