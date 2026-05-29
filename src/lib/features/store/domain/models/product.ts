import type { Timestamp } from "firebase/firestore";

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: "physical-deck" | "sampler-pack" | "digital";
  readonly price: number;
  readonly cardCount: number;
  readonly deckId?: string;
  readonly stripePriceId: string;
  readonly status: "active" | "draft" | "sold-out";
  readonly previewImageUrls: string[];
  readonly coverImageUrl?: string;
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
