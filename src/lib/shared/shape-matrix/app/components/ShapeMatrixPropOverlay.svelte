<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixPropOverlay.svelte
  The prop catalogue, over the grid pane. You are not changing your shape
  while you change your prop, so the grid is the one region that can be
  covered without losing anything you are watching: the animation, the
  element relationships, the carousel and the dock all stay where they are,
  and the prop is judged against the live shape as it is chosen. That is why
  the catalogue is not a sheet over the whole app on wide hosts.

  Wide hosts only. Compact hosts show one pane at a time, so this pane is off
  screen while the dock is; the shell opens the canonical prop sheet there.

  A non-modal dialog: the title and close button say what it is and how it
  goes away, Escape closes it from anywhere through the shared layer manager,
  and a click elsewhere in the app closes it the way a popover would. The
  Props pill is the one exception to click-away, since it toggles on its own.
  Choosing keeps it open, so props can be compared against the shape. -->
<script lang="ts">
  import { tick } from "svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import { getEscapeLayerManager } from "$lib/shared/keyboard/get-escape-layer-manager";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import { flyFade } from "$lib/shared/transitions/motion";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  interface Props {
    /* Both surfaces stay mounted through the workspace transition, so the
       one that is showing owns the catalogue. The other stays empty rather
       than registering a second Escape layer and click-away listener. */
    surface: "matrix" | "theory";
  }

  let { surface }: Props = $props();

  const appState = getShapeMatrixAppContext();
  const open = $derived(
    appState.propPickerOpen && !appState.compact && appState.surface === surface
  );

  let overlayElement = $state<HTMLElement | null>(null);

  function close(): void {
    appState.closePropPicker();
  }

  function onKeydown(event: KeyboardEvent): void {
    // Focus inside a non-modal dialog owns the first Escape; the global
    // shortcut defers to it, so it is answered here.
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  function onPointerDownAnywhere(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !overlayElement) return;
    if (overlayElement.contains(target)) return;
    // A family's style chooser is a portal outside the app root. Choosing a
    // style there, or dismissing it, is not a click away from the catalogue.
    if (!target.closest("[data-shape-matrix-app]")) return;
    // The Props pill toggles the catalogue itself.
    if (target.closest("[data-shape-matrix-dock]")) return;
    close();
  }

  $effect(() => {
    if (!open) return;

    const restoreTo = document.activeElement;
    const unregister = getEscapeLayerManager().register({
      id: "shape-matrix:prop-overlay",
      canDismiss: () => true,
      dismiss: close,
    });
    document.addEventListener("pointerdown", onPointerDownAnywhere, true);

    void tick().then(() => {
      overlayElement
        ?.querySelector<HTMLButtonElement>("header button")
        ?.focus({ preventScroll: true });
    });

    return () => {
      unregister();
      document.removeEventListener("pointerdown", onPointerDownAnywhere, true);
      if (restoreTo instanceof HTMLElement && restoreTo.isConnected) {
        restoreTo.focus({ preventScroll: true });
      }
    };
  });
</script>

{#if open}
  <div
    class="prop-overlay"
    role="dialog"
    aria-label="Prop"
    bind:this={overlayElement}
    onkeydown={onKeydown}
    transition:flyFade={{ y: 8 }}
  >
    <DrawerHeader
      title="Prop"
      subtitle="The animation follows each choice. Open a family for its styles."
      closeLabel="Close prop picker"
      onClose={close}
    />
    <div class="overlay-body">
      <BentoPropGrid
        selectedPropType={appState.propType}
        variant="inline"
        scrollMode="host"
        onSelect={(next: PropType) => void appState.setPropType(next)}
      />
    </div>
  </div>
{/if}

<style>
  .prop-overlay {
    position: absolute;
    inset: 0;
    /* Above the grid's sticky headers and corner. */
    z-index: 20;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    /* The panel token is a matte with a little transparency, meant to sit on
       the page background. Stacked three deep it is opaque to the grid under
       it while still taking the theme's colour. */
    background:
      linear-gradient(var(--theme-panel-bg, #101721), var(--theme-panel-bg, #101721)),
      linear-gradient(var(--theme-panel-bg, #101721), var(--theme-panel-bg, #101721)),
      var(--theme-panel-bg, #101721);
    color: var(--theme-text, #fff);
  }

  .overlay-body {
    min-width: 0;
    min-height: 0;
    padding: 0.5rem 0.9rem 0.9rem;
    /* The grid scrolls in here when the pane is shorter than the catalogue. */
    overflow: hidden auto;
  }
</style>
