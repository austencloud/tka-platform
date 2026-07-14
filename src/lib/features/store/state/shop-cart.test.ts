// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createShopCart, type CartLine } from "./shop-cart.svelte";

const poster: CartLine = {
  kind: "sku", productId: "poster_a", name: "Mandala Poster",
  unitPrice: 2500, stripePriceId: "price_poster", qty: 1,
};
const deck = (id: string): CartLine => ({
  kind: "loopDeck", productId: "loop_deck", name: "LOOP Deck",
  unitPrice: 3000, stripePriceId: "price_deck", qty: 1,
  propType: "staff", loopConfig: { pack: "mild" }, configKey: id,
});

describe("createShopCart", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty", () => {
    const cart = createShopCart();
    expect(cart.lines).toEqual([]);
    expect(cart.count).toBe(0);
    expect(cart.subtotal).toBe(0);
  });

  it("adds a SKU and reflects count + subtotal", () => {
    const cart = createShopCart();
    cart.add(poster);
    expect(cart.count).toBe(1);
    expect(cart.subtotal).toBe(2500);
  });

  it("dedupes a re-added SKU by bumping quantity, not adding a line", () => {
    const cart = createShopCart();
    cart.add(poster);
    cart.add(poster);
    expect(cart.lines.length).toBe(1);
    expect(cart.lines[0]!.qty).toBe(2);
    expect(cart.subtotal).toBe(5000);
  });

  it("keeps distinct configured decks as separate lines (never deduped)", () => {
    const cart = createShopCart();
    cart.add(deck("cfg1"));
    cart.add(deck("cfg2"));
    expect(cart.lines.length).toBe(2);
  });

  it("locks configured-deck quantity to 1 even if setQty asks for more", () => {
    const cart = createShopCart();
    cart.add(deck("cfg1"));
    cart.setQty(cart.lines[0]!.key, 5);
    expect(cart.lines[0]!.qty).toBe(1);
  });

  it("clamps SKU quantity to >= 1 and removes on 0", () => {
    const cart = createShopCart();
    cart.add(poster);
    cart.setQty(cart.lines[0]!.key, 0);
    expect(cart.lines.length).toBe(0);
  });

  it("persists across instances via localStorage", () => {
    const a = createShopCart();
    a.add(poster);
    const b = createShopCart();
    expect(b.count).toBe(1);
    expect(b.lines[0]!.productId).toBe("poster_a");
  });

  it("clears everything", () => {
    const cart = createShopCart();
    cart.add(poster);
    cart.clear();
    expect(cart.count).toBe(0);
  });

  it("exports checkout items in the callable's shape", () => {
    const cart = createShopCart();
    cart.add(poster);
    cart.add(deck("cfg1"));
    expect(cart.toCheckoutItems()).toEqual([
      { productId: "poster_a", quantity: 1 },
      { productId: "loop_deck", quantity: 1, propType: "staff", loopConfig: { pack: "mild" } },
    ]);
  });
});
