export function createViewerInspectorHostState() {
  let target = $state<HTMLElement | null>(null);

  return {
    get target() {
      return target;
    },
    setTarget(next: HTMLElement | null): void {
      target = next;
    },
  };
}

export type ViewerInspectorHostState = ReturnType<
  typeof createViewerInspectorHostState
>;
