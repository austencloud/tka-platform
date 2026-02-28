<!--
  DosTerminal — Root component for the DOS-era terminal emulator.

  Renders the terminal output buffer, handles keyboard input, shows
  a blinking cursor on the input line, and composes the CRT overlay.
  Keyboard input is captured via a window-level keydown listener so
  the user never needs to focus an <input> element.

  Command parsing is delegated to CommandParser (wired in Task 6).
  Boot sequence animation is wired in Task 4.

  Domain: Retro DOS Terminal
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { terminalState } from "../state/terminal-state.svelte";
  import "../styles/dos-terminal.css";

  /* ------------------------------------------------------------------ */
  /* Element references                                                  */
  /* ------------------------------------------------------------------ */

  let outputEl: HTMLDivElement | undefined = $state();

  /* ------------------------------------------------------------------ */
  /* Auto-scroll to bottom when lines change                             */
  /* ------------------------------------------------------------------ */

  $effect(() => {
    // Read lines.length to subscribe to buffer changes
    const _len = terminalState.lines.length;
    if (outputEl) {
      // Use tick-deferred scroll so the DOM has rendered the new line
      requestAnimationFrame(() => {
        if (outputEl) {
          outputEl.scrollTop = outputEl.scrollHeight;
        }
      });
    }
  });

  /* ------------------------------------------------------------------ */
  /* Keyboard input handler                                              */
  /* ------------------------------------------------------------------ */

  function handleKeydown(event: KeyboardEvent): void {
    if (!terminalState.inputEnabled) return;

    // Ignore key events with ctrl or alt modifiers (browser shortcuts)
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    if (event.key === "Enter") {
      event.preventDefault();
      submitInput();
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      if (terminalState.inputText.length > 0) {
        terminalState.inputText = terminalState.inputText.slice(0, -1);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (terminalState.mode === "scribe" && terminalState.scribeMode !== "menu") {
        terminalState.scribeMode = "menu";
      }
      return;
    }

    // Only append printable single characters
    if (event.key.length === 1) {
      event.preventDefault();
      terminalState.inputText += event.key;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Submit current input                                                */
  /* ------------------------------------------------------------------ */

  function submitInput(): void {
    const input = terminalState.inputText.trim();

    // Echo the typed line (prompt + input) to the output buffer
    const escapedPrompt = terminalState.escapeForDisplay(terminalState.promptString);
    const escapedInput = terminalState.escapeForDisplay(terminalState.inputText);
    terminalState.writeHtml(`${escapedPrompt}${escapedInput}`);

    // Clear input field
    terminalState.inputText = "";

    // Delegate to command handler (stub until Task 6)
    handleInput(input);
  }

  /* ------------------------------------------------------------------ */
  /* Command handler stub — replaced by CommandParser in Task 6          */
  /* ------------------------------------------------------------------ */

  function handleInput(input: string): void {
    if (input.length > 0) {
      terminalState.writeLine("Bad command or file name");
      terminalState.writeBlank();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Mount: initialize terminal                                          */
  /* ------------------------------------------------------------------ */

  onMount(() => {
    terminalState.mode = "boot";

    // Boot sequence wired in Task 4. For now, skip straight to prompt.
    terminalState.mode = "prompt";
    terminalState.inputEnabled = true;
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
<div
  class="dos-terminal"
  class:amber={terminalState.colorScheme === "amber"}
  onkeydown={handleKeydown}
  tabindex="-1"
  role="application"
  aria-label="DOS terminal emulator"
>
  <!-- Output buffer -->
  <div class="dos-output" bind:this={outputEl}>
    {#each terminalState.lines as line, i (i)}
      <div class="dos-line">{@html line.html}</div>
    {/each}

    <!-- Input line with prompt + cursor -->
    {#if terminalState.inputEnabled}
      <div class="dos-input-line">
        <span class="dos-prompt-text">{@html terminalState.escapeForDisplay(terminalState.promptString)}</span>
        <span class="dos-input-text">{@html terminalState.escapeForDisplay(terminalState.inputText)}</span>
        <span class="dos-cursor" aria-hidden="true"></span>
      </div>
    {/if}
  </div>

  <!-- CRT scanline overlay -->
  {#if terminalState.crtEffects}
    <div class="dos-crt-overlay" aria-hidden="true"></div>
  {/if}
</div>
