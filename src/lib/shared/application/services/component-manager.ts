/**
 * Loading state tracking and coordination for all sub-components
 * within complex UI components like Pictograph.
 */

import type { PictographData } from "../../pictograph/shared/domain/models/pictograph-data";
import { MotionColor as MotionColorEnum } from "../../pictograph/shared/domain/enums/pictograph-enums";

export interface ComponentLoadingState {
  loadingStates: Record<string, boolean>;
  isLoading: boolean;
  loadingComponents: string[];
  loadedComponents: string[];
}

export function getRequiredComponents(data: PictographData | null): string[] {
  const components = ["grid"];
  if (!data?.motions) return components;

  const motions = data.motions;
  if (motions[MotionColorEnum.BLUE]?.isVisible) components.push("prop-blue");
  if (motions[MotionColorEnum.RED]?.isVisible) components.push("prop-red");

  return components;
}

export function createLoadingState(components: string[]): ComponentLoadingState {
  const loadingStates: Record<string, boolean> = {};
  components.forEach((component) => {
    loadingStates[component] = true;
  });

  return {
    loadingStates,
    isLoading: components.length > 0,
    loadingComponents: [...components],
    loadedComponents: [],
  };
}

export function updateComponentLoadingState(
  state: ComponentLoadingState,
  componentName: string,
  isLoading: boolean,
): ComponentLoadingState {
  const newLoadingStates = { ...state.loadingStates };
  newLoadingStates[componentName] = isLoading;

  const loadingComponents = Object.entries(newLoadingStates)
    .filter(([_, loading]) => loading)
    .map(([name]) => name);

  const loadedComponents = Object.entries(newLoadingStates)
    .filter(([_, loading]) => !loading)
    .map(([name]) => name);

  return {
    loadingStates: newLoadingStates,
    isLoading: loadingComponents.length > 0,
    loadingComponents,
    loadedComponents,
  };
}

export function areAllComponentsLoaded(state: ComponentLoadingState): boolean {
  return !state.isLoading;
}

export function getLoadingProgress(state: ComponentLoadingState): number {
  const totalComponents = Object.keys(state.loadingStates).length;
  if (totalComponents === 0) return 100;
  return Math.round((state.loadedComponents.length / totalComponents) * 100);
}

export function clearLoadingState(state: ComponentLoadingState): ComponentLoadingState {
  const clearedStates: Record<string, boolean> = {};
  Object.keys(state.loadingStates).forEach((component) => {
    clearedStates[component] = false;
  });

  return {
    loadingStates: clearedStates,
    isLoading: false,
    loadingComponents: [],
    loadedComponents: Object.keys(clearedStates),
  };
}
