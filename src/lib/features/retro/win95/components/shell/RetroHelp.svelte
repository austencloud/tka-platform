<!--
  RetroHelp - HELP.HLP fake help viewer

  Split-pane layout with topic list on the left (RetroListBox)
  and topic content on the right in a sunken monospace panel.
  Uses RetroSplitter for the resizable divider.

  Domain: Retro Desktop Shell
-->
<script lang="ts">
  import RetroSplitter from "../primitives/RetroSplitter.svelte";
  import RetroListBox from "../primitives/RetroListBox.svelte";

  let {
    onclose,
  }: {
    onclose?: () => void;
  } = $props();

  /* Topic data                                                          */

  interface HelpTopic {
    title: string;
    content: string;
  }

  const TOPICS: HelpTopic[] = [
    {
      title: "Getting Started",
      content:
        "Welcome to TKA-OS Help.\n\nUse the topic list on the left to navigate.\n\nIf you're reading this, you've already figured out more than most users.",
    },
    {
      title: "Creating Sequences",
      content:
        "Open TKANOTTN.EXE from the desktop or Programs menu.\n\nSelect the Construct tab to build sequences beat by beat, or use Generate for automatic creation.\n\nSave frequently. The floppy drive is unreliable.",
    },
    {
      title: "Using the File Manager",
      content:
        "FILEMGR.EXE provides a familiar interface for browsing your sequences.\n\nFiles are stored in 8.3 format on the C: drive. The A: drive is available for portable storage (capacity: 1.44 MB).",
    },
    {
      title: "Dealing With The Order",
      content:
        "This topic has been removed by request of the Bellweather Technical Institute, Office of Information Control, under Order 7, Section 12, Subsection C.\n\nFurther inquiries will be logged.",
    },
    {
      title: "Contacting Support",
      content:
        "Technical support is available Monday through Friday, 9 AM - 5 PM Eastern Time.\n\nTelephone: [DISCONNECTED]\nFax: [NUMBER NOT IN SERVICE]\nBBS: (555) 019-9500 (line busy)\nEmail: Not yet implemented\n\nAverage wait time: 47 minutes",
    },
    {
      title: "Keyboard Shortcuts",
      content:
        "Ctrl+N \u2014 New sequence\nCtrl+O \u2014 Open sequence\nCtrl+S \u2014 Save sequence\nF5 \u2014 Generate\nAlt+F4 \u2014 Exit application\nCtrl+Alt+Del \u2014 You know what this does",
    },
    {
      title: "Troubleshooting",
      content:
        "Q: My sequence won't save.\nA: Check that a formatted floppy disk is inserted in drive A:.\n\nQ: The screen turned blue.\nA: You've encountered a KINETIC_OVERFLOW. Try generating fewer than 47 beats.\n\nQ: Staff Clippy won't go away.\nA: This is by design. Staff Clippy is here to help.",
    },
    {
      title: "About TKA-OS",
      content:
        "TKA-OS v1.0\nBuild 1995.03.15\n(c) 1995 Bellweather Technical Institute\n\nDeveloped by the Department of Kinetic Sciences\nProject Lead: [CLASSIFIED]\nLead Engineer: [CLASSIFIED]\nQA: [POSITION ELIMINATED]",
    },
  ];

  const topicTitles = TOPICS.map((t) => t.title);

  let selectedIndex = $state(0);

  const currentContent = $derived(TOPICS[selectedIndex]?.content ?? "");
</script>

<div class="help-shell">
  <RetroSplitter direction="horizontal" initialSplit={25}>
    {#snippet left()}
      <div class="help-topics">
        <div class="help-topics-header">Contents</div>
        <RetroListBox
          items={topicTitles}
          bind:selectedIndex
          height={12}
        />
      </div>
    {/snippet}

    {#snippet right()}
      <div class="help-content sunken-panel">
        <div class="help-topic-title">{TOPICS[selectedIndex]?.title ?? ""}</div>
        <pre class="help-topic-body">{currentContent}</pre>
      </div>
    {/snippet}
  </RetroSplitter>
</div>

<style>
  .help-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--retro-button-face, #c0c0c0);
  }

  /* Left pane: topic list                                               */
  .help-topics {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 4px;
    gap: 4px;
  }

  .help-topics-header {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    font-weight: bold;
    color: var(--retro-black, #000);
    padding: 2px 4px;
    flex-shrink: 0;
  }

  /* Right pane: topic content                                           */
  .help-content {
    height: 100%;
    overflow: auto;
    background: var(--retro-field-bg, #fff);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .help-topic-title {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: 13px;
    font-weight: bold;
    color: var(--retro-navy, #000080);
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
    padding-bottom: 4px;
  }

  .help-topic-body {
    margin: 0;
    font-family: "Courier New", Courier, monospace;
    font-size: var(--retro-font-size, 11px);
    line-height: 1.5;
    color: var(--retro-black, #000);
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
