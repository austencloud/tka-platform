<!--
  DosBootSequence - POST text animation for the DOS terminal.

  Writes boot text line-by-line with delays to simulate a BIOS POST sequence.
  Click or keypress skips to a condensed version. Calls oncomplete() when the
  sequence finishes (naturally or via skip).

  Domain: Retro DOS Terminal
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { terminalState } from "../state/terminal-state.svelte";
  import { getAllLore } from "../../shared/lore/order-references";
  import type { DosColor } from "../domain/dos-types";

  interface Props {
    oncomplete: () => void;
  }

  let { oncomplete }: Props = $props();

  /* Boot line definitions                                               */

  interface BootLine {
    readonly text: string;
    readonly delay: number;
    readonly color?: DosColor;
  }

  const startupLore = getAllLore("dos", "startup");

  const BOOT_LINES: BootLine[] = [
    { text: "", delay: 300 },
    { text: startupLore[0] ?? "BELLWEATHER TECHNICAL INSTITUTE", delay: 100, color: "white" },
    { text: "NOTATION SYSTEM BIOS v1.0", delay: 100 },
    { text: "", delay: 200 },
    { text: "640K System RAM..................OK", delay: 400 },
    { text: "Extended Memory.................384K", delay: 300 },
    { text: "Notation Co-processor...........DETECTED", delay: 200 },
    { text: "", delay: 300 },
    { text: "Loading notation drivers:", delay: 200 },
    { text: "  KINETIC.SYS     [OK]", delay: 250 },
    { text: "  SPIRAL.DRV      [OK]", delay: 200 },
    { text: "  NOTATION.DLL    [OK]", delay: 200 },
    { text: "  PROP.SYS        [OK]", delay: 250 },
    { text: "  GRID.DRV        [OK]", delay: 150 },
    { text: "", delay: 300 },
    { text: startupLore[2] ?? "ORDER DIRECTIVE 7 COMPLIANCE CHECK... PASSED", delay: 600, color: "white" },
    { text: "", delay: 200 },
    { text: startupLore[1] ?? "TKAUTIL.COM - Notation Utility v1.0", delay: 100 },
    { text: "Authorized for use by Order-approved personnel only.", delay: 100 },
    { text: "", delay: 400 },
  ];

  /* Skip control                                                        */

  let skipRequested = false;

  function requestSkip(): void {
    skipRequested = true;
  }

  /* Boot sequence runner                                                */

  onMount(() => {
    let cancelled = false;

    async function runBoot(): Promise<void> {
      for (const line of BOOT_LINES) {
        if (cancelled || skipRequested) break;
        await new Promise<void>((resolve) => setTimeout(resolve, line.delay));
        if (cancelled || skipRequested) break;

        if (line.color) {
          terminalState.writeLine(line.text, line.color);
        } else {
          terminalState.writeLine(line.text);
        }
      }

      // If skipped, show a condensed boot summary instead
      if (skipRequested && !cancelled) {
        terminalState.clear();
        terminalState.writeLine(
          startupLore[0] ?? "BELLWEATHER TECHNICAL INSTITUTE",
          "white",
        );
        terminalState.writeLine(
          startupLore[1] ?? "TKAUTIL.COM - Notation Utility v1.0",
        );
        terminalState.writeLine(
          startupLore[2] ?? "ORDER DIRECTIVE 7 COMPLIANCE CHECK... PASSED",
          "white",
        );
        terminalState.writeBlank();
      }

      if (!cancelled) {
        oncomplete();
      }
    }

    runBoot();

    return () => {
      cancelled = true;
    };
  });
</script>

<!-- Skip triggers - click or any keypress during boot -->
<svelte:window onclick={requestSkip} onkeydown={requestSkip} />
