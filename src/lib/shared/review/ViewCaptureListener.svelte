<script lang="ts">
  /**
   * Global "copy this view" key handler.
   *
   * Mounted once in the root layout so P works on every route. Austen pressed P
   * on /browse/gallery and nothing happened, because the first version of this
   * lived on one dev route - which is not what "when I see something in the
   * app" means.
   *
   * A 3D scene that has registered a view source contributes its camera pose
   * and a frame. Everywhere else this captures the page: URL, viewport, scroll,
   * and whatever sits under the cursor.
   */
  import { onMount } from "svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import {
    captureCurrentView,
    trackPointer,
  } from "$lib/shared/review/view-capture";

  let busy = false;

  function isTypingTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.isContentEditable) return true;
    return /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName);
  }

  async function handleKeydown(event: KeyboardEvent) {
    if (event.code !== "KeyP" || event.repeat || busy) return;
    // Ctrl/Cmd+P is print, Alt+P belongs to the OS. Only a bare P is ours.
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;

    event.preventDefault();
    busy = true;
    try {
      const capture = await captureCurrentView();
      const failed = "frameError" in capture ? capture.frameError : undefined;
      toast.success(
        capture.delivery === "console"
          ? "View recorded in the browser console; clipboard was unavailable"
          : failed
            ? `View copied (no frame: ${failed})`
            : "View copied - paste to Claude",
        failed ? 5000 : 2500
      );
    } catch (error) {
      toast.error(
        `Copy view failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    // Passive: this only records coordinates so the capture knows what the
    // cursor was over.
    const onMove = (event: PointerEvent) => trackPointer(event);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  });
</script>

<svelte:window onkeydown={handleKeydown} />
