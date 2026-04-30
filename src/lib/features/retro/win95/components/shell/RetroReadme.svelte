<!--
  RetroReadme - README.TXT text viewer

  Displays Bellweather Technical Institute lore in a scrollable
  sunken panel with monospace font. Meant to be rendered inside a
  RetroWindow as its children content.

  Domain: Retro Desktop Shell
-->
<script lang="ts">
  let {
    onclose,
  }: {
    onclose?: () => void;
  } = $props();
</script>

<div class="readme-shell">
  <div class="readme-body sunken-panel">
    <pre class="readme-text">{@html `\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       TKA-OS v1.0 \u2014 README.TXT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Thank you for choosing TKA-OS, developed by
Bellweather Technical Institute.

SYSTEM REQUIREMENTS
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
- IBM PC compatible, 486DX/66 or higher
- 8 MB RAM (16 MB recommended)
- 40 MB available hard disk space
- VGA display (SVGA recommended)
- Microsoft-compatible mouse
- 3.5" floppy drive (for sequence storage)

KNOWN ISSUES
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
- DEFRAG.EXE may cause system instability
  if run during active sequence generation.
- The Staff Assistant (CLIPPY.EXE) may appear
  unsolicited. This is a feature, not a bug.
- Prop physics calculations exceeding 3 turns
  may trigger KINETIC_OVERFLOW (see BSOD).
- Network features require TKA-NET v0.1 which
  has been delayed indefinitely.

ABOUT BELLWEATHER TECHNICAL INSTITUTE
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
Founded in [YEAR REDACTED], the Bellweather
Technical Institute has been advancing the
science of kinetic notation since before most
current practitioners were born.

Our mission is to document, preserve, and
standardize the recording of movement patterns
for future generations.

For support, contact:
  Bellweather Technical Institute
  Department of Kinetic Sciences
  [ADDRESS REDACTED BY ORDER]
  Tel: [DISCONNECTED]
  BBS: (555) 019-9500 (2400 baud, 8N1)

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
(c) 1995 Bellweather Technical Institute
Distribution prohibited under Order 7.
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`}</pre>
  </div>
</div>

<style>
  .readme-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--retro-button-face, #c0c0c0);
    padding: 4px;
  }

  .readme-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: var(--retro-field-bg, #fff);
    padding: 8px;
  }

  .readme-text {
    margin: 0;
    font-family: "Courier New", Courier, monospace;
    font-size: var(--retro-font-size, 11px);
    line-height: 1.5;
    color: var(--retro-black, #000);
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
