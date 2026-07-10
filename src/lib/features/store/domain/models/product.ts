import type { Timestamp } from "firebase/firestore";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export type ProductType =
  | "physical-deck"
  | "sampler-pack"
  | "digital"
  | "guide"
  | "material";

export type ProductStatus = "active" | "draft" | "sold-out";

/** One cover card: the sequence plus the frame styling the printed card gets
 *  (TnD element accent for trilogy decks, LOOP flavor color for LOOP decks). */
export interface CoverCard {
  readonly sequence: SequenceData;
  /** Frame accent color. Neutral print gray when absent. */
  readonly accentColor?: string;
  readonly darkComplement?: string;
  /** Card interior tint opacity (TnD elements carry a tuned value). */
  readonly tintOpacity?: number;
  /** Footer element icon (TnD decks). */
  readonly iconPath?: string;
  /** Footer center label (e.g. "Split-Same" or "Rotated LOOP"). */
  readonly footerCenter?: string;
  /** Baked render of this card front (Firebase Storage URL). When present the
   *  fan loads this image directly instead of running the print pipeline in
   *  the visitor's browser. Written by the admin cover bake. */
  readonly imageUrl?: string;
}

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
  /** A representative sequence (steps) from the deck, embedded so the grid card
   *  renders its tip-path mandala cover without a second Firestore read. Decks only. */
  readonly coverSequence?: { steps: unknown[] };
  /** Curated cover cards (full sequence doc + frame accent/footer), rendered
   *  through the REAL print pipeline as a fan. Takes precedence over
   *  coverSequence. Decks only. */
  readonly coverCards?: CoverCard[];
  /** LOOP component ids for this deck's flavor (enum string values, e.g.
   *  ["mirrored","swapped"]) — drives the color-coded chips. */
  readonly loopComponents?: string[];
  /** Products sharing a listing collapse into ONE storefront entry (the deck
   *  configurator). They stay individually purchasable backing SKUs. */
  readonly listing?: string;
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
