<!--
  HeyTikaListener

  Invisible component that orchestrates the "Hey Tika" voice control pipeline.

  Three-tier intent resolution:
  - Tier 1 (Fast): Regex-based sub-interpreters. 0ms, $0. Handles known phrases.
  - Tier 2 (Smart): LLM-powered resolution via Haiku. ~400ms, ~$0.0004. Natural language fallback.
  - Tier 3 (Rich): Route to TIKA chat for questions. (Phase 4)

  Flow:
  1. Starts in wake word mode (listening for "Hey Tika")
  2. "Hey Tika [command]" → interpret + dispatch immediately
  3. "Hey Tika" alone → enters command mode (mic is hot, everything is a command)
  4. In command mode, "stop"/"done"/etc → exits command mode
  5. Command mode auto-expires after 15s of no commands
  6. Unknown commands → classify tier → Tier 2 LLM or Tier 3 chat
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "../../di";
  import type { IWakeWordDetector } from "../services/contracts/IWakeWordDetector";
  import type { ICommandInterpreter } from "../services/contracts/ICommandInterpreter";
  import type { ICommandDispatcher } from "../services/contracts/ICommandDispatcher";
  import type { IIntentResolver } from "../services/contracts/IIntentResolver";
  import type { ITTSProvider } from "../services/contracts/ITTSProvider";
  import { navigationState } from "../../navigation/state/navigation-state.svelte";
  import { voiceControlState } from "../state/voice-control-state.svelte";
  import { classifyTier } from "../ai/tier-classifier";
  import type { VoiceCommand } from "../domain/voice-command-types";

  let wakeWordDetector: IWakeWordDetector | null = null;
  let commandInterpreter: ICommandInterpreter | null = null;
  let commandDispatcher: ICommandDispatcher | null = null;
  let intentResolver: IIntentResolver | null = null;
  let ttsProvider: ITTSProvider | null = null;

  function enterCommandMode() {
    // voiceControlState.enterCommandMode() calls onEnterCommandMode callback,
    // which tells the detector to setCommandMode(true)
    voiceControlState.enterCommandMode();
  }

  function exitCommandMode() {
    // voiceControlState.exitCommandMode() triggers the onCommandModeExpired callback,
    // which tells the detector to setCommandMode(false). Single path for all exits.
    voiceControlState.exitCommandMode();
  }

  /**
   * Dispatch a single VoiceCommand and return the result.
   * Used by both Tier 1 (regex) and Tier 2 (LLM) paths.
   */
  async function dispatchCommand(command: VoiceCommand, rawEvent: string) {
    if (!commandDispatcher) return;

    const result = await commandDispatcher.dispatch(command);
    voiceControlState.refreshCommandModeTimer();

    if (result.success) {
      console.log(`[HeyTika] ${result.message}`);
      voiceControlState.showFeedback("success", result.message, rawEvent);
    } else {
      console.warn(`[HeyTika] Command failed: ${result.message}`);
      voiceControlState.showFeedback("error", result.message, rawEvent);
    }
  }

  /**
   * Tier 2: LLM-powered intent resolution.
   * Called when regex chain returns "unknown" and tier classifier says "action".
   */
  async function resolveTier2(rawText: string, rawEvent: string) {
    if (!intentResolver || !commandDispatcher) return;

    const context = {
      currentModule: navigationState.currentModule,
      currentTab: navigationState.activeTab,
    };

    // Show "Understanding..." while LLM processes
    voiceControlState.showFeedback("info", "Understanding...", rawEvent);

    // Pass previous command for conversational context ("do that again", "make it longer")
    const lastCommands = voiceControlState.lastResolvedCommands;
    const previousCommand = lastCommands.length > 0 ? lastCommands[lastCommands.length - 1] : undefined;

    console.log(`[HeyTika] Tier 2: Resolving "${rawText}" via LLM`);
    const resolution = await intentResolver.resolve(rawText, context, previousCommand);

    // If LLM says this is a question, route to Tier 3 (voice-to-chat)
    if (resolution.escalateToChat) {
      console.log(`[HeyTika] Tier 2 → Tier 3: "${rawText}" is a question, escalating to chat`);
      await resolveTier3(rawText, rawEvent);
      return;
    }

    // Check if LLM couldn't resolve it either
    const firstCommand = resolution.commands[0];
    const isUnknown = resolution.commands.length === 1
      && firstCommand?.category === "system"
      && firstCommand?.action === "unknown";

    if (isUnknown || resolution.commands.length === 0) {
      console.log(`[HeyTika] Tier 2 failed: "${rawText}" not recognized`);
      voiceControlState.showFeedback("error", `"${rawText}"?`, rawEvent);
      return;
    }

    // Store for conversational context (Phase 3)
    voiceControlState.setLastResolvedCommands(resolution.commands);

    // Dispatch all resolved commands sequentially
    for (const command of resolution.commands) {
      await dispatchCommand(command, rawEvent);
    }
  }

  /**
   * Tier 3: Voice-to-chat for questions.
   * Sends the question to /api/tika/ask, collects the streamed response,
   * speaks it via TTS, and shows a chat bubble.
   */
  async function resolveTier3(rawText: string, rawEvent: string) {
    voiceControlState.showFeedback("info", "Thinking...", rawEvent);
    voiceControlState.refreshCommandModeTimer();

    try {
      const response = await fetch("/api/tika/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: rawText,
          model: "haiku",
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        voiceControlState.showFeedback("error", "Couldn't get an answer", rawEvent);
        return;
      }

      // Collect the streamed response text
      const responseText = await collectStreamedText(response);

      if (!responseText) {
        voiceControlState.showFeedback("error", "No response", rawEvent);
        return;
      }

      // Truncate for display (bubble is small)
      const displayText = responseText.length > 200
        ? responseText.slice(0, 200) + "..."
        : responseText;

      // Show chat bubble and speak
      voiceControlState.showChatBubble(displayText, true);
      voiceControlState.clearFeedback();
      voiceControlState.refreshCommandModeTimer();

      if (ttsProvider?.isSupported()) {
        await ttsProvider.speak(responseText);
      }

      voiceControlState.setChatBubbleSpeaking(false);
    } catch (error) {
      console.warn("[HeyTika] Tier 3 failed:", error);
      voiceControlState.showFeedback("error", "Couldn't get an answer", rawEvent);
    }
  }

  /**
   * Collect text from a streamed AI SDK response.
   * The AI SDK streams UI messages as newline-delimited JSON.
   * We extract text content from the stream.
   */
  async function collectStreamedText(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return "";

    const decoder = new TextDecoder();
    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // AI SDK streams text parts as lines like: 0:"text content"
        // Parse text delta lines (format: 0:"chunk")
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("0:")) {
            try {
              const textContent = JSON.parse(trimmed.slice(2));
              if (typeof textContent === "string") {
                fullText += textContent;
              }
            } catch {
              // Not valid JSON, skip
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText.trim();
  }

  onMount(() => {
    try {
      wakeWordDetector = container.items.wakeWordDetector as IWakeWordDetector;
      commandInterpreter = container.items.commandInterpreter as ICommandInterpreter;
      commandDispatcher = container.items.commandDispatcher as ICommandDispatcher;
      intentResolver = container.items.intentResolver as IIntentResolver;
      ttsProvider = container.items.ttsProvider as ITTSProvider;
    } catch (error) {
      console.error("[HeyTika] Failed to resolve voice control services:", error);
      return;
    }

    voiceControlState.setSupported(wakeWordDetector.isSupported());

    if (!wakeWordDetector.isSupported()) {
      console.warn("[HeyTika] Web Speech API not supported. Voice control disabled.");
      return;
    }

    // Bridge state callbacks → detector
    voiceControlState.setOnCommandModeExpired(() => {
      wakeWordDetector?.setCommandMode(false);
    });

    voiceControlState.setOnEnterCommandMode(() => {
      wakeWordDetector?.setCommandMode(true);
    });

    // On-demand activation: UI calls startListening() → we start the detector
    voiceControlState.setOnStartRequested(() => {
      if (!wakeWordDetector) return;
      wakeWordDetector.start();
      voiceControlState.setEnabled(true);
      voiceControlState.setDetectorState("listening");
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

      // Unknown command (no interpreter matched) → escalate to Tier 2/3
      if (command.category === "system" && command.action === "unknown") {
        console.log(`[HeyTika] Tier 1 miss: "${event.command}"`);

        const tier = classifyTier(event.command);

        if (tier === "question") {
          console.log(`[HeyTika] Tier 3: "${event.command}" classified as question`);
          await resolveTier3(event.command, event.command);
          return;
        }

        // Tier 2: action intent → LLM resolution
        await resolveTier2(event.command, event.command);
        return;
      }

      // Tier 1 matched → dispatch directly
      await dispatchCommand(command, event.command);
    });

    // Sync detector state → reactive store
    const unsubState = wakeWordDetector.onStateChange((state) => {
      voiceControlState.setDetectorState(state);
      if (state === "error") {
        console.warn("[HeyTika] Wake word detector entered error state");
      }
      // Detector auto-paused (e.g., too many silent restarts on mobile).
      // Show the inactive mic button so the user can tap to re-activate.
      if (state === "idle" && voiceControlState.enabled && !wakeWordDetector!.isListening()) {
        voiceControlState.setEnabled(false);
        voiceControlState.exitCommandMode();
        console.log("[HeyTika] Detector auto-paused, showing inactive mic");
      }
    });

    // Don't auto-start. Voice control activates when the user clicks the mic button.
    // This avoids the browser microphone permission prompt on page load.

    // Restore command mode if it was active before HMR
    if (voiceControlState.shouldRestoreCommandMode()) {
      console.log("[HeyTika] Restoring command mode after HMR");
      wakeWordDetector.start();
      voiceControlState.setEnabled(true);
      voiceControlState.setDetectorState("listening");
      enterCommandMode();
      voiceControlState.showFeedback("success", "Listening...");
    }

    return () => {
      unsubWakeWord();
      unsubCommand();
      unsubState();
      wakeWordDetector?.stop();
      ttsProvider?.cancel();
      voiceControlState.setOnStartRequested(null);
      voiceControlState.setOnEnterCommandMode(null);
      voiceControlState.setEnabled(false);
      voiceControlState.setDetectorState("idle");
      voiceControlState.clearFeedback();
      voiceControlState.dismissChatBubble();
      voiceControlState.destroy();
    };
  });
</script>
