import { describe, expect, it } from "vitest";
import { CREATE_TABS } from "$lib/shared/navigation/config/tab-definitions";
import {
  CREATE_METHOD_PRESENTATIONS,
  orderCreateMethods,
} from "$lib/features/create/shared/domain/create-method-presentations";

describe("Create method front-door presentations", () => {
  it("covers every registered creation method and nothing else", () => {
    const registered = CREATE_TABS.filter(
      (tab) => tab.metadata?.isCreationMethod === true
    )
      .map((tab) => tab.id)
      .sort();

    expect(Object.keys(CREATE_METHOD_PRESENTATIONS).sort()).toEqual(registered);
  });

  it("puts the four ordinary methods first and the admin method last", () => {
    expect(orderCreateMethods(CREATE_TABS).map((tab) => tab.id)).toEqual([
      "construct",
      "generate",
      "fuse",
      "tunnel",
      "assemble",
    ]);
  });
});
