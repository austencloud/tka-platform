import { LOOPLabelerState } from "./loop-labeler-state.svelte";
import { LOOPLabelerServiceLocator } from "./loop-labeler-service-locator";
import { LOOPLabelerController } from "./loop-labeler-controller";

export const loopLabelerState = new LOOPLabelerState();
export const loopLabelerServices = new LOOPLabelerServiceLocator();
export const loopLabelerController = new LOOPLabelerController(
  loopLabelerState,
  loopLabelerServices
);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    import.meta.hot!.data.LOOPLabelerState = loopLabelerState.getHMRData();
  });
}
