<!--
  RetroUpgrade — UPGRADE.EXE Shareware Nag Dialog

  Classic shareware registration nag screen. Warning icon + text block
  with serial number, feature list, and three action buttons.
  Styled as a system dialog: gray background, etched border, centered.

  Domain: Retro UPGRADE App
-->
<script lang="ts">
  import RetroButton from "../../primitives/RetroButton.svelte";
  import RetroStatusBar from "../../primitives/RetroStatusBar.svelte";
  import { RETRO_ICONS } from "../../rendering/retro-icons";

  /* ------------------------------------------------------------------ */
  /* Props                                                               */
  /* ------------------------------------------------------------------ */

  let {
    onclose,
  }: {
    onclose?: () => void;
  } = $props();

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  let statusText = $state("Unregistered copy");
  let registering = $state(false);

  /* ------------------------------------------------------------------ */
  /* Feature list                                                        */
  /* ------------------------------------------------------------------ */

  const FEATURES = [
    "Unlimited sequence generation",
    'Export to 3\u00BD" floppy',
    "Advanced defragmentation",
    "Staff Clippy assistant",
    "Remove this dialog",
  ];

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  function handleRegister() {
    registering = true;
    statusText = "Connecting to Bellweather registration server...";

    setTimeout(() => {
      statusText = "Connection timed out.";
    }, 2000);
  }

  function handleRemindLater() {
    onclose?.();
  }

  function handleContinue() {
    onclose?.();
  }

  /* ------------------------------------------------------------------ */
  /* Status bar                                                          */
  /* ------------------------------------------------------------------ */

  const statusPanels = $derived([{ text: statusText }]);
</script>

<div class="upgrade-shell">
  <div class="upgrade-content">
    <div class="upgrade-dialog">
      <!-- Warning icon -->
      <div class="upgrade-icon" aria-hidden="true">{@html RETRO_ICONS.warning}</div>

      <!-- Text block -->
      <div class="upgrade-text">
        <div class="upgrade-heading">UNREGISTERED COPY</div>

        <p class="upgrade-para">
          This copy of TKA-OS has been used 47 times
          without registration.
        </p>

        <p class="upgrade-para">
          To unlock all features, please send $29.95
          (check or money order) to:
        </p>

        <div class="upgrade-address">
          <div>Bellweather Technical Institute</div>
          <div>Attn: Software Registration Dept.</div>
          <div class="upgrade-redacted">[ADDRESS REDACTED BY ORDER OF THE INSTITUTE]</div>
        </div>

        <div class="upgrade-serial">
          <span class="upgrade-serial-label">Include your Serial Number:</span>
          <span class="upgrade-serial-value">BTI-1995-TKA-OS-001</span>
        </div>

        <div class="upgrade-features">
          <div class="upgrade-features-label">
            Features unlocked with registration:
          </div>
          <ul class="upgrade-feature-list">
            {#each FEATURES as feature}
              <li class="upgrade-feature-item">
                <span class="upgrade-check">\u2713</span> {feature}
              </li>
            {/each}
          </ul>
        </div>
      </div>
    </div>

    <!-- Buttons -->
    <div class="upgrade-buttons">
      <RetroButton
        label="Register Now"
        isDefault={true}
        onclick={handleRegister}
        disabled={registering}
      />
      <RetroButton
        label="Remind Me Later"
        onclick={handleRemindLater}
      />
      <RetroButton
        label="Continue Unregistered"
        onclick={handleContinue}
      />
    </div>
  </div>

  <!-- Status bar -->
  <div class="upgrade-statusbar">
    <RetroStatusBar panels={statusPanels} />
  </div>
</div>

<style>
  /* ------------------------------------------------------------------ */
  /* Shell layout                                                        */
  /* ------------------------------------------------------------------ */
  .upgrade-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--retro-button-face, #c0c0c0);
  }

  .upgrade-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 16px;
    gap: 16px;
    overflow: auto;
  }

  .upgrade-statusbar {
    flex-shrink: 0;
  }

  /* ------------------------------------------------------------------ */
  /* Dialog layout                                                       */
  /* ------------------------------------------------------------------ */
  .upgrade-dialog {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    border: 2px groove var(--retro-button-face, #c0c0c0);
    padding: 16px;
    background: var(--retro-button-face, #c0c0c0);
  }

  .upgrade-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    image-rendering: pixelated;
  }

  .upgrade-icon :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .upgrade-text {
    flex: 1;
    min-width: 0;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    line-height: 1.5;
  }

  /* ------------------------------------------------------------------ */
  /* Typography                                                          */
  /* ------------------------------------------------------------------ */
  .upgrade-heading {
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 8px;
    color: var(--retro-black, #000);
  }

  .upgrade-para {
    margin: 0 0 8px;
  }

  .upgrade-address {
    margin: 4px 0 8px 16px;
    font-style: italic;
  }

  .upgrade-redacted {
    color: var(--retro-disabled-text, #808080);
    font-style: italic;
  }

  .upgrade-serial {
    margin: 8px 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .upgrade-serial-label {
    color: var(--retro-black, #000);
  }

  .upgrade-serial-value {
    font-family: "Courier New", monospace;
    font-weight: bold;
    font-size: 12px;
    color: var(--retro-navy, #000080);
    letter-spacing: 0.5px;
  }

  /* ------------------------------------------------------------------ */
  /* Feature list                                                        */
  /* ------------------------------------------------------------------ */
  .upgrade-features {
    margin-top: 12px;
  }

  .upgrade-features-label {
    font-weight: bold;
    margin-bottom: 4px;
  }

  .upgrade-feature-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .upgrade-feature-item {
    padding: 1px 0;
  }

  .upgrade-check {
    color: #008000;
    font-weight: bold;
    margin-right: 4px;
  }

  /* ------------------------------------------------------------------ */
  /* Buttons                                                             */
  /* ------------------------------------------------------------------ */
  .upgrade-buttons {
    display: flex;
    justify-content: center;
    gap: 4px;
    flex-wrap: wrap;
  }
</style>
