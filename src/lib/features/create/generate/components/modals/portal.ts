/**
 * Portal utility for rendering modals at document.body level
 * This ensures modals appear above all other content regardless of stacking context
 */

import { onMount } from "svelte";

/**
 * Action to mount an element directly to document.body
 * Usage: <div use:portal>...</div>
 */
export function portal(node: HTMLElement) {
  // Move the node to document.body
  document.body.appendChild(node);

  return {
    destroy() {
      // Clean up when component unmounts
      if (node.parentNode === document.body) {
        document.body.removeChild(node);
      }
    },
  };
}

/**
 * Hook to use in modal components for proper portal rendering
 */
export function useModalPortal() {
  let portalTarget: HTMLElement | undefined;

  onMount(() => {
    // Create a container at body level
    portalTarget = document.createElement("div");
    portalTarget.className = "modal-portal";
    document.body.appendChild(portalTarget);

    return () => {
      // Cleanup
      if (portalTarget && document.body.contains(portalTarget)) {
        document.body.removeChild(portalTarget);
      }
    };
  });

  return {
    get portalTarget() {
      return portalTarget;
    },
  };
}
