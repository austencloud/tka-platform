<script lang="ts">
  import { page } from "$app/state";
  import ErrorScreen from "$lib/shared/foundation/ui/ErrorScreen.svelte";

  function handleRetry() {
    window.location.reload();
  }

  const errorMessage = $derived(
    page.error?.message ?? "Something went wrong"
  );
</script>

<ErrorScreen error={errorMessage} onRetry={handleRetry} />
