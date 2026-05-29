/**
 * Keep-Alive Controller
 *
 * Tracks which modules stay mounted across module switches, which one is
 * currently visible, and per-module idle-eviction timers. Pure logic — no
 * Svelte runes — so it is fully unit-testable with fake timers. Consumers
 * subscribe via `onChange` and read state through the getters.
 *
 * A "keep-alive" module is mounted on first activation and stays mounted
 * (hidden) when the user navigates away, until an idle timeout evicts it.
 */

export interface KeepAliveControllerOptions {
  /** Idle time (ms) a hidden keep-alive module survives before eviction. */
  evictMs?: number;
  /** Called after any state transition (mount, show, hide, evict). */
  onChange?: () => void;
}

export interface KeepAliveController {
  isKeepAlive(moduleId: string): boolean;
  isMounted(moduleId: string): boolean;
  isVisible(moduleId: string): boolean;
  /** List of currently-mounted keep-alive module ids. */
  mountedModules(): string[];
  /** Notify the controller which module is now active (null = none). */
  setActiveModule(moduleId: string | null): void;
  /** Stop all pending evict timers. Does not unmount anything. */
  dispose(): void;
}

const DEFAULT_EVICT_MS = 150_000;

export function createKeepAliveController(
  keepAliveIds: Iterable<string>,
  options: KeepAliveControllerOptions = {},
): KeepAliveController {
  const keepAlive = new Set(keepAliveIds);
  const evictMs = options.evictMs ?? DEFAULT_EVICT_MS;
  const onChange = options.onChange;

  const mounted = new Set<string>();
  const evictTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let visibleModule: string | null = null;

  function cancelEvict(id: string): void {
    const t = evictTimers.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      evictTimers.delete(id);
    }
  }

  function startEvict(id: string): void {
    cancelEvict(id);
    evictTimers.set(
      id,
      setTimeout(() => {
        evictTimers.delete(id);
        mounted.delete(id);
        onChange?.();
      }, evictMs),
    );
  }

  function setActiveModule(id: string | null): void {
    if (id === visibleModule) return; // no-op, no churn

    const previous = visibleModule;
    visibleModule = id;

    if (previous && keepAlive.has(previous) && mounted.has(previous)) {
      startEvict(previous);
    }
    if (id && keepAlive.has(id)) {
      mounted.add(id);
      cancelEvict(id);
    }
    onChange?.();
  }

  return {
    isKeepAlive: (id) => keepAlive.has(id),
    isMounted: (id) => mounted.has(id),
    isVisible: (id) => keepAlive.has(id) && visibleModule === id,
    mountedModules: () => [...mounted],
    setActiveModule,
    dispose: () => {
      for (const t of evictTimers.values()) clearTimeout(t);
      evictTimers.clear();
    },
  };
}
