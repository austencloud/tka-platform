<script lang="ts">
  interface Props {
    category: "module" | "tab" | "capability";
  }

  let { category }: Props = $props();

  const config = $derived(
    {
      module: { icon: "fa-cubes", label: "module" },
      tab: { icon: "fa-window-restore", label: "tab" },
      capability: { icon: "fa-magic", label: "capability" },
    }[category]
  );
</script>

<div class="type-indicator {category}">
  <i class="fas {config.icon}" aria-hidden="true"></i>
  <span class="type-label">{config.label}</span>
</div>

<style>
  .type-indicator {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    font-weight: 600;
    font-size: var(--font-size-sm, 14px);
    letter-spacing: 0.5px;
    text-transform: uppercase;
    border: 1.5px solid;
  }

  @media (min-width: 480px) {
    .type-indicator {
      gap: 10px;
      padding: 12px 16px;
      font-size: var(--font-size-base, 16px);
    }
  }

  .type-indicator.module {
    background: color-mix(in srgb, #8b5cf6 15%, transparent);
    border-color: color-mix(in srgb, #8b5cf6 40%, transparent);
    color: #a78bfa;
  }

  .type-indicator.tab {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 12%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
    color: var(--semantic-info, #6366f1);
  }

  .type-indicator.capability {
    background: color-mix(in srgb, #f59e0b 12%, transparent);
    border-color: color-mix(in srgb, #f59e0b 40%, transparent);
    color: var(--semantic-warning, #f59e0b);
  }

  .type-indicator i {
    font-size: var(--font-size-base, 16px);
  }

  @media (min-width: 480px) {
    .type-indicator i {
      font-size: var(--font-size-lg, 18px);
    }
  }

  .type-label {
    font-weight: 700;
  }
</style>
