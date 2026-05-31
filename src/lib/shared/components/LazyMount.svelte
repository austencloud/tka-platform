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
   *
   * `prefetch`: warm the chunk during browser idle WITHOUT mounting, so the
   * first `active` flip resolves an already-fetched-and-parsed module instantly
   * instead of paying the network + (in dev) on-demand-transform cost on click.
   * The same `import()` literal is reused, so Vite maps it to the correct hashed
   * chunk in production too (unlike modulepreload source-path hacks).
   */
  import type { Component } from "svelte";

  let {
    loader,
    active = false,
    prefetch = false,
    props = {},
  }: {
    /** Dynamic import of the component module. */
    loader: () => Promise<{ default: Component<any> }>;
    /** When this first becomes true, the chunk loads and mounts permanently. */
    active?: boolean;
    /** Warm the chunk on idle (no mount) so the first open is instant. */
    prefetch?: boolean;
    /** Props forwarded to the loaded component. */
    props?: Record<string, unknown>;
  } = $props();

  let Loaded = $state<Component<any> | null>(null);
  let started = false;
  // Single in-flight import shared by mount + prefetch, so warming the chunk
  // and the eventual mount never double-fetch.
  let modPromise: Promise<{ default: Component<any> }> | null = null;

  function load(): Promise<{ default: Component<any> }> {
    return (modPromise ??= loader());
  }

  $effect(() => {
    if (active && !started) {
      started = true;
      load()
        .then((m) => (Loaded = m.default))
        .catch((err) => console.error("[LazyMount] failed to load component", err));
    }
  });

  // Idle-warm the chunk ahead of first open. Skipped once anything has already
  // triggered the import (active flip or a prior prefetch tick).
  $effect(() => {
    if (!prefetch || modPromise || active) return;
    const schedule: (cb: () => void) => void =
      typeof requestIdleCallback !== "undefined"
        ? (cb) => requestIdleCallback(cb, { timeout: 2000 })
        : (cb) => setTimeout(cb, 200);
    schedule(() => {
      if (!modPromise) load().catch(() => { /* mount path will surface real errors */ });
    });
  });
</script>

{#if Loaded}
  <Loaded {...props} />
{/if}
