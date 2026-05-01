import { LOOPLabelerState } from "./loop-labeler-state.svelte";
import { LOOPLabelerServiceLocator } from "./LOOPLabelerServiceLocator";
import { LOOPLabelerController } from "./LOOPLabelerController";

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
