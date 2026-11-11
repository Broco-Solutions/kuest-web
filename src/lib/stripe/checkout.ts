import "server-only";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { products, type Product } from "../../data/products";
import { CheckoutError, getCheckoutConfig } from "./config";

export const STORE_ID = "kuest-electric-v1";
export const CURRENCY = "usd";
export const priceLookupKey = (slug: string) => `kuest_${slug}`;

export function parsePurchase(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CheckoutError(400, "Please select a model from our collection.");
  }
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !["productSlug", "requestId"].includes(key)) ||
      typeof data.productSlug !== "string" || typeof data.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId)) {
    throw new CheckoutError(400, "Please select a model from our collection and try again.");
  }
  const product = products.find((item) => item.slug === data.productSlug);
  if (!product) throw new CheckoutError(400, "This model is not available.");
  return { product, requestId: data.requestId };
}

export function validatePrice(price: Stripe.Price, product: Product, livemode: boolean, taxMode: string) {
  const stripeProduct = price.product;
  if (!price.active || price.livemode !== livemode || price.type !== "one_time" ||
      price.billing_scheme !== "per_unit" || price.currency !== CURRENCY ||
      price.unit_amount !== Math.round(product.price * 100) ||
      price.custom_unit_amount || price.transform_quantity || price.lookup_key !== priceLookupKey(product.slug) ||
      typeof stripeProduct === "string" || "deleted" in stripeProduct ||
      !stripeProduct.active || stripeProduct.metadata.kuest_slug !== product.slug ||
      (taxMode === "included" ? price.tax_behavior !== "inclusive" :
        !["inclusive", "exclusive"].includes(price.tax_behavior ?? ""))) {
    throw new CheckoutError(503, "This model is currently unavailable for online purchase. Please visit our showroom.");
  }
}

export async function createCheckout(stripe: Stripe, product: Product, requestId: string) {
  const config = getCheckoutConfig();
  const prices = await stripe.prices.list({
    lookup_keys: [priceLookupKey(product.slug)], active: true, limit: 2, expand: ["data.product"],
  });
  if (prices.data.length !== 1) {
    throw new CheckoutError(503, "This model is currently unavailable for online purchase. Please visit our showroom.");
  }
  const price = prices.data[0];
  validatePrice(price, product, config.livemode, config.taxMode);
  const metadata = {
    kuest_store: STORE_ID,
    kuest_product_slug: product.slug,
    kuest_unit_amount: String(price.unit_amount),
    kuest_price_id: price.id,
    kuest_fulfillment: "showroom_pickup",
    kuest_tax_mode: config.taxMode,
  };
  const params: Stripe.Checkout.SessionCreateParams = {
    ui_mode: "hosted_page",
    mode: "payment",
    line_items: [{ price: price.id, quantity: 1 }],
    allowed_payment_method_types: ["card"],
    billing_address_collection: "required",
    automatic_tax: { enabled: config.taxMode === "automatic" },
    adaptive_pricing: { enabled: false },
    client_reference_id: requestId,
    metadata,
    payment_intent_data: { metadata },
    success_url: `${config.siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.siteUrl}/checkout/cancel`,
    custom_text: { submit: { message: "Showroom pickup only at 8330 Biscayne Blvd, Unit A, Miami. Please bring your payment confirmation and ID. Shipping is not included." } },
  };
  // Same request + purchase/configuration produces the same Session on network retries.
  const fingerprint = createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0, 32);
  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: `kuest-${requestId}-${fingerprint}`,
  });
  if (!session.url || new URL(session.url).origin !== "https://checkout.stripe.com") {
    throw new CheckoutError(502, "We could not open secure checkout. Please try again.");
  }
  return session.url;
}

export function isKuestSession(session: Stripe.Checkout.Session, livemode: boolean) {
  return session.metadata?.kuest_store === STORE_ID && session.mode === "payment" &&
    session.livemode === livemode;
}

export type PaymentState = "paid" | "pending" | "failed" | "expired" | "open";
export function paymentState(session: Stripe.Checkout.Session): PaymentState {
  if (session.status === "complete" && session.payment_status === "paid") return "paid";
  if (session.status === "expired") return "expired";
  if (session.metadata?.kuest_async_failed === "true") return "failed";
  return session.status === "complete" ? "pending" : "open";
}

// Validate the immutable purchase snapshot, not today's catalog price, on old payments.
export async function validatePaidSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  const slug = session.metadata?.kuest_product_slug;
  const unitAmount = Number(session.metadata?.kuest_unit_amount);
  if (!products.some((product) => product.slug === slug) || !Number.isSafeInteger(unitAmount) || unitAmount <= 0 ||
      session.currency !== CURRENCY || session.amount_subtotal !== unitAmount ||
      session.amount_total === null || session.amount_total < unitAmount ||
      session.total_details?.amount_discount !== 0 || session.total_details?.amount_shipping !== 0 ||
      session.metadata?.kuest_fulfillment !== "showroom_pickup") {
    throw new Error("Invalid purchase snapshot");
  }
  const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
  if (lines.has_more || lines.data.length !== 1 || lines.data[0].quantity !== 1 ||
      lines.data[0].price?.id !== session.metadata?.kuest_price_id ||
      lines.data[0].price?.unit_amount !== unitAmount || lines.data[0].currency !== CURRENCY) {
    throw new Error("Invalid purchase line items");
  }
}
