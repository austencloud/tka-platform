<!--
  ScribeConfig - DOS-style configuration editor for terminal settings.

  Displays three toggleable settings (display mode, sound, CRT effects)
  and lets the user press 1-3 to change them. Changes apply immediately
  to terminalState. ESC returns to the SCRIBE menu.

  Input handling: receives single lines via the exported `handleInput`.
  A digit 1-3 toggles the corresponding setting. Any other input shows
  an error. The settings table is redrawn after each toggle so the user
  sees the updated values.

  Domain: Retro DOS Terminal / SCRIBE App
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { terminalState } from "../../state/terminal-state.svelte";
  import { DosSoundManager } from "../../services/dos-sound-manager";

  /* Props                                                               */

  interface Props {
    /** Called when Config mode finishes and should return to menu */
    onreturn: () => void;
  }

  let { onreturn }: Props = $props();

  const soundManager = new DosSoundManager();

  function colorSchemeLabel(): string {
    return terminalState.colorScheme === "green" ? "GREEN PHOSPHOR" : "AMBER PHOSPHOR";
  }

  /** Build the display label for sound enabled state. */
  function soundLabel(): string {
    return terminalState.soundEnabled ? "ON" : "OFF";
  }

  /** Build the display label for CRT effects state. */
  function crtLabel(): string {
    return terminalState.crtEffects ? "ON" : "OFF";
  }

  /** Write the configuration header and current settings to the terminal. */
  function drawConfig(): void {
    terminalState.writeBlank();
    terminalState.writeLine("=== CONFIGURATION ===", "white");
    terminalState.writeBlank();
    terminalState.writeLine("Current Configuration:");
    terminalState.writeLine(`  1) Display Mode:    ${colorSchemeLabel()}`);
    terminalState.writeLine(`  2) Sound:           ${soundLabel()}`);
    terminalState.writeLine(`  3) CRT Effects:     ${crtLabel()}`);
    terminalState.writeBlank();
    terminalState.promptString = "  Enter setting number to change (or ESC to return): ";
  }

  /**
   * Process a single line of input from the terminal.
   *
   * Called by DosTerminal when in scribe/config mode.
   * Digits 1-3 toggle the corresponding setting. Anything else
   * shows an error message.
   */
  function handleInput(input: string): void {
    const trimmed = input.trim();

    if (trimmed === "1") {
      // Toggle color scheme
      terminalState.colorScheme =
        terminalState.colorScheme === "green" ? "amber" : "green";
      soundManager.beep();
      terminalState.writeLine(
        `Display mode set to: ${colorSchemeLabel()}`,
      );
      drawConfig();
      return;
    }

    if (trimmed === "2") {
      // Toggle sound
      terminalState.soundEnabled = !terminalState.soundEnabled;
      soundManager.setMuted(!terminalState.soundEnabled);
      soundManager.beep();
      terminalState.writeLine(
        `Sound set to: ${soundLabel()}`,
      );
      drawConfig();
      return;
    }

    if (trimmed === "3") {
      // Toggle CRT effects
      terminalState.crtEffects = !terminalState.crtEffects;
      soundManager.beep();
      terminalState.writeLine(
        `CRT effects set to: ${crtLabel()}`,
      );
      drawConfig();
      return;
    }

    // Invalid input
    soundManager.error();
    terminalState.writeLine("Invalid selection. Enter 1-3 or press ESC to return.");
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  function cleanup(): void {
    terminalState.inputHandler = null;
    terminalState.promptString = "C:\\BELLWTHR>";
  }

  onMount(() => {
    drawConfig();
    terminalState.inputHandler = handleInput;
  });

  onDestroy(() => {
    if (terminalState.inputHandler === handleInput) {
      terminalState.inputHandler = null;
    }
  });
</script>
