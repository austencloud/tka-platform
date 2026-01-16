<script lang="ts">
  /**
   * CircularIndicator.svelte
   *
   * Displays a golden star indicator in the top-right corner of the start position
   * pictograph when the sequence is circular-capable (can be autocompleted as a LOOP).
   *
   * This indicator:
   * - Shows that the sequence can be turned into a circular/LOOP pattern
   * - Appears in exported images (part of the SVG)
   * - Only renders on the start position (stepNumber === 0)
   * - Can be extended later to show different indicators for completed circular sequences
   */

  let { isCircularCapable = false, isStartPosition = false } = $props<{
    isCircularCapable?: boolean;
    isStartPosition?: boolean;
  }>();

  // Only show indicator on start position when circular-capable
  const shouldShow = $derived(isCircularCapable && isStartPosition);
</script>

{#if shouldShow}
  <g class="circular-indicator">
    <!-- Golden star indicator in top-right corner -->
    <g transform="translate(810, 140)">
      <!-- Subtle glow background -->
      <circle cx="0" cy="0" r="50" fill="url(#starGlow)" opacity="0.6" />

      <!-- Star shape (5-pointed) -->
      <path
        d="M 0,-40 L 9.5,-12 L 38,-12 L 15,6 L 24,34 L 0,16 L -24,34 L -15,6 L -38,-12 L -9.5,-12 Z"
        fill="url(#starGradient)"
        stroke="#d97706"
        stroke-width="2"
      />

      <!-- Sparkle effect -->
      <g opacity="0.9">
        <path
          d="M 0,-50 L 0,-44 M 0,50 L 0,44 M -50,0 L -44,0 M 50,0 L 44,0"
          stroke="var(--semantic-warning)"
          stroke-width="2"
          stroke-linecap="round"
        >
          <animate
            attributeName="opacity"
            values="0.5;1;0.5"
            dur="2s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </g>

    <!-- Gradient definitions -->
    <defs>
      <!-- Golden gradient for star -->
      <radialGradient id="starGradient" cx="30%" cy="30%">
        <stop
          offset="0%"
          style="stop-color:var(--semantic-warning);stop-opacity:1"
        />
        <stop
          offset="50%"
          style="stop-color:var(--semantic-warning);stop-opacity:1"
        />
        <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
      </radialGradient>

      <!-- Glow effect -->
      <radialGradient id="starGlow">
        <stop
          offset="0%"
          style="stop-color:var(--semantic-warning);stop-opacity:0.8"
        />
        <stop
          offset="100%"
          style="stop-color:var(--semantic-warning);stop-opacity:0"
        />
      </radialGradient>
    </defs>
  </g>
{/if}
