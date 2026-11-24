import Stripe from "stripe";
import { products } from "@/data/products";
import { validateCart, type CartItem } from "@/lib/cart";
import { getCheckoutConfiguration, priceVariable } from "@/lib/commerce-config";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function createCheckout(request: Request, makeStripe = (key: string) => new Stripe(key, { maxNetworkRetries: 2, timeout: 15_000 })) {
  const config = getCheckoutConfiguration();
  if (!config) return json({ error: "Online checkout is temporarily unavailable. Please visit our showroom." }, 503);
  if (request.headers.get("origin") !== config.siteOrigin) return json({ error: "Invalid request origin." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ error: "Expected JSON." }, 415);
  const requestId = request.headers.get("idempotency-key");
  if (!requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return json({ error: "Invalid checkout request." }, 400);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return json({ error: "Request too large." }, 413);
  let input: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4096) return json({ error: "Request too large." }, 413);
    input = JSON.parse(raw);
  } catch { return json({ error: "Invalid request." }, 400); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "Invalid product." }, 400);
  const body = input as Record<string, unknown>;
  let items: CartItem[];
  try {
    // Retain support for cached single-product clients during deployment.
    const cart = "items" in body;
    if (Object.keys(body).some(key => !(cart ? ["items"] : ["slug", "color"]).includes(key))) throw new Error("Invalid checkout fields.");
    items = validateCart(cart ? body.items : [{ ...body, quantity: 1 }]);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid bag." }, 400); }
  const selections = items.map(item => ({ item, product: products.find(p => p.slug === item.slug)!, priceId: process.env[priceVariable(item.slug)]?.trim() }));
  if (selections.some(s => !s.priceId || !/^price_[A-Za-z0-9]+$/.test(s.priceId))) return json({ error: "A model in your bag is temporarily unavailable online." }, 503);

  try {
    const stripe = makeStripe(config.secretKey);
    for (const { product, priceId } of selections) {
      const price = await stripe.prices.retrieve(priceId!, { expand: ["product"] });
      const stripeProduct = price.product;
      // Reject stale, inclusive, recurring, or incorrectly mapped prices before charging.
      if (!price.active || price.livemode !== config.livemode || price.currency !== "usd" || price.type !== "one_time" ||
        price.unit_amount !== Math.round(product.price * 100) || price.tax_behavior !== "exclusive" ||
        typeof stripeProduct === "string" || stripeProduct.deleted || !stripeProduct.active || stripeProduct.name !== product.name
      ) return json({ error: "This model is temporarily unavailable online. Please visit our showroom." }, 503);
    }

    const metadata: Record<string, string> = {
      website: "kuest-electric", cart_version: "1",
      fulfillment: "showroom_pickup", checkout_mode: config.livemode ? "live" : "test",
    };
    items.forEach((item, index) => { metadata[`item_${index + 1}`] = JSON.stringify(item); });
    if (items.length === 1) { metadata.product_slug = items[0].slug; metadata.color = items[0].color ?? "Not specified"; }
    const selectedColors = items.filter(item => item.color).map(item => `${item.quantity} × ${products.find(p => p.slug === item.slug)!.name}: ${item.color}`).join("; ");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: selections.map(({ item, priceId }) => ({ price: priceId!, quantity: item.quantity })),
      automatic_tax: { enabled: false },
      billing_address_collection: "auto",
      phone_number_collection: { enabled: true },
      // Stripe selects methods enabled and eligible on the Kuest account, including Affirm.
      success_url: `${config.siteOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.siteOrigin}/cart`,
      custom_text: { submit: { message: `Showroom pickup only: 8330 Biscayne Blvd, Unit A, Miami, FL 33138. Wait for KUEST to confirm pickup readiness.${selectedColors ? ` Selected colors: ${selectedColors}.` : ""}` } },
      metadata, payment_intent_data: { metadata },
    }, { idempotencyKey: `kuest-${requestId}` });
    if (!session.url || session.livemode !== config.livemode || new URL(session.url).origin !== "https://checkout.stripe.com") throw new Error("Invalid Checkout response");
    return json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("KUEST_CHECKOUT_ERROR", { type: error instanceof Stripe.errors.StripeError ? error.type : "Checkout unavailable" });
    return json({ error: "We could not start payment. Please try again shortly." }, 502);
  }
}
