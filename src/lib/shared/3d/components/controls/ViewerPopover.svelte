<script lang="ts">
  import { Popover } from "bits-ui";
  import { getViewer3DContext, type PopoverId } from "../../context/viewer-3d-context";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";
  import type { Snippet } from "svelte";

  interface Props {
    id: PopoverId;
    title: string;
    accentColor?: string;
    width?: number;
    icon: string;
    tooltip: string;
    performerScoped?: boolean;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    id,
    title,
    accentColor,
    width = 420,
    icon,
    tooltip,
    performerScoped = false,
    children,
    footer,
  }: Props = $props();

  const viewer = getViewer3DContext();

  let popoverOpen = $state(false);

  $effect(() => {
    const shouldBeOpen = viewer.activePopover === id;
    if (popoverOpen !== shouldBeOpen) {
      popoverOpen = shouldBeOpen;
    }
  });

  function handleOpenChange(open: boolean) {
    if (open) {
      viewer.openPopover(id);
    } else if (viewer.activePopover === id) {
      viewer.closePopover();
    }
  }
</script>

<Popover.Root bind:open={popoverOpen} onOpenChange={handleOpenChange}>
  <Popover.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        class="rail-chip"
        class:performer-scoped={performerScoped}
        aria-label={tooltip}
        data-tooltip={tooltip}
        style:--chip-tint={accentColor}
      >
        <i class="fas {icon}"></i>
      </button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      side="left"
      sideOffset={10}
      align="start"
      avoidCollisions={true}
      collisionPadding={12}
      forceMount
      onInteractOutside={() => handleOpenChange(false)}
    >
      {#snippet child({ open, wrapperProps, props })}
        <div {...wrapperProps}>
          {#if open}
            <div
              {...props}
              class="viewer-popover-panel"
              style:--popover-width="{width}px"
              in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
              out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
            >
              <header class="pop-header">
                <span class="pop-title">{title}</span>
                {#if accentColor}
                  <span class="pop-badge" style:background={accentColor}></span>
                {/if}
              </header>
              <div class="pop-body">
                {@render children()}
              </div>
              {#if footer}
                <div class="pop-footer">
                  {@render footer()}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/snippet}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

<style>
  .viewer-popover-panel {
    width: var(--popover-width, 420px);
    border-radius: 18px;
    background: #0c0e16;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7);
    overflow: hidden;
  }
  .pop-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pop-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
  }
  .pop-badge {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pop-body {
    padding: 12px 14px 14px;
  }
  .pop-footer {
    padding: 10px 14px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
</style>
