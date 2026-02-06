<!--
  HeyTikaListener

  Invisible component that orchestrates the "Hey Tika" voice control pipeline.

  Flow:
  1. Starts in wake word mode (listening for "Hey Tika")
  2. "Hey Tika [command]" → interpret + dispatch immediately
  3. "Hey Tika" alone → enters command mode (mic is hot, everything is a command)
  4. In command mode, "stop"/"done"/etc → exits command mode
  5. Command mode auto-expires after 15s of no commands

  Phase 1: Hardcoded ON for development. Phase 5 adds user settings toggle.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "../../di";
  import type { IWakeWordDetector } from "../services/contracts/IWakeWordDetector";
  import type { ICommandInterpreter } from "../services/contracts/ICommandInterpreter";
  import type { ICommandDispatcher } from "../services/contracts/ICommandDispatcher";
  import { navigationState } from "../../navigation/state/navigation-state.svelte";
  import { voiceControlState } from "../state/voice-control-state.svelte";

  let wakeWordDetector: IWakeWordDetector | null = null;
  let commandInterpreter: ICommandInterpreter | null = null;
  let commandDispatcher: ICommandDispatcher | null = null;

  function enterCommandMode() {
    if (!wakeWordDetector) return;
    wakeWordDetector.setCommandMode(true);
    voiceControlState.enterCommandMode();
  }

  function exitCommandMode() {
    // voiceControlState.exitCommandMode() triggers the onCommandModeExpired callback,
    // which tells the detector to setCommandMode(false). Single path for all exits.
    voiceControlState.exitCommandMode();
  }

  onMount(() => {
    try {
      wakeWordDetector = container.items.wakeWordDetector as IWakeWordDetector;
      commandInterpreter = container.items.commandInterpreter as ICommandInterpreter;
      commandDispatcher = container.items.commandDispatcher as ICommandDispatcher;
    } catch (error) {
      console.error("[HeyTika] Failed to resolve voice control services:", error);
      return;
    }

    voiceControlState.setSupported(wakeWordDetector.isSupported());

    if (!wakeWordDetector.isSupported()) {
      console.warn("[HeyTika] Web Speech API not supported. Voice control disabled.");
      return;
    }

    // When command mode auto-expires, tell the detector to drop back to wake word mode
    voiceControlState.setOnCommandModeExpired(() => {
      wakeWordDetector?.setCommandMode(false);
    });

    // "Hey Tika" said alone → enter command mode
    const unsubWakeWord = wakeWordDetector.onWakeWord(() => {
      enterCommandMode();
      voiceControlState.showFeedback("success", "Listening...");
    });

    // Command detected (either from wake word + command, or from command mode speech)
    const unsubCommand = wakeWordDetector.onCommand(async (event) => {
      if (!commandInterpreter || !commandDispatcher) return;

      const context = {
        currentModule: navigationState.currentModule,
        currentTab: navigationState.activeTab,
      };

      const command = commandInterpreter.interpret(event.command, context);

      // System exit command
      if (command.category === "system" && command.action === "exit") {
        // If help overlay is open, "close"/"dismiss" closes it instead of exiting
        if (voiceControlState.helpOverlayOpen) {
          voiceControlState.closeHelp();
          voiceControlState.showFeedback("success", "Help closed");
          voiceControlState.refreshCommandModeTimer();
          return;
        }
        exitCommandMode();
        voiceControlState.showFeedback("success", "Stopped listening");
        return;
      }

      // System help command
      if (command.category === "system" && command.action === "help") {
        voiceControlState.toggleHelp();
        voiceControlState.refreshCommandModeTimer();
        const msg = voiceControlState.helpOverlayOpen ? "Here's what you can say" : "Help closed";
        voiceControlState.showFeedback("success", msg);
        return;
      }

      // Unknown command (no interpreter matched)
      if (command.category === "system" && command.action === "unknown") {
        console.log(`[HeyTika] Unrecognized command: "${event.command}"`);
        voiceControlState.showFeedback("error", `"${event.command}"?`, event.command);
        return;
      }

      const result = await commandDispatcher.dispatch(command);

      // Reset the command mode timeout after a successful command
      voiceControlState.refreshCommandModeTimer();

      if (result.success) {
        console.log(`[HeyTika] ${result.message}`);
        voiceControlState.showFeedback("success", result.message, event.command);
      } else {
        console.warn(`[HeyTika] Command failed: ${result.message}`);
        voiceControlState.showFeedback("error", result.message, event.command);
      }
    });

    // Sync detector state → reactive store
    const unsubState = wakeWordDetector.onStateChange((state) => {
      voiceControlState.setDetectorState(state);
      if (state === "error") {
        console.warn("[HeyTika] Wake word detector entered error state");
      }
    });

    // Start listening (wake word mode)
    wakeWordDetector.start();
    voiceControlState.setEnabled(true);
    voiceControlState.setDetectorState("listening");

    // Restore command mode if it was active before HMR
    if (voiceControlState.shouldRestoreCommandMode()) {
      console.log("[HeyTika] Restoring command mode after HMR");
      enterCommandMode();
      voiceControlState.showFeedback("success", "Listening...");
    }

    return () => {
      unsubWakeWord();
      unsubCommand();
      unsubState();
      wakeWordDetector?.stop();
      voiceControlState.setEnabled(false);
      voiceControlState.setDetectorState("idle");
      voiceControlState.clearFeedback();
      voiceControlState.destroy();
    };
  });
</script>
