<!--
  HeyTikaListener

  Invisible component that orchestrates the "Hey Tika" voice control pipeline.
  Mounts the WakeWordDetector, pipes commands through the CommandInterpreter
  and CommandDispatcher, and logs results to the console.

  Phase 1: Hardcoded ON for development. Phase 5 adds user settings toggle.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "../../di";
  import type { IWakeWordDetector } from "../services/contracts/IWakeWordDetector";
  import type { ICommandInterpreter } from "../services/contracts/ICommandInterpreter";
  import type { ICommandDispatcher } from "../services/contracts/ICommandDispatcher";
  import { navigationState } from "../../navigation/state/navigation-state.svelte";

  let wakeWordDetector: IWakeWordDetector | null = null;
  let commandInterpreter: ICommandInterpreter | null = null;
  let commandDispatcher: ICommandDispatcher | null = null;

  onMount(() => {
    try {
      wakeWordDetector = container.items.wakeWordDetector as IWakeWordDetector;
      commandInterpreter = container.items.commandInterpreter as ICommandInterpreter;
      commandDispatcher = container.items.commandDispatcher as ICommandDispatcher;
    } catch (error) {
      console.error("[HeyTika] Failed to resolve voice control services:", error);
      return;
    }

    if (!wakeWordDetector.isSupported()) {
      console.warn("[HeyTika] Web Speech API not supported. Voice control disabled.");
      return;
    }

    // Subscribe to detected commands
    const unsubCommand = wakeWordDetector.onCommand(async (event) => {
      if (!commandInterpreter || !commandDispatcher) return;

      const context = {
        currentModule: navigationState.currentModule,
        currentTab: navigationState.activeTab,
      };

      const command = commandInterpreter.interpret(event.command, context);

      if (command.type === "unknown") {
        console.log(`[HeyTika] Unrecognized command: "${event.command}"`);
        return;
      }

      const result = await commandDispatcher.dispatch(command);

      if (result.success) {
        console.log(`[HeyTika] ${result.message}`);
      } else {
        console.warn(`[HeyTika] Command failed: ${result.message}`);
      }
    });

    const unsubState = wakeWordDetector.onStateChange((state) => {
      if (state === "error") {
        console.warn("[HeyTika] Wake word detector entered error state");
      }
    });

    // Start listening
    wakeWordDetector.start();

    return () => {
      unsubCommand();
      unsubState();
      wakeWordDetector?.stop();
    };
  });
</script>
