<!--
  DeveloperTab.svelte - Developer Tools & Cache Diagnostics

  Provides tools for debugging auth issues and clearing caches
-->
<script lang="ts">
  import {
    diagnoseCacheState,
    nuclearCacheClear,
    type CacheDiagnostics,
  } from "../../../auth/utils/nuclearCacheClear";
  import { auth } from "../../../auth/firebase";
  import { onMount } from "svelte";

  let diagnostics = $state<CacheDiagnostics | null>(null);
  let loading = $state(false);
  let clearing = $state(false);
  let showCacheDiagnostics = $state(false);
  let hmrEnabled = $state(true);

  async function runDiagnostics() {
    loading = true;
    try {
      diagnostics = await diagnoseCacheState();
    } catch (error) {
      console.error("Failed to run diagnostics:", error);
      alert("Failed to run diagnostics. Check console.");
    } finally {
      loading = false;
    }
  }

  async function clearCache() {
    if (
      !confirm(
        "⚠️ NUCLEAR CACHE CLEAR ⚠️\n\n" +
          "This will:\n" +
          "• Delete ALL IndexedDB databases\n" +
          "• Clear ALL localStorage\n" +
          "• Clear ALL sessionStorage\n" +
          "• Delete ALL cookies\n" +
          "• Clear ALL service worker caches\n\n" +
          "The page will reload after clearing.\n\n" +
          "Continue?"
      )
    ) {
      return;
    }

    clearing = true;
    try {
      await nuclearCacheClear();

      // Wait a moment then reload
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Failed to clear cache:", error);
      alert("Failed to clear cache. Check console.");
      clearing = false;
    }
  }

  function copyDiagnostics() {
    if (!diagnostics) return;

    const text = `
📦 CACHE DIAGNOSTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 Firebase Config:
  Project: ${auth.app.options.projectId}
  Auth Domain: ${auth.app.options.authDomain}

📦 IndexedDB Databases (${diagnostics.indexedDBDatabases.length}):
${diagnostics.indexedDBDatabases.map((db) => `  • ${db}`).join("\n") || "  (none)"}

🗄️ localStorage Keys (${diagnostics.localStorageKeys.length}):
${diagnostics.localStorageKeys
  .slice(0, 20)
  .map((key) => `  • ${key}`)
  .join("\n")}
${diagnostics.localStorageKeys.length > 20 ? `  ... and ${diagnostics.localStorageKeys.length - 20} more` : ""}

📋 sessionStorage Keys (${diagnostics.sessionStorageKeys.length}):
${diagnostics.sessionStorageKeys.map((key) => `  • ${key}`).join("\n") || "  (none)"}

🍪 Cookies (${diagnostics.cookies.length}):
${diagnostics.cookies
  .slice(0, 20)
  .map((c) => `  • ${c}`)
  .join("\n")}
${diagnostics.cookies.length > 20 ? `  ... and ${diagnostics.cookies.length - 20} more` : ""}

🚨 OLD PROJECT CHECK:
${
  diagnostics.indexedDBDatabases.some((db) =>
    db.includes("the-kinetic-constructor")
  )
    ? "  ⚠️ OLD PROJECT DATABASE DETECTED! This WILL cause auth issues!"
    : "  ✅ No old project databases found"
}
    `.trim();

    navigator.clipboard.writeText(text);
    alert("Diagnostics copied to clipboard!");
  }

  function toggleHMR() {
    // Note: hmrEnabled is already toggled by bind:checked, so don't toggle it again
    localStorage.setItem("dev-hmr-enabled", String(hmrEnabled));

    if (import.meta.hot) {
      // Force a full reload to apply HMR preference
      // Note: Vite doesn't support dynamically enabling/disabling HMR
      window.location.reload();
    }
  }

  onMount(() => {
    // Load HMR preference from localStorage
    const savedHMR = localStorage.getItem("dev-hmr-enabled");
    hmrEnabled = savedHMR !== "false"; // Default to true

    // Note: HMR preference is applied on next page load
    // Vite doesn't support dynamically disabling HMR after initial load
  });
</script>

