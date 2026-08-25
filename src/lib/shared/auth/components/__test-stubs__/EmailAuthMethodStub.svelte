<script lang="ts">
  let { mode = $bindable("signin") }: { mode?: "signin" | "signup" } = $props();
</script>

<span data-mode={mode}>Auth method</span>
