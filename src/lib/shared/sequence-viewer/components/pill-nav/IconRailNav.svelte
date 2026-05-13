<script lang="ts">
  import type { PillId, PillSpec } from "./pill-types";

  let {
    pills,
    activeId,
    onSelect,
    onNavMount,
  }: {
    pills: PillSpec[];
    activeId: PillId | null;
    onSelect: (id: PillId) => void;
    onNavMount?: (el: HTMLElement | null) => void;
  } = $props();

  let navEl: HTMLElement | undefined = $state();

  $effect(() => {
    onNavMount?.(navEl ?? null);
    return () => onNavMount?.(null);
  });

  function focusPillAt(index: number) {
    const wrapped = ((index % pills.length) + pills.length) % pills.length;
    const pill = pills[wrapped];
    if (!pill) return;
    const target = navEl?.querySelector<HTMLButtonElement>(
      `[data-pill-id="${pill.id}"]`
    );
    target?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.currentTarget as HTMLButtonElement;
    const currentIndex = pills.findIndex((p) => p.id === target.dataset.pillId);
    if (currentIndex === -1) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusPillAt(currentIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusPillAt(currentIndex - 1);
        break;
      case "Home":
        e.preventDefault();
        focusPillAt(0);
        break;
      case "End":
        e.preventDefault();
        focusPillAt(pills.length - 1);
        break;
      case " ":
      case "Enter": {
        e.preventDefault();
        const pill = pills[currentIndex];
        if (pill) onSelect(pill.id);
        break;
      }
    }
  }
</script>

<nav
  class="icon-rail"
  role="tablist"
  aria-orientation="vertical"
  aria-label="Editor sections"
  bind:this={navEl}
>
  {#each pills as pill (pill.id)}
    <button
      type="button"
      role="tab"
      class="rail-btn"
      data-pill-id={pill.id}
      aria-selected={activeId === pill.id}
      aria-label={pill.label}
      title="{pill.label}{pill.summary ? ` — ${pill.summary}` : ''}"
      style:--pill-accent={pill.accentColor ?? null}
      onclick={() => onSelect(pill.id)}
      onkeydown={handleKeydown}
    >
      {#if pill.icon}
        <i class="fas {pill.icon}" aria-hidden="true"></i>
      {:else}
        <span
          class="effort-dot"
          style:background={pill.accentColor ?? "#94a3b8"}
        ></span>
      {/if}
    </button>
  {/each}
</nav>

<style>
  .icon-rail {
    width: 44px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.02);
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 0;
    gap: 2px;
  }

  .rail-btn {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    background: none;
    border: none;
    border-left: 2px solid transparent;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .rail-btn:hover:not([aria-selected="true"]) {
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.8);
  }

  .rail-btn:focus-visible {
    outline: 2px solid var(--pill-focus, #4a9eff);
    outline-offset: -2px;
  }

  .rail-btn[aria-selected="true"] {
    background: color-mix(in srgb, var(--pill-accent, #8b5cf6) 15%, transparent);
    border-left-color: color-mix(in srgb, var(--pill-accent, #a855f7) 100%, transparent);
    color: color-mix(in srgb, var(--pill-accent, #d4b4ff) 100%, white);
  }

  .effort-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  @media (prefers-reduced-motion: reduce) {
    .rail-btn {
      transition: none;
    }
  }

  @media (prefers-contrast: more) {
    .rail-btn {
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .rail-btn[aria-selected="true"] {
      background: #1a1a2e;
      border-color: white;
      color: white;
    }
  }
</style>
