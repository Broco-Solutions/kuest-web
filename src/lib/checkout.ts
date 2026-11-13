import Stripe from "stripe";
import { products, productColors } from "@/data/products";
import { getCheckoutConfiguration, priceVariable } from "@/lib/commerce-config";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function createCheckout(request: Request, makeStripe = (key: string) => new Stripe(key, { maxNetworkRetries: 2, timeout: 15_000 })) {
  const config = getCheckoutConfiguration();
  if (!config) return json({ error: "Online checkout is temporarily unavailable. Please visit our showroom." }, 503);
  if (request.headers.get("origin") !== config.siteOrigin) return json({ error: "Invalid request origin." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ error: "Expected JSON." }, 415);
  const requestId = request.headers.get("idempotency-key");
  if (!requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return json({ error: "Invalid checkout request." }, 400);
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return json({ error: "Request too large." }, 413);
  let input: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 2048) return json({ error: "Request too large." }, 413);
    input = JSON.parse(raw);
  } catch { return json({ error: "Invalid request." }, 400); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "Invalid product." }, 400);
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["slug", "color"].includes(key))) return json({ error: "Invalid checkout fields." }, 400);
  const product = products.find((item) => item.slug === body.slug);
  if (!product) return json({ error: "Unknown product." }, 400);
  const colors = productColors[product.slug];
  if (colors ? !colors.includes(body.color as string) : body.color !== undefined) return json({ error: "Please select an available color." }, 400);
  const priceId = process.env[priceVariable(product.slug)]?.trim();
  if (!priceId || !/^price_[A-Za-z0-9]+$/.test(priceId)) return json({ error: "This model is temporarily unavailable online." }, 503);

  try {
    const stripe = makeStripe(config.secretKey);
    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    const stripeProduct = price.product;
    // Reject stale, inclusive, recurring, or incorrectly mapped prices before charging.
    if (!price.active || price.livemode !== config.livemode || price.currency !== "usd" || price.type !== "one_time" ||
      price.unit_amount !== Math.round(product.price * 100) || price.tax_behavior !== "exclusive" ||
      typeof stripeProduct === "string" || stripeProduct.deleted || !stripeProduct.active || stripeProduct.name !== product.name ||
      stripeProduct.tax_details?.tax_code !== "txcd_99999999" || stripeProduct.tax_details?.performance_location !== config.pickupLocation
    ) return json({ error: "This model is temporarily unavailable online. Please visit our showroom." }, 503);

    const metadata = {
      website: "kuest-electric", product_slug: product.slug,
      color: typeof body.color === "string" ? body.color : "Not specified",
      fulfillment: "showroom_pickup", checkout_mode: config.livemode ? "live" : "test",
    };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      // Stripe selects methods enabled and eligible on the Kuest account, including Affirm.
      success_url: `${config.siteOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.siteOrigin}/checkout/cancel`,
      custom_text: { submit: { message: `Showroom pickup only: 8330 Biscayne Blvd, Unit A, Miami, FL 33138. Sales tax is added at checkout.${colors ? ` Selected color: ${body.color}.` : ""} Wait for KUEST to confirm pickup readiness.` } },
      metadata, payment_intent_data: { metadata },
    }, { idempotencyKey: `kuest-${requestId}` });
    if (!session.url || session.livemode !== config.livemode || new URL(session.url).origin !== "https://checkout.stripe.com") throw new Error("Invalid Checkout response");
    return json({ url: session.url });
  } catch (error) {
    console.error("KUEST_CHECKOUT_ERROR", { type: error instanceof Stripe.errors.StripeError ? error.type : "Checkout unavailable" });
    return json({ error: "We could not start payment. Please try again shortly." }, 502);
  }
}
