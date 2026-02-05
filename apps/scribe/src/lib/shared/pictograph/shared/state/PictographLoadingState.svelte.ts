/**
 * Pictograph Loading State
 *
 * Manages component loading tracking and error states.
 * Independent sub-state - tracks loading for both arrows and props.
 */

export interface PictographLoadingState {
  readonly isLoading: boolean;
  readonly isLoaded: boolean;
  readonly errorMessage: string | null;
  readonly loadedComponents: Set<string>;
  readonly allComponentsLoaded: boolean;
  handleComponentLoaded(componentName: string): void;
  handleComponentError(componentName: string, error: string): void;
  clearLoadingState(): void;
  setError(error: string): void;
  clearError(): void;
}

export function createPictographLoadingState(
  requiredComponentsGetter: () => string[],
  hasValidDataGetter: () => boolean
): PictographLoadingState {
  // Component loading state
  let errorMessage = $state<string | null>(null);
  let loadedComponents = $state(new Set<string>());

  // Derived loading states
  const allComponentsLoaded = $derived.by(() => {
    const required = requiredComponentsGetter();
    return required.every((component: string) =>
      loadedComponents.has(component)
    );
  });

  const isLoading = $derived.by(() => {
    return hasValidDataGetter() && !allComponentsLoaded;
  });

  const isLoaded = $derived.by(() => {
    return hasValidDataGetter() && allComponentsLoaded;
  });

  function handleComponentLoaded(componentName: string): void {
    loadedComponents.add(componentName);
    loadedComponents = new Set(loadedComponents); // Trigger reactivity
  }

  function handleComponentError(componentName: string, error: string): void {
    console.error(`❌ Component ${componentName} failed to load:`, error);
    errorMessage = `Failed to load ${componentName}: ${error}`;
  }

  function clearLoadingState(): void {
    errorMessage = null;
    loadedComponents.clear();
    loadedComponents = new Set(); // Trigger reactivity
  }

  function setError(error: string): void {
    errorMessage = error;
  }

  function clearError(): void {
    errorMessage = null;
  }

  return {
    get isLoading() {
      return isLoading;
    },
    get isLoaded() {
      return isLoaded;
    },
    get errorMessage() {
      return errorMessage;
    },
    get loadedComponents() {
      return loadedComponents;
    },
    get allComponentsLoaded() {
      return allComponentsLoaded;
    },
    handleComponentLoaded,
    handleComponentError,
    clearLoadingState,
    setError,
    clearError,
  };
}
