import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChangelogRichText from "./ChangelogRichText.svelte";

const navigation = vi.hoisted(() => ({
  goto: vi.fn<(_href: string) => Promise<void>>(),
}));

vi.mock("$app/navigation", () => ({
  goto: navigation.goto,
}));

describe("ChangelogRichText navigation", () => {
  beforeEach(() => {
    navigation.goto.mockReset();
    navigation.goto.mockResolvedValue();
  });

  it("client-routes an ordinary internal action without discarding its href", () => {
    const onNavigate = vi.fn();
    render(ChangelogRichText, {
      text: "Browse the new [Gallery](/browse/gallery).",
      onNavigate,
    });

    const link = document.querySelector<HTMLAnchorElement>("a.action-btn");
    expect(link).toBeInstanceOf(HTMLAnchorElement);
    expect(link!.getAttribute("href")).toBe("/browse/gallery");

    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    link!.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(navigation.goto).toHaveBeenCalledOnce();
    expect(navigation.goto).toHaveBeenCalledWith("/browse/gallery");
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("leaves modified internal clicks to the browser and keeps the host open", () => {
    const onNavigate = vi.fn();
    render(ChangelogRichText, {
      text: "Browse the new [Gallery](/browse/gallery).",
      onNavigate,
    });

    const link = document.querySelector<HTMLAnchorElement>("a.action-btn");
    expect(link).toBeInstanceOf(HTMLAnchorElement);

    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      ctrlKey: true,
    });
    link!.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
    expect(navigation.goto).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("keeps external actions as protected new-tab links", () => {
    render(ChangelogRichText, {
      text: "Read the [documentation](https://example.com/docs).",
    });

    const link = document.querySelector<HTMLAnchorElement>("a.action-btn");
    expect(link).toBeInstanceOf(HTMLAnchorElement);
    expect(link!.getAttribute("href")).toBe("https://example.com/docs");
    expect(link!.getAttribute("target")).toBe("_blank");
    expect(link!.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
