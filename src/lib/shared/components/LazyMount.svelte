<script lang="ts">
  /**
   * LazyMount
   *
   * Defers a component's chunk (and its whole static import subtree) out of the
   * parent's eager graph. The component is dynamically imported the first time
   * `active` flips true, then stays mounted (keep-alive) so exit animations and
   * subsequent opens behave exactly as if it had always been there.
   *
   * Use for action-driven hosts — drawers, editors, dialogs — that render
   * nothing until a trigger fires but were previously imported statically,
   * dragging their dependency tree into first paint.
   *
   *   <LazyMount loader={() => import("./HeavyDrawer.svelte")} active={isOpen} />
   *
   * The loaded component reads its own open state (props or context); LazyMount
   * only governs WHEN its code is fetched, never its visibility.
   *
   * Context flows normally: LazyMount sits in the parent's component tree, so a
   * child mounted here resolves getContext() up through the parent.
   */
  import type { Component } from "svelte";

  let {
    loader,
    active = false,
    props = {},
  }: {
    /** Dynamic import of the component module. */
    loader: () => Promise<{ default: Component<any> }>;
    /** When this first becomes true, the chunk loads and mounts permanently. */
    active?: boolean;
    /** Props forwarded to the loaded component. */
    props?: Record<string, unknown>;
  } = $props();

  let Loaded = $state<Component<any> | null>(null);
  let started = false;

  $effect(() => {
    if (active && !started) {
      started = true;
      loader()
        .then((m) => (Loaded = m.default))
        .catch((err) => console.error("[LazyMount] failed to load component", err));
    }
  });
</script>

{#if Loaded}
  <Loaded {...props} />
{/if}
