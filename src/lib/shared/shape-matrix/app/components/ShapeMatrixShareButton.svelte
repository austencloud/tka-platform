<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixShareButton.svelte
  One link for the view on screen. The address bar already carries every
  setting (surface, level, both axis values, prop, the chosen pair and the
  notation), so sharing is copying it; what this adds is the choice of the
  notation the link opens in. A spinner raised on VTG ratios gets a link that
  reads in ratios from its first paint, whatever notation the sender was
  using, and the receiver can still switch in the header.

  The host supplies the trigger, so the button takes the header's own look;
  the popover and the copy belong here. The copy itself is the shared copy
  button, with its clipboard fallback and its copied state. -->
<script lang="ts">
  import { Popover } from "bits-ui";
  import type { Snippet } from "svelte";
  import CopyForAIButton from "$lib/shared/foundation/ui/CopyForAIButton.svelte";
  import type { MatrixLabelMode } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import { flyFade } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  interface Props {
    /** The button that opens the sheet; the host styles it as its own. */
    trigger: Snippet<[Record<string, unknown>, boolean]>;
  }
  let { trigger }: Props = $props();

  const appState = getShapeMatrixAppContext();
  const theory = $derived(appState.surface === "theory");

  /* The notation the link opens in. VTG ratios come first: the link exists
     for someone who reads the matrix that way. */
  const NOTATION_OPTIONS = [
    { value: "ratios" as const, label: "VTG ratios", shortLabel: "Ratios" },
    { value: "turns" as const, label: "TKA turns", shortLabel: "Turns" },
  ];

  let open = $state(false);
  let notation = $state<MatrixLabelMode>("ratios");

  /* Each opening starts from the notation on screen; the choice is made per
     link, not remembered as a setting. */
  $effect(() => {
    if (open) notation = appState.labelMode;
  });

  const carries = $derived(
    theory
      ? "The link carries both ratios, their pairing and spins, and the prop."
      : `The link carries Level ${appState.level}, both axis values, the prop, and the chosen pair.`
  );

  function shareUrl(): string {
    const link = appState.shareLink(notation);
    if (link === null) throw new Error("This host has no link to share.");
    return link;
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      {@render trigger(props, open)}
    {/snippet}
  </Popover.Trigger>

  <Popover.Portal>
    <Popover.Content
      side="bottom"
      align="end"
      sideOffset={6}
      avoidCollisions={true}
      collisionPadding={8}
      forceMount
    >
      {#snippet child({ open: contentOpen, wrapperProps, props })}
        <div {...wrapperProps}>
          {#if contentOpen}
            <div
              {...props}
              class="share-popover"
              role="dialog"
              aria-label="Share this view"
              transition:flyFade={{ y: -6, duration: DURATION.normal }}
            >
              <span class="popover-title">Share this view</span>
              {#if !theory}
                <div class="notation-row">
                  <span class="row-label">Opens in</span>
                  <SegmentedControl
                    options={NOTATION_OPTIONS}
                    value={notation}
                    onchange={(mode: MatrixLabelMode) => (notation = mode)}
                    size="sm"
                    density="tight"
                    color="accent"
                    semantics="radiogroup"
                    ariaLabel="Notation the link opens in"
                  />
                </div>
              {/if}
              <p class="carries">{carries}</p>
              <CopyForAIButton
                getData={shareUrl}
                ariaLabel="Copy link"
                idleIcon="fa-link"
                labels={{
                  idle: "Copy link",
                  loading: "Copying…",
                  success: "Copied",
                  error: "Copy failed",
                }}
                size="sm"
                fullWidth
              />
            </div>
          {/if}
        </div>
      {/snippet}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

<style>
  /* The same frame as the level-and-turn popover. */
  .share-popover {
    display: grid;
    width: max-content;
    max-width: min(
      22rem,
      var(--bits-popover-content-available-width, calc(100vw - 16px))
    );
    max-height: var(
      --bits-popover-content-available-height,
      calc(100dvh - 16px)
    );
    gap: 0.6rem;
    padding: 0.6rem 0.7rem 0.7rem;
    border: 1px solid var(--theme-stroke-strong, rgb(255 255 255 / 0.18));
    border-radius: 12px;
    background-color: var(--theme-bg-deep, #0a0f17);
    background-image: linear-gradient(
      var(--theme-panel-bg, #101721),
      var(--theme-panel-bg, #101721)
    );
    box-shadow: 0 16px 42px var(--theme-shadow, rgb(0 0 0 / 0.42));
    color: var(--theme-text, #fff);
    overflow: auto;
    overscroll-behavior: contain;
    outline: none;
    transform-origin: var(--bits-popover-content-transform-origin, top right);
    z-index: var(--z-dropdown, 1000);
  }

  .popover-title {
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
  }

  .notation-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .row-label {
    font-size: var(--font-size-min, 0.875rem);
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    white-space: nowrap;
  }

  .carries {
    margin: 0;
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.4;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
  }
</style>
