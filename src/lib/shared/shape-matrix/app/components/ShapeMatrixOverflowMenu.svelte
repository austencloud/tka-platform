<script lang="ts">
  import { DropdownMenu } from "bits-ui";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { getPropTypeDisplayInfo } from "$lib/shared/settings/components/tabs/prop-type/prop-type-registry";

  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  const ORIGINAL_MATRIX_URL =
    "http://spinscience.xyz/2014/07/10/144-shape-matrix-even-petaled-flowers-rework/";

  const appState = getShapeMatrixAppContext();
  const selectedProp = $derived(getPropTypeDisplayInfo(appState.propType));
  let open = $state(false);

  function asButtonAttributes(props: unknown): HTMLButtonAttributes {
    return props as HTMLButtonAttributes;
  }

  function chooseProp(): void {
    appState.openPropPicker();
  }

  function openAbout(): void {
    appState.openAbout();
  }

  function openOriginal(): void {
    const original = window.open(
      ORIGINAL_MATRIX_URL,
      "_blank",
      "noopener,noreferrer"
    );
    if (original) original.opener = null;
  }
</script>

<DropdownMenu.Root {open} onOpenChange={(nextOpen) => (open = nextOpen)}>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      {@const triggerProps = asButtonAttributes(props)}
      <button
        {...triggerProps}
        type="button"
        class="overflow-trigger"
        aria-label="More Shape Matrix options"
      >
        <i class="fas fa-ellipsis-vertical" aria-hidden="true"></i>
      </button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Portal>
    <DropdownMenu.Content
      side="bottom"
      align="end"
      sideOffset={8}
      collisionPadding={12}
      class="shape-matrix-overflow"
      aria-label="Shape Matrix options"
    >
      <DropdownMenu.Item
        class="shape-matrix-overflow-item"
        textValue={`Choose prop. Current prop: ${selectedProp.label}`}
        onSelect={chooseProp}
      >
        <img class="prop-icon" src={selectedProp.image} alt="" />
        <span class="item-copy">
          <span>Choose prop</span>
          <small>{selectedProp.label}</small>
        </span>
      </DropdownMenu.Item>
      <DropdownMenu.Separator class="shape-matrix-overflow-divider" />
      <DropdownMenu.Item
        class="shape-matrix-overflow-item"
        textValue="View Lorq Nichols' original Shape Matrix"
        onSelect={openOriginal}
      >
        <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
        <span>Original Shape Matrix</span>
      </DropdownMenu.Item>
      <DropdownMenu.Item
        class="shape-matrix-overflow-item"
        textValue="About Shape Matrix Explorer"
        onSelect={openAbout}
      >
        <i class="fas fa-circle-info" aria-hidden="true"></i>
        <span>About this explorer</span>
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

<style>
  .overflow-trigger {
    display: grid;
    place-items: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    padding: 0;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 10px;
    background: var(--theme-card-bg, rgb(255 255 255 / 0.05));
    color: var(--theme-text-dim, rgb(255 255 255 / 0.72));
    cursor: pointer;
    font: inherit;
    transition:
      color var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease;
  }

  .overflow-trigger:hover {
    border-color: var(--theme-stroke-strong, rgb(255 255 255 / 0.2));
    background: var(--theme-card-hover-bg, rgb(255 255 255 / 0.08));
    color: var(--theme-text, #fff);
  }

  .overflow-trigger:focus-visible {
    outline: 2px solid #f59e0b;
    outline-offset: 2px;
  }

  :global(.shape-matrix-overflow) {
    z-index: var(--z-dropdown, 1000);
    width: min(17rem, calc(100vw - 24px));
    padding: 4px;
    border: 1px solid var(--theme-stroke-strong, rgb(255 255 255 / 0.18));
    border-radius: 12px;
    background-color: var(--theme-bg-deep, #0a0f17);
    background-image: linear-gradient(
      var(--theme-panel-bg, #101721),
      var(--theme-panel-bg, #101721)
    );
    box-shadow: 0 16px 42px rgb(0 0 0 / 0.42);
    outline: none;
    transform-origin: var(--bits-dropdown-menu-content-transform-origin);
  }

  :global(.shape-matrix-overflow[data-state="open"]) {
    animation: menu-in 150ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  :global(.shape-matrix-overflow-item) {
    box-sizing: border-box;
    display: flex;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    align-items: center;
    gap: 0.7rem;
    padding: 0.45rem 0.7rem;
    border-radius: 8px;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.72));
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    outline: none;
    user-select: none;
  }

  :global(.shape-matrix-overflow-item[data-highlighted]) {
    background: var(--theme-card-hover-bg, rgb(255 255 255 / 0.08));
    color: var(--theme-text, #fff);
  }

  :global(.shape-matrix-overflow-item > i),
  :global(.shape-matrix-overflow-item > .prop-icon) {
    width: 1.4rem;
    height: 1.4rem;
    flex: 0 0 1.4rem;
    object-fit: contain;
    text-align: center;
  }

  :global(.shape-matrix-overflow-item > i) {
    height: auto;
    color: #f4b54c;
  }

  :global(.shape-matrix-overflow-item .item-copy) {
    display: grid;
    min-width: 0;
    gap: 0.05rem;
  }

  :global(.shape-matrix-overflow-item .item-copy small) {
    overflow: hidden;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    font-size: var(--font-size-compact, 12px);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.shape-matrix-overflow-divider) {
    height: 1px;
    margin: 4px 8px;
    background: var(--theme-stroke, rgb(255 255 255 / 0.1));
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .overflow-trigger {
      transition: none;
    }

    :global(.shape-matrix-overflow[data-state="open"]) {
      animation: none;
    }
  }
</style>
