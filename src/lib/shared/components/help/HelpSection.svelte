<!--
  HelpSection.svelte

  Reusable section card for help modals.
  Consistent styling for help content blocks.

  Usage:
  <HelpSection icon="fa-redo" title="Turns">
    <p>Controls how many rotations...</p>
    <ul>
      <li><strong>fl</strong> - Float</li>
    </ul>
  </HelpSection>

  <HelpSection icon="fa-lightbulb" title="Tip" variant="tip">
    <p>Helpful tip goes here</p>
  </HelpSection>
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    icon: string;
    title: string;
    variant?: "default" | "tip";
    accentColor?: string;
    children: Snippet;
  }

  let {
    icon,
    title,
    variant = "default",
    accentColor = "var(--semantic-info, #3b82f6)",
    children,
  }: Props = $props();
</script>

<section
  class="help-section"
  class:tip={variant === "tip"}
  style:--accent-color={accentColor}
>
  <h3>
    <i class="fas {icon}" class:glow={variant === "tip"} aria-hidden="true"></i>
    {title}
  </h3>
  <div class="content">
    {@render children()}
  </div>
</section>

<style>
  .help-section {
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .help-section.tip {
    background: var(--semantic-success-dim, rgba(34, 197, 94, 0.15));
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 25%, transparent);
  }

  h3 {
    margin: 0 0 8px 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  h3 i {
    font-size: 1rem;
    opacity: 0.8;
    color: var(--accent-color);
  }

  /* Tip variant gets semantic success color and glow */
  .help-section.tip h3 i {
    color: var(--semantic-success, #22c55e);
  }

  h3 i.glow {
    animation: lightbulbGlow 2s ease-in-out 0.5s infinite;
  }

  @keyframes lightbulbGlow {
    0%,
    100% {
      filter: drop-shadow(0 0 2px color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent));
    }
    50% {
      filter: drop-shadow(0 0 8px color-mix(in srgb, var(--semantic-success, #22c55e) 60%, transparent));
    }
  }

  .content {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.8));
    line-height: 1.6;
  }

  .content :global(p) {
    margin: 0 0 8px 0;
  }

  .content :global(p:last-child) {
    margin-bottom: 0;
  }

  .content :global(ul) {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .content :global(li) {
    position: relative;
    padding-left: 16px;
    margin-bottom: 6px;
    line-height: 1.5;
  }

  .content :global(li:last-child) {
    margin-bottom: 0;
  }

  /* Colored bullet points */
  .content :global(li)::before {
    content: "";
    position: absolute;
    left: 0;
    top: 8px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-color);
  }

  .content :global(strong) {
    color: var(--theme-text);
    font-weight: 600;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    h3 i.glow {
      animation: none;
      filter: none;
    }
  }
</style>