<div class="developer-tab">
  <div class="section">
    <h3>🛠️ Developer Tools</h3>
    <p class="description">
      Advanced tools for debugging and cache management.
    </p>

    <!-- HMR Toggle -->
    <div class="setting-card">
      <div class="setting-header">
        <div class="setting-info">
          <h4>🔥 Hot Module Replacement</h4>
          <p class="setting-description">
            Auto-reload code changes without refreshing the entire page
          </p>
        </div>
        <label class="developer-setting-toggle">
          <input
            type="checkbox"
            bind:checked={hmrEnabled}
            onchange={toggleHMR}
            aria-label="Toggle Hot Module Replacement"
          />
          <span class="slider"></span>
        </label>
      </div>
      <div class="setting-status" class:active={hmrEnabled}>
        {#if hmrEnabled}
          <i class="fas fa-fire" aria-hidden="true"></i>
          <span>Active - Changes will hot-reload</span>
        {:else}
          <i class="fas fa-snowflake" aria-hidden="true"></i>
          <span>Disabled - Manual refresh required</span>
        {/if}
      </div>
    </div>

    <!-- Cache Diagnostics Toggle -->
    <button
      class="diagnostics-toggle"
      onclick={() => {
        showCacheDiagnostics = !showCacheDiagnostics;
        if (showCacheDiagnostics && !diagnostics) {
          runDiagnostics();
        }
      }}
    >
      <i
        class="fas fa-{showCacheDiagnostics ? 'chevron-down' : 'chevron-right'}"
        aria-hidden="true"
      ></i>
      <span>🔧 Cache Diagnostics</span>
      {#if !showCacheDiagnostics}
        <span class="hint">(Click to expand)</span>
      {/if}
    </button>

    {#if showCacheDiagnostics}
      <div class="diagnostics-content">
        <div class="firebase-config">
          <h4>Current Firebase Project</h4>
          <div class="config-item">
            <span class="label">Project ID:</span>
            <code>{auth.app.options.projectId}</code>
          </div>
          <div class="config-item">
            <span class="label">Auth Domain:</span>
            <code>{auth.app.options.authDomain}</code>
          </div>
        </div>

        {#if diagnostics}
          <div class="diagnostics-summary">
            <div class="summary-item">
              <span class="label">IndexedDB Databases:</span>
              <span class="value">{diagnostics.indexedDBDatabases.length}</span>
            </div>
            <div class="summary-item">
              <span class="label">localStorage Keys:</span>
              <span class="value">{diagnostics.localStorageKeys.length}</span>
            </div>
            <div class="summary-item">
              <span class="label">sessionStorage Keys:</span>
              <span class="value">{diagnostics.sessionStorageKeys.length}</span>
            </div>
            <div class="summary-item">
              <span class="label">Cookies:</span>
              <span class="value">{diagnostics.cookies.length}</span>
            </div>
          </div>

          {#if diagnostics.indexedDBDatabases.some( (db) => db.includes("the-kinetic-constructor") )}
            <div class="alert alert-error" role="alert">
              <strong>🚨 OLD PROJECT DETECTED!</strong>
              <p>
                Old "the-kinetic-constructor" database found. This WILL cause
                authentication failures.
              </p>
              <p>Click "Nuclear Cache Clear" below to fix this.</p>
            </div>
          {/if}

          <details class="diagnostics-details">
            <summary>View Detailed Storage</summary>

            <div class="storage-section">
              <h5>📦 IndexedDB Databases</h5>
              {#if diagnostics.indexedDBDatabases.length > 0}
                <ul>
                  {#each diagnostics.indexedDBDatabases as db}
                    <li
                      class:old-project={db.includes("the-kinetic-constructor")}
                    >
                      {db}
                      {#if db.includes("the-kinetic-constructor")}
                        <span class="dev-status-badge dev-status-badge-error">OLD PROJECT</span>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="empty">No databases</p>
              {/if}
            </div>

            <div class="storage-section">
              <h5>🗄️ localStorage Keys</h5>
              {#if diagnostics.localStorageKeys.length > 0}
                <ul>
                  {#each diagnostics.localStorageKeys.slice(0, 50) as key}
                    <li>{key}</li>
                  {/each}
                  {#if diagnostics.localStorageKeys.length > 50}
                    <li class="more">
                      ... and {diagnostics.localStorageKeys.length - 50} more
                    </li>
                  {/if}
                </ul>
              {:else}
                <p class="empty">No keys</p>
              {/if}
            </div>
          </details>
        {/if}

        <div class="actions">
          <button
            class="btn btn-secondary"
            onclick={runDiagnostics}
            disabled={loading}
          >
            {loading ? "Scanning..." : "🔍 Refresh Diagnostics"}
          </button>

          {#if diagnostics}
            <button class="btn btn-secondary" onclick={copyDiagnostics}>
              📋 Copy Diagnostics
            </button>
          {/if}

          <button
            class="btn btn-danger"
            onclick={clearCache}
            disabled={clearing}
          >
            {clearing ? "Clearing..." : "💣 Nuclear Cache Clear"}
          </button>
        </div>

        <div class="help-text">
          <p>
            <strong>When to use Nuclear Cache Clear:</strong>
          </p>
          <ul>
            <li>
              Authentication redirects fail after returning from Google/Facebook
            </li>
            <li>Old project database detected (see alert above)</li>
            <li>App stuck on "Setting up services..."</li>
            <li>White screen or infinite loading</li>
          </ul>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .developer-tab {
    padding: 20px;
    max-width: 800px;
  }

  .section {
    margin-bottom: 32px;
  }

  h3 {
    font-size: var(--font-size-xl);
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--theme-text);
  }

  h4 {
    font-size: var(--font-size-base);
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--theme-text, var(--theme-text));
  }

  h5 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--theme-text);
  }

  .description {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin-bottom: 20px;
  }

  /* HMR Toggle Setting Card */
  .setting-card {
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
  }

  .setting-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 16px;
  }

  .setting-info {
    flex: 1;
  }

  .setting-info h4 {
    margin: 0 0 6px 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
  }

  .setting-description {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    line-height: 1.4;
  }

  /* Toggle Switch */
  .developer-setting-toggle {
    position: relative;
    display: inline-block;
    width: var(--min-touch-target);
    height: 28px;
    flex-shrink: 0;
  }

  .developer-setting-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--theme-stroke-strong);
    transition: var(--duration-emphasis);
    border-radius: 28px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: var(--duration-emphasis);
    border-radius: 50%;
  }

  input:checked + .slider {
    background: linear-gradient(135deg, #f97316, #ea580c);
    box-shadow: 0 0 12px rgba(249, 115, 22, 0.5);
  }

  input:checked + .slider:before {
    transform: translateX(24px);
  }

  input:focus + .slider {
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.3);
  }

  /* Setting Status */
  .setting-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--theme-card-bg);
    border-radius: 8px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .setting-status.active {
    background: rgba(249, 115, 22, 0.1);
    color: #f97316;
  }

  .setting-status i {
    font-size: var(--font-size-sm);
  }

  .diagnostics-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 1rem;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    color: var(--theme-text, var(--theme-text));
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    margin-bottom: 1rem;
  }

  .diagnostics-toggle:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .diagnostics-toggle i {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .diagnostics-toggle .hint {
    margin-left: auto;
    font-size: 0.875rem;
    opacity: 0.5;
  }

  .diagnostics-content {
    padding: 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .firebase-config {
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .config-item {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .config-item:last-child {
    margin-bottom: 0;
  }

  .label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    min-width: 100px;
  }

  code {
    background: var(--theme-panel-bg);
    padding: 4px 8px;
    border-radius: 4px;
    font-family: "Consolas", "Monaco", monospace;
    font-size: var(--font-size-compact);
    color: var(--theme-text);
  }

  .diagnostics-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .summary-item {
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 6px;
    padding: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .summary-item .label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .summary-item .value {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  .alert {
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 2px solid rgba(239, 68, 68, 0.5);
  }

  .alert strong {
    display: block;
    margin-bottom: 8px;
    color: var(--semantic-error);
  }

  .alert p {
    font-size: var(--font-size-sm);
    color: var(--theme-text, var(--theme-text));
    margin-bottom: 4px;
  }

  .diagnostics-details {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .diagnostics-details summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--theme-text, var(--theme-text));
    user-select: none;
  }

  .diagnostics-details summary:hover {
    color: var(--theme-text);
  }

  .storage-section {
    margin-top: 16px;
  }

  .storage-section ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .storage-section li {
    padding: 6px 12px;
    background: var(--theme-card-bg);
    border-radius: 4px;
    margin-bottom: 4px;
    font-family: "Consolas", "Monaco", monospace;
    font-size: var(--font-size-compact);
    color: var(--theme-text);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .storage-section li.old-project {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--semantic-error);
  }

  .storage-section li.more {
    background: none;
    border: none;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-style: italic;
  }

  .dev-status-badge {
    font-size: var(--font-size-compact);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }

  .dev-status-badge-error {
    background: var(--semantic-error);
    color: white;
  }

  .empty {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-style: italic;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
  }

  .btn {
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 600;
    font-size: var(--font-size-sm);
    border: none;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--theme-card-hover-bg);
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
  }

  .btn-danger {
    background: var(--semantic-error);
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--semantic-error);
  }

  .help-text {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
    padding: 16px;
  }

  .help-text strong {
    color: var(--semantic-info);
    display: block;
    margin-bottom: 8px;
  }

  .help-text ul {
    margin: 0;
    padding-left: 20px;
  }

  .help-text li {
    font-size: var(--font-size-compact);
    color: var(--theme-text);
    margin-bottom: 4px;
  }

  @media (max-width: 600px) {
    .developer-tab {
      padding: 16px;
    }

    .actions {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }
</style>
