import Stripe from "stripe";
import { mapStripeProductToDoc } from "./productSync";

function product(overrides: Partial<Stripe.Product>): Stripe.Product {
  return {
    id: "prod_123",
    name: "8-Count Quartered Rotated Loops",
    description: "A deck.",
    active: true,
    images: ["https://img/cover.png", "https://img/sample.png"],
    metadata: {},
    ...overrides,
  } as Stripe.Product;
}

describe("mapStripeProductToDoc", () => {
  it("maps core fields and images", () => {
    const doc = mapStripeProductToDoc(product({}));
    expect(doc.name).toBe("8-Count Quartered Rotated Loops");
    expect(doc.status).toBe("active");
    expect(doc.coverImageUrl).toBe("https://img/cover.png");
    expect(doc.previewImageUrls).toEqual(["https://img/cover.png", "https://img/sample.png"]);
    expect(doc.type).toBe("physical-deck");
  });

  it("maps archived (inactive) products to draft", () => {
    expect(mapStripeProductToDoc(product({ active: false })).status).toBe("draft");
  });

  it("reads preorder='true' metadata as boolean true and carries shipBy", () => {
    const doc = mapStripeProductToDoc(
      product({ metadata: { preorder: "true", shipBy: "September 2026" } })
    );
    expect(doc.preorder).toBe(true);
    expect(doc.shipBy).toBe("September 2026");
  });

  it("omits preorder/shipBy when metadata absent", () => {
    const doc = mapStripeProductToDoc(product({}));
    expect(doc.preorder).toBeUndefined();
    expect(doc.shipBy).toBeUndefined();
  });

  it("parses numeric metadata (cardCount, sortOrder) and deckId", () => {
    const doc = mapStripeProductToDoc(
      product({ metadata: { cardCount: "128", sortOrder: "2", deckId: "l1-x", type: "guide" } })
    );
    expect(doc.cardCount).toBe(128);
    expect(doc.sortOrder).toBe(2);
    expect(doc.deckId).toBe("l1-x");
    expect(doc.type).toBe("guide");
  });
});
