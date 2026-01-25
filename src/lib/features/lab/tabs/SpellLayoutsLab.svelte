<!--
  SpellLayoutsLab.svelte - Test large-screen layout options for Spell tab

  Shows 4 different layout approaches for the Spell tab on large screens (4K monitors).
  Click each tab to see the layout in action with a mocked sequence grid.
-->
<script lang="ts">
  let activeLayout = $state<'bar' | 'panel' | 'header' | 'command'>('bar');
  let word = $state('SKYLAR');
  let isGenerating = $state(false);

  // Mock settings state
  let settings = $state({
    dashes: 'Mixed',
    props: 'Mixed',
    hands: 'Smooth',
    grid: 'Diamond',
    loop: false,
  });

  function handleGenerate() {
    isGenerating = true;
    setTimeout(() => isGenerating = false, 1500);
  }

  function toggleSetting(key: 'grid' | 'loop') {
    if (key === 'grid') {
      settings.grid = settings.grid === 'Diamond' ? 'Box' : 'Diamond';
    } else {
      settings.loop = !settings.loop;
    }
  }

  function cycleSetting(key: 'dashes' | 'props' | 'hands') {
    const cycles = {
      dashes: ['Low', 'Mixed', 'High'],
      props: ['Smooth', 'Mixed', 'High'],
      hands: ['Smooth', 'Mixed', 'High'],
    };
    const options = cycles[key];
    const current = settings[key];
    const idx = options.indexOf(current);
    settings[key] = options[(idx + 1) % options.length];
  }
</script>

