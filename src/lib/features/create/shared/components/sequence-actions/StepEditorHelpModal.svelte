<!--
  StepEditorHelpModal.svelte

  Help modal explaining step editor controls.
  Shows when user taps the help button in the step editor panel.
-->
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import ModalFooter from "$lib/shared/foundation/ui/modal/ModalFooter.svelte";
  import HelpSection from "$lib/shared/components/help/HelpSection.svelte";

  interface Props {
    show: boolean;
    onClose: () => void;
  }

  let { show = $bindable(), onClose }: Props = $props();

  // Control close with animation
  function handleClose() {
    show = false;
    setTimeout(onClose, 250);
  }

  // Use feature-edit theme variable for editing contexts
  const accentColor = "var(--feature-edit, #8b5cf6)";
</script>

<BaseModal
  bind:open={show}
  size="fit"
  animation="pop"
  onclose={handleClose}
  labelledBy="step-editor-help-title"
>
  {#snippet header()}
    <ModalHeader
      title="Step Editor"
      subtitle="Edit individual steps in your sequence"
      icon="fa-sliders-h"
      iconColor={accentColor}
      onClose={handleClose}
      id="step-editor-help-title"
    />
  {/snippet}

  <div class="help-content">
    <HelpSection icon="fa-redo" title="Turns" {accentColor}>
      <p>Controls how many rotations each prop makes during this beat.</p>
      <ul>
        <li><strong>fl</strong> — Float: prop stays still, hand moves</li>
        <li><strong>0</strong> — No rotation</li>
        <li><strong>0.5</strong> — Half turn (180°)</li>
        <li><strong>1</strong> — Full turn (360°)</li>
        <li><strong>2-3</strong> — Multiple rotations</li>
      </ul>
    </HelpSection>

    <HelpSection icon="fa-sync-alt" title="Rotation" {accentColor}>
      <p>Direction the prop spins. Only visible when turns > 0.</p>
      <ul>
        <li><strong>CW</strong> — Clockwise rotation</li>
        <li><strong>CCW</strong> — Counter-clockwise rotation</li>
      </ul>
    </HelpSection>

    <HelpSection icon="fa-compass" title="Orientation" {accentColor}>
      <p>For start positions, sets which way the props initially face.</p>
    </HelpSection>

    <HelpSection icon="fa-lightbulb" title="Tip" variant="tip">
      <p>
        Tap any beat in the grid above to quickly switch between them. Changes
        save automatically.
      </p>
    </HelpSection>
  </div>

  {#snippet footer()}
    <ModalFooter>
      <button class="secondary" onclick={handleClose}>Got it</button>
    </ModalFooter>
  {/snippet}
</BaseModal>

<style>
  .help-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
  }

  @media (max-width: 480px) {
    .help-content {
      padding: 16px;
      gap: 14px;
    }
  }
</style>
