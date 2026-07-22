<script lang="ts">
  import BaseModal from "./BaseModal.svelte";
</script>

<BaseModal
  open={true}
  size="fit"
  animation="none"
  labelledBy="base-modal-test-title"
>
  <h2 id="base-modal-test-title">Scrollable modal</h2>
  <div class="tall-content" aria-hidden="true"></div>
  <button type="button">End of modal</button>
</BaseModal>

<style>
  h2 {
    margin: 0;
  }

  .tall-content {
    height: 1200px;
  }
</style>
