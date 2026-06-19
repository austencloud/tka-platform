<!--
  DosTerminal - Root component for the DOS-era terminal emulator.

  Renders the terminal output buffer, handles keyboard input, shows
  a blinking cursor on the input line, and composes the CRT overlay.
  Keyboard input is captured via a window-level keydown listener so
  the user never needs to focus an <input> element.

  Command parsing is delegated to CommandParser. Boot sequence plays
  on mount via DosBootSequence, then transitions to prompt. All
  SCRIBE modes are wired as headless child components that register
  their own input handlers on terminalState.

  Domain: Retro DOS Terminal
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { terminalState } from "../state/terminal-state.svelte";
  import { CommandParser } from "../services/command-parser";
  import { DosFileSystem } from "../services/dos-file-system";
  import DosBootSequence from "./DosBootSequence.svelte";
  import ScribeMenu from "./apps/ScribeMenu.svelte";
  import ScribeGenerate from "./apps/ScribeGenerate.svelte";
  import ScribeConstruct from "./apps/ScribeConstruct.svelte";
  import ScribeSpell from "./apps/ScribeSpell.svelte";
  import ScribeBrowse from "./apps/ScribeBrowse.svelte";
  import ScribeCards from "./apps/ScribeCards.svelte";
  import ScribeTutorial from "./apps/ScribeTutorial.svelte";
  import ScribeConfig from "./apps/ScribeConfig.svelte";
  import "../styles/dos-terminal.css";

  /* ------------------------------------------------------------------ */
  /* Services                                                            */
  /* ------------------------------------------------------------------ */

  const fileSystem = new DosFileSystem();
  const commandParser = new CommandParser(fileSystem);

  /* ------------------------------------------------------------------ */
  /* Element references                                                  */
  /* ------------------------------------------------------------------ */

  let outputEl: HTMLDivElement | undefined = $state();
  let terminalEl: HTMLDivElement | undefined = $state();

  /* ------------------------------------------------------------------ */
  /* Auto-scroll to bottom when lines change                             */
  /* ------------------------------------------------------------------ */

  $effect(() => {
    // Read lines.length to subscribe to buffer changes
    const _len = terminalState.lines.length;
    if (!outputEl) return;

    // Use a RAF-deferred scroll so the DOM has rendered the new line.
    // Cancel any pending RAF from a prior re-run so rapid line appends
    // don't leave ghost callbacks queued.
    const rafId = requestAnimationFrame(() => {
      if (outputEl) {
        outputEl.scrollTop = outputEl.scrollHeight;
      }
    });

    return () => cancelAnimationFrame(rafId);
  });

  /* ------------------------------------------------------------------ */
  /* Keyboard input handler                                              */
  /* ------------------------------------------------------------------ */

  function handleKeydown(event: KeyboardEvent): void {
    if (!terminalState.inputEnabled) return;

    // Ignore key events with ctrl or alt modifiers (browser shortcuts)
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    // Stop propagation on ALL handled keys so global hotkeys (prop
    // selection, module shortcuts, etc.) don't intercept terminal input.
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      submitInput();
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      if (terminalState.inputText.length > 0) {
        terminalState.inputText = terminalState.inputText.slice(0, -1);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      handleEscape();
      return;
    }

    // Only append printable single characters
    if (event.key.length === 1) {
      event.preventDefault();
      event.stopPropagation();
      terminalState.inputText += event.key;
    }
  }

  /* ------------------------------------------------------------------ */
  /* ESC key handling                                                     */
  /* ------------------------------------------------------------------ */

  function handleEscape(): void {
    if (terminalState.mode === "scribe") {
      // If a component registered its own ESC handler, delegate to it
      if (terminalState.escapeHandler) {
        terminalState.escapeHandler();
      } else if (terminalState.scribeMode !== "menu") {
        // Default behavior: return to SCRIBE menu
        returnToScribeMenu();
      } else {
        // At SCRIBE menu: ESC returns to DOS prompt
        terminalState.inputHandler = null;
        terminalState.promptString = "C:\\BELLWTHR>";
        terminalState.mode = "prompt";
        terminalState.scribeMode = "menu";
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Submit current input                                                */
  /* ------------------------------------------------------------------ */

  function submitInput(): void {
    const input = terminalState.inputText.trim();

    // Echo the typed line — mask password characters
    const escapedPrompt = terminalState.escapeForDisplay(terminalState.promptString);
    const displayText = terminalState.inputMask
      ? "*".repeat(terminalState.inputText.length)
      : terminalState.inputText;
    const escapedInput = terminalState.escapeForDisplay(displayText);
    terminalState.writeHtml(`${escapedPrompt}${escapedInput}`);

    // Clear input field
    terminalState.inputText = "";

    // Delegate to command handler
    routeInput(input);
  }

  /* ------------------------------------------------------------------ */
  /* Command routing                                                     */
  /* ------------------------------------------------------------------ */

  function routeInput(input: string): void {
    // If an app component has registered an input handler, use it
    if (terminalState.inputHandler) {
      terminalState.inputHandler(input);
      return;
    }

    // Fall through to the CommandParser for DOS prompt commands
    if (input.length > 0) {
      commandParser.execute(input);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Return to SCRIBE menu from a sub-mode                               */
  /* ------------------------------------------------------------------ */

  function returnToScribeMenu(): void {
    terminalState.scribeMode = "menu";
  }

  /* ------------------------------------------------------------------ */
  /* Boot complete callback                                              */
  /* ------------------------------------------------------------------ */

  function onBootComplete(): void {
    terminalState.mode = "prompt";
    terminalState.inputEnabled = true;

    // If already authenticated from a previous session, update the prompt
    commandParser.updatePromptForAuth();
    if (terminalState.authenticatedUser) {
      terminalState.writeLine(
        `Authenticated as ${terminalState.authenticatedUser}.`,
        "cyan",
      );
      terminalState.writeBlank();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Mount: start in boot mode                                           */
  /* ------------------------------------------------------------------ */

  onMount(() => {
    terminalState.mode = "boot";
    terminalState.inputEnabled = false;
    // Focus the terminal so keyboard input works immediately
    terminalEl?.focus();
  });

  onDestroy(() => {
    // Stop the FORMAT easter-egg interval if it's still running so it
    // can't keep firing against terminalState after unmount.
    commandParser.dispose();
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
<div class="dos-desk">
  <div class="dos-monitor">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="dos-terminal"
      class:amber={terminalState.colorScheme === "amber"}
      onkeydown={handleKeydown}
      bind:this={terminalEl}
      tabindex="-1"
      role="application"
      aria-label="DOS terminal emulator"
    >
      <!-- Output buffer -->
      <div class="dos-output" bind:this={outputEl}>
        {#each terminalState.lines as line, i (i)}
          <div class="dos-line">{@html line.html}</div>
        {/each}

        <!-- Boot sequence (renders nothing visible - writes to terminal state) -->
        {#if terminalState.mode === "boot"}
          <DosBootSequence oncomplete={onBootComplete} />
        {/if}

        <!-- SCRIBE menu -->
        {#if terminalState.mode === "scribe" && terminalState.scribeMode === "menu"}
          <ScribeMenu />
        {/if}

        <!-- SCRIBE Generate mode -->
        {#if terminalState.mode === "scribe" && terminalState.scribeMode === "generate"}
          <ScribeGenerate onreturn={returnToScribeMenu} />
        {/if}

        <!-- SCRIBE Construct mode -->
        {#if terminalState.mode === "scribe" && terminalState.scribeMode === "construct"}
          <ScribeConstruct onreturn={returnToScribeMenu} />
        {/if}

        <!-- SCRIBE Spell mode -->
        {#if terminalState.mode === "scribe" && terminalState.scribeMode === "spell"}
          <ScribeSpell onreturn={returnToScribeMenu} />
        {/if}

        <!-- SCRIBE Browse mode -->
        {#if terminalState.mode === "scribe" && terminalState.scribeMode === "browse"}
          <ScribeBrowse onreturn={returnToScribeMenu} />
        {/if}

        <!-- SCRIBE Cards mode -->
        {#if terminalState.mode === "scribe" && terminalState.scribeMode === "cards"}
          <ScribeCards onreturn={returnToScribeMenu} />
        {/if}

        <!-- SCRIBE Tutorial mode -->
        {#if terminalState.mode === "scribe" && terminalState.scribeMode === "tutorial"}
          <ScribeTutorial onreturn={returnToScribeMenu} />
        {/if}

        <!-- SCRIBE Config mode -->
        {#if terminalState.mode === "scribe" && terminalState.scribeMode === "config"}
          <ScribeConfig onreturn={returnToScribeMenu} />
        {/if}

        <!-- Input line with prompt + cursor -->
        {#if terminalState.inputEnabled}
          {@const maskedInput = terminalState.inputMask
            ? "*".repeat(terminalState.inputText.length)
            : terminalState.inputText}
          <div class="dos-input-line">
            <span class="dos-prompt-text">{@html terminalState.escapeForDisplay(terminalState.promptString)}</span>
            <span class="dos-input-text">{@html terminalState.escapeForDisplay(maskedInput)}</span>
            <span class="dos-cursor" aria-hidden="true"></span>
          </div>
        {/if}
      </div>

      <!-- CRT scanline overlay -->
      {#if terminalState.crtEffects}
        <div class="dos-crt-overlay" aria-hidden="true"></div>
      {/if}
    </div>
  </div>
</div>
