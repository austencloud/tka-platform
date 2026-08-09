import { beforeEach, describe, expect, it } from "vitest";
import { shouldSequenceViewerDeferEscape } from "$lib/shared/sequence-viewer/domain/sequence-viewer-escape-ownership";

function escapeEvent(): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
}

function setActiveElement(document: Document, element: Element): void {
  Object.defineProperty(document, "activeElement", {
    configurable: true,
    value: element,
  });
}

let testDocument: Document;

beforeEach(() => {
  testDocument = document.implementation.createHTMLDocument();
});

describe("sequence viewer Escape ownership", () => {
  it("defers to a focused word or overflow menu", () => {
    const menu = testDocument.createElement("div");
    menu.setAttribute("role", "menu");
    menu.tabIndex = -1;
    testDocument.body.append(menu);
    setActiveElement(testDocument, menu);

    expect(shouldSequenceViewerDeferEscape(escapeEvent(), testDocument)).toBe(
      true
    );
  });

  it("defers to a nested modal above a standalone viewer", () => {
    const shell = testDocument.createElement("main");
    shell.setAttribute("data-sequence-viewer-shell", "");
    testDocument.body.append(shell);

    const shareDialog = testDocument.createElement("section");
    shareDialog.setAttribute("role", "dialog");
    shareDialog.setAttribute("aria-modal", "true");
    shareDialog.tabIndex = -1;
    testDocument.body.append(shareDialog);
    setActiveElement(testDocument, shareDialog);

    expect(shouldSequenceViewerDeferEscape(escapeEvent(), testDocument)).toBe(
      true
    );
  });

  it("does not mistake the host Drawer for nested UI", () => {
    const drawer = testDocument.createElement("section");
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.tabIndex = -1;
    const shell = testDocument.createElement("main");
    shell.setAttribute("data-sequence-viewer-shell", "");
    drawer.append(shell);
    testDocument.body.append(drawer);
    setActiveElement(testDocument, drawer);

    expect(shouldSequenceViewerDeferEscape(escapeEvent(), testDocument)).toBe(
      false
    );
  });

  it("leaves a bare route-level Escape to the viewer", () => {
    const shell = testDocument.createElement("main");
    shell.setAttribute("data-sequence-viewer-shell", "");
    shell.tabIndex = -1;
    testDocument.body.append(shell);
    setActiveElement(testDocument, shell);

    expect(shouldSequenceViewerDeferEscape(escapeEvent(), testDocument)).toBe(
      false
    );
  });
});