<div class="spell-layouts-lab">
  <header class="lab-header">
    <h1>Spell Tab - Large Screen Layouts</h1>
    <p>Click each tab to preview. These are mockups - settings buttons cycle through options when clicked.</p>

    <nav class="layout-tabs">
      <button
        class:active={activeLayout === 'bar'}
        onclick={() => activeLayout = 'bar'}
      >
        1. Horizontal Bar
      </button>
      <button
        class:active={activeLayout === 'panel'}
        onclick={() => activeLayout = 'panel'}
      >
        2. Wide Side Panel
      </button>
      <button
        class:active={activeLayout === 'header'}
        onclick={() => activeLayout = 'header'}
      >
        3. Integrated Header
      </button>
      <button
        class:active={activeLayout === 'command'}
        onclick={() => activeLayout = 'command'}
      >
        4. Command Bar
      </button>
    </nav>
  </header>

  <main class="layout-preview" data-layout={activeLayout}>

    <!-- LAYOUT 1: Horizontal Bar -->
    {#if activeLayout === 'bar'}
      <div class="layout-bar">
        <div class="bar-controls">
          <div class="bar-input-group">
            <input
              type="text"
              bind:value={word}
              placeholder="Enter word..."
              class="bar-word-input"
            />
            <button class="bar-clear" onclick={() => word = ''}>
              <i class="fas fa-backspace"></i>
            </button>
          </div>

          <div class="bar-settings">
            <button class="bar-chip" onclick={() => cycleSetting('dashes')}>
              <span class="chip-label">Dashes</span>
              <span class="chip-value">{settings.dashes}</span>
            </button>
            <button class="bar-chip" onclick={() => cycleSetting('props')}>
              <span class="chip-label">Props</span>
              <span class="chip-value">{settings.props}</span>
            </button>
            <button class="bar-chip" onclick={() => cycleSetting('hands')}>
              <span class="chip-label">Hands</span>
              <span class="chip-value">{settings.hands}</span>
            </button>
            <button class="bar-chip toggle" class:active={settings.grid === 'Box'} onclick={() => toggleSetting('grid')}>
              <span class="chip-label">Grid</span>
              <span class="chip-value">{settings.grid === 'Diamond' ? '◇' : '▢'}</span>
            </button>
            <button class="bar-chip toggle" class:active={settings.loop} onclick={() => toggleSetting('loop')}>
              <span class="chip-label">Loop</span>
              <span class="chip-value">{settings.loop ? 'On' : 'Off'}</span>
            </button>
          </div>

          <button class="bar-generate" disabled={!word.trim()} onclick={handleGenerate}>
            {#if isGenerating}
              <i class="fas fa-circle-notch fa-spin"></i>
              Generating...
            {:else}
              <i class="fas fa-magic"></i>
              Generate
            {/if}
          </button>
        </div>

        <div class="sequence-grid-mock">
          <div class="grid-placeholder">
            <span>Sequence Grid Area</span>
            <small>Full width, controls stay above</small>
          </div>
        </div>
      </div>
    {/if}

    <!-- LAYOUT 2: Wide Side Panel -->
    {#if activeLayout === 'panel'}
      <div class="layout-panel">
        <div class="sequence-grid-mock panel-grid">
          <div class="grid-placeholder">
            <span>Sequence Grid Area</span>
            <small>Takes remaining space</small>
          </div>
        </div>

        <aside class="wide-panel">
          <div class="panel-section">
            <label class="panel-label">Word</label>
            <div class="panel-input-group">
              <input
                type="text"
                bind:value={word}
                placeholder="Enter word..."
                class="panel-word-input"
              />
              <button class="panel-clear" onclick={() => word = ''}>
                <i class="fas fa-backspace"></i>
              </button>
            </div>
          </div>

          <div class="panel-section">
            <label class="panel-label">Settings</label>
            <div class="panel-settings-grid">
              <button class="panel-chip" onclick={() => cycleSetting('dashes')}>
                <span class="chip-label">Dashes</span>
                <span class="chip-value">{settings.dashes}</span>
              </button>
              <button class="panel-chip" onclick={() => cycleSetting('props')}>
                <span class="chip-label">Props</span>
                <span class="chip-value">{settings.props}</span>
              </button>
              <button class="panel-chip" onclick={() => cycleSetting('hands')}>
                <span class="chip-label">Hands</span>
                <span class="chip-value">{settings.hands}</span>
              </button>
              <button class="panel-chip toggle" class:active={settings.grid === 'Box'} onclick={() => toggleSetting('grid')}>
                <span class="chip-label">Grid</span>
                <span class="chip-value">{settings.grid === 'Diamond' ? '◇' : '▢'}</span>
              </button>
              <button class="panel-chip toggle" class:active={settings.loop} onclick={() => toggleSetting('loop')}>
                <span class="chip-label">Loop</span>
                <span class="chip-value">{settings.loop ? 'On' : 'Off'}</span>
              </button>
            </div>
          </div>

          <button class="panel-generate" disabled={!word.trim()} onclick={handleGenerate}>
            {#if isGenerating}
              <i class="fas fa-circle-notch fa-spin"></i>
              Generating...
            {:else}
              <i class="fas fa-magic"></i>
              Generate Sequence
            {/if}
          </button>
        </aside>
      </div>
    {/if}

    <!-- LAYOUT 3: Integrated Header -->
    {#if activeLayout === 'header'}
      <div class="layout-header">
        <header class="integrated-header">
          <button class="header-back">
            <i class="fas fa-arrow-left"></i>
          </button>

          <div class="header-input-group">
            <input
              type="text"
              bind:value={word}
              placeholder="Enter word..."
              class="header-word-input"
            />
          </div>

          <div class="header-settings">
            <button class="header-chip" title="Dashes: {settings.dashes}" onclick={() => cycleSetting('dashes')}>
              <i class="fas fa-bolt"></i>
            </button>
            <button class="header-chip" title="Props: {settings.props}" onclick={() => cycleSetting('props')}>
              <i class="fas fa-sync-alt"></i>
            </button>
            <button class="header-chip" title="Hands: {settings.hands}" onclick={() => cycleSetting('hands')}>
              <i class="fas fa-hands"></i>
            </button>
            <button class="header-chip" class:active={settings.grid === 'Box'} title="Grid Mode" onclick={() => toggleSetting('grid')}>
              {settings.grid === 'Diamond' ? '◇' : '▢'}
            </button>
            <button class="header-chip" class:active={settings.loop} title="Loop" onclick={() => toggleSetting('loop')}>
              <i class="fas fa-redo"></i>
            </button>
          </div>

          <button class="header-generate" disabled={!word.trim()} onclick={handleGenerate}>
            {#if isGenerating}
              <i class="fas fa-circle-notch fa-spin"></i>
            {:else}
              <i class="fas fa-magic"></i>
              Generate
            {/if}
          </button>

          <button class="header-save">
            <i class="fas fa-bookmark"></i>
          </button>
        </header>

        <div class="sequence-grid-mock header-grid">
          <div class="grid-placeholder">
            <span>Sequence Grid Area</span>
            <small>Full viewport, controls in header</small>
          </div>
        </div>
      </div>
    {/if}

    <!-- LAYOUT 4: Command Bar (Spotlight-style) -->
    {#if activeLayout === 'command'}
      <div class="layout-command">
        <div class="command-bar">
          <div class="command-main">
            <i class="fas fa-search command-icon"></i>
            <input
              type="text"
              bind:value={word}
              placeholder="Type a word to spell..."
              class="command-input"
            />
            <button class="command-generate" disabled={!word.trim()} onclick={handleGenerate}>
              {#if isGenerating}
                <i class="fas fa-circle-notch fa-spin"></i>
              {:else}
                Generate
              {/if}
            </button>
          </div>

          <div class="command-settings">
            <button class="command-chip" onclick={() => cycleSetting('dashes')}>
              Dashes: <strong>{settings.dashes}</strong>
            </button>
            <button class="command-chip" onclick={() => cycleSetting('props')}>
              Props: <strong>{settings.props}</strong>
            </button>
            <button class="command-chip" onclick={() => cycleSetting('hands')}>
              Hands: <strong>{settings.hands}</strong>
            </button>
            <span class="command-divider"></span>
            <button class="command-chip toggle" class:active={settings.grid === 'Box'} onclick={() => toggleSetting('grid')}>
              {settings.grid}
            </button>
            <button class="command-chip toggle" class:active={settings.loop} onclick={() => toggleSetting('loop')}>
              Loop {settings.loop ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        <div class="sequence-grid-mock command-grid">
          <div class="grid-placeholder">
            <span>Sequence Grid Area</span>
            <small>Command bar floats above, centered</small>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  /* ============================================
     LAB PAGE CHROME
     ============================================ */
  .spell-layouts-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #f8fafc;
  }

  .lab-header {
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
  }

  .lab-header h1 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 600;
  }

  .lab-header p {
    margin: 0 0 16px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
  }

  .layout-tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .layout-tabs button {
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .layout-tabs button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .layout-tabs button.active {
    background: #6366f1;
    border-color: #6366f1;
    color: #fff;
  }

  .layout-preview {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  /* Mock sequence grid */
  .sequence-grid-mock {
    background: rgba(0, 0, 0, 0.2);
    border: 2px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .grid-placeholder {
    text-align: center;
    color: rgba(255, 255, 255, 0.3);
  }

  .grid-placeholder span {
    display: block;
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 6px;
  }

  .grid-placeholder small {
    font-size: 12px;
  }

  /* ============================================
     LAYOUT 1: HORIZONTAL BAR
     ============================================ */
  .layout-bar {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 20px;
    gap: 20px;
  }

  .bar-controls {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 18px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    flex-shrink: 0;
  }

  .bar-input-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 220px;
  }

  .bar-word-input {
    flex: 1;
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .bar-word-input:focus {
    outline: none;
    border-color: #6366f1;
  }

  .bar-clear {
    padding: 8px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    font-size: 14px;
  }

  .bar-clear:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .bar-settings {
    display: flex;
    gap: 6px;
    flex: 1;
  }

  .bar-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    transition: all 150ms ease;
    min-width: 64px;
  }

  .bar-chip:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .bar-chip.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: #6366f1;
  }

  .chip-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .chip-value {
    font-size: 13px;
    font-weight: 600;
  }

  .bar-generate {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: #6366f1;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .bar-generate:hover:not(:disabled) {
    background: #4f46e5;
  }

  .bar-generate:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .layout-bar .sequence-grid-mock {
    flex: 1;
  }

  /* ============================================
     LAYOUT 2: WIDE SIDE PANEL
     ============================================ */
  .layout-panel {
    display: flex;
    height: 100%;
    gap: 20px;
    padding: 20px;
  }

  .panel-grid {
    flex: 1;
  }

  .wide-panel {
    width: 380px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .panel-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .panel-input-group {
    display: flex;
    gap: 8px;
  }

  .panel-word-input {
    flex: 1;
    padding: 14px 18px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-align: center;
  }

  .panel-word-input:focus {
    outline: none;
    border-color: #6366f1;
  }

  .panel-clear {
    padding: 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    font-size: 14px;
  }

  .panel-clear:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .panel-settings-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .panel-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 12px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #fff;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .panel-chip:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .panel-chip.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: #6366f1;
  }

  .panel-generate {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 20px;
    background: #6366f1;
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    margin-top: auto;
  }

  .panel-generate:hover:not(:disabled) {
    background: #4f46e5;
  }

  .panel-generate:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ============================================
     LAYOUT 3: INTEGRATED HEADER
     ============================================ */
  .layout-header {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .integrated-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .header-back {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-size: 13px;
  }

  .header-back:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .header-input-group {
    flex: 0 0 260px;
  }

  .header-word-input {
    width: 100%;
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-align: center;
  }

  .header-word-input:focus {
    outline: none;
    border-color: #6366f1;
  }

  .header-settings {
    display: flex;
    gap: 4px;
    flex: 1;
    justify-content: center;
  }

  .header-chip {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    font-size: 13px;
    transition: all 150ms ease;
  }

  .header-chip:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .header-chip.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: #6366f1;
    color: #a5b4fc;
  }

  .header-generate {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: #6366f1;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .header-generate:hover:not(:disabled) {
    background: #4f46e5;
  }

  .header-generate:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .header-save {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    font-size: 14px;
  }

  .header-save:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #6366f1;
  }

  .header-grid {
    flex: 1;
    margin: 20px;
  }

  /* ============================================
     LAYOUT 4: COMMAND BAR (Spotlight-style)
     ============================================ */
  .layout-command {
    position: relative;
    height: 100%;
  }

  .command-bar {
    position: absolute;
    top: 28px;
    left: 50%;
    transform: translateX(-50%);
    width: min(680px, calc(100% - 40px));
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(12px);
    z-index: 10;
  }

  .command-main {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .command-icon {
    color: rgba(255, 255, 255, 0.4);
    font-size: 16px;
    flex-shrink: 0;
  }

  .command-input {
    flex: 1;
    padding: 10px 0;
    background: transparent;
    border: none;
    color: #fff;
    font-size: 18px;
    font-weight: 500;
  }

  .command-input:focus {
    outline: none;
  }

  .command-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .command-generate {
    padding: 8px 18px;
    background: #6366f1;
    border: none;
    border-radius: 6px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .command-generate:hover:not(:disabled) {
    background: #4f46e5;
  }

  .command-generate:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .command-settings {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .command-chip {
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .command-chip:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .command-chip.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: #6366f1;
    color: #a5b4fc;
  }

  .command-chip strong {
    color: #fff;
  }

  .command-divider {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.1);
  }

  .command-grid {
    position: absolute;
    inset: 160px 20px 20px;
  }
</style>
