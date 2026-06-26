import type { Timestamp } from "firebase/firestore";

export type ProductType =
  | "physical-deck"
  | "sampler-pack"
  | "digital"
  | "guide"
  | "material";

export type ProductStatus = "active" | "draft" | "sold-out";

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: ProductType;
  readonly price: number;
  /** Only decks/samplers carry a card count; guides and materials don't. */
  readonly cardCount?: number;
  readonly deckId?: string;
  /** Empty until a Stripe Price is created for this product (set on publish). */
  readonly stripePriceId: string;
  readonly status: ProductStatus;
  readonly previewImageUrls: string[];
  readonly coverImageUrl?: string;
  /** True when the deck is sold ahead of printing; pairs with shipBy. From Stripe metadata. */
  readonly preorder?: boolean;
  /** Human ship-by label shown on pre-order products, e.g. "September 2026". From Stripe metadata. */
  readonly shipBy?: string;
  readonly sortOrder: number;
}

export interface Order {
  readonly id: string;
  readonly stripeSessionId: string;
  readonly stripePaymentIntentId: string;
  readonly customerEmail: string;
  readonly shippingAddress: ShippingAddress;
  readonly items: readonly OrderItem[];
  readonly totalAmount: number;
  readonly status: "paid" | "shipped" | "delivered";
  readonly createdAt: Timestamp;
  readonly shippedAt?: Timestamp;
  readonly trackingNumber?: string;
}

export interface OrderItem {
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

export interface ShippingAddress {
  readonly name: string;
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
}
