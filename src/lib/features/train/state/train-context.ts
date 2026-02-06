import { getContext, setContext } from "svelte";
import { createTrainState, type TrainState } from "./train-state.svelte";

const TRAIN_STATE_KEY = Symbol("train-state");

export function setTrainState(state: TrainState) {
  setContext(TRAIN_STATE_KEY, state);
}

export function getTrainState(): TrainState {
  return getContext(TRAIN_STATE_KEY);
}

export function initTrainState(
  config?: Parameters<typeof createTrainState>[0]
) {
  const state = createTrainState(config);
  setTrainState(state);
  return state;
}
