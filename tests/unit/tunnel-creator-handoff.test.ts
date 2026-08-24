import { beforeEach, describe, expect, it } from "vitest";
import type { CollectedTunnel } from "$lib/features/tunnel-collection/domain/tunnel-collection-types";
import {
  consumeTunnelCreatorHandoff,
  saveTunnelCreatorHandoff,
} from "$lib/features/create/tunnel/services/tunnel-creator-handoff";

const STORAGE_KEY = "tka:tunnel-creator-handoff";

function savedTunnel(): CollectedTunnel {
  return {
    id: "tunnel-42",
    name: "Four-person weave",
    composition: { performers: [] },
    snapshot: {
      tunnel: {
        config: {
          type: "helix",
          sections: 4,
        },
      },
    },
  } as unknown as CollectedTunnel;
}

describe("tunnel creator handoff", () => {
  beforeEach(() => sessionStorage.clear());

  it("carries the saved tunnel identity and editable formation exactly once", () => {
    saveTunnelCreatorHandoff(savedTunnel());

    expect(consumeTunnelCreatorHandoff()).toMatchObject({
      tunnelId: "tunnel-42",
      tunnelName: "Four-person weave",
      composition: { performers: [] },
      formation: { type: "helix", sections: 4 },
    });
    expect(consumeTunnelCreatorHandoff()).toBeNull();
  });

  it("rejects an incomplete persisted handoff", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tunnelId: "tunnel-42", tunnelName: "Broken" })
    );

    expect(consumeTunnelCreatorHandoff()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
