import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import Stripe from "stripe";
import { products } from "../src/data/products";
import { createCheckout, isKuestSession, parsePurchase, paymentState, priceLookupKey, STORE_ID, validatePaidSession, validatePrice } from "../src/lib/stripe/checkout";
import { getCheckoutConfig, getStripeConfig } from "../src/lib/stripe/config";
import { processStripeEvent } from "../src/lib/stripe/webhook";
import { readLimitedBody } from "../src/lib/stripe/http";
import { POST as checkoutPost } from "../src/app/api/checkout/route";
import { POST as webhookPost } from "../src/app/api/stripe/webhook/route";

const originalEnv = { ...process.env };
const requestId = "00112233-4455-4677-8899-aabbccddeeff";
const product = products[0];
// Deliberately synthetic credentials. Tests make no Stripe network requests.
const webhookSecret = "whsec_synthetic_unit_test_only";

beforeEach(() => {
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: "rk_test_syntheticUnitTestOnly",
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    STRIPE_MODE: "test", STRIPE_CHECKOUT_ENABLED: "true",
    STRIPE_FULFILLMENT_MODE: "showroom_pickup", STRIPE_TAX_MODE: "included",
    SITE_URL: "http://localhost:3000", VERCEL_ENV: "preview",
  });
});
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

function validPrice(overrides: Partial<Stripe.Price> = {}): Stripe.Price {
  return {
    id: "price_test_catalog", active: true, livemode: false, type: "one_time",
    billing_scheme: "per_unit", currency: "usd", unit_amount: product.price * 100,
    tax_behavior: "inclusive", lookup_key: priceLookupKey(product.slug),
    product: { id: "prod_test_catalog", active: true, metadata: { kuest_slug: product.slug } },
    ...overrides,
  } as Stripe.Price;
}

function validSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_test_syntheticSession12345", mode: "payment", livemode: false,
    status: "complete", payment_status: "paid", currency: "usd",
    amount_subtotal: product.price * 100, amount_total: product.price * 100,
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
    metadata: { kuest_store: STORE_ID, kuest_product_slug: product.slug,
      kuest_unit_amount: String(product.price * 100), kuest_price_id: "price_test_catalog",
      kuest_fulfillment: "showroom_pickup" },
    ...overrides,
  } as Stripe.Checkout.Session;
}

function fakeStripe(session = validSession()) {
  const updates: unknown[][] = [];
  const creates: unknown[][] = [];
  const client = {
    prices: { list: async () => ({ data: [validPrice()] }) },
    checkout: { sessions: {
      retrieve: async () => session,
      listLineItems: async () => ({ has_more: false, data: [
        { quantity: 1, currency: "usd", price: validPrice() },
      ] }),
      update: async (...args: unknown[]) => {
        updates.push(args);
        const params = args[1] as { metadata: Record<string, string> };
        Object.assign(session.metadata!, params.metadata);
        return session;
      },
      create: async (...args: unknown[]) => {
        creates.push(args);
        return { url: "https://checkout.stripe.com/c/pay/synthetic" };
      },
    } },
  };
  return { stripe: client as unknown as Stripe, updates, creates, client };
}

function event(type: string, session = validSession()): Stripe.Event {
  return { id: "evt_synthetic", type, livemode: false, data: { object: session } } as Stripe.Event;
}

test("only existing models and a valid idempotency request are accepted", () => {
  assert.equal(parsePurchase({ productSlug: product.slug, requestId }).product.price, product.price);
  for (const payload of [null, [], {}, { productSlug: "made-up", requestId },
    { productSlug: product.slug, requestId: "invalid" },
    { productSlug: product.slug, requestId, price: 1 },
    { productSlug: product.slug, requestId, quantity: 99 },
    { productSlug: product.slug, requestId, success_url: "https://attacker.invalid" }]) {
    assert.throws(() => parsePurchase(payload));
  }
});

test("Stripe prices must match catalog, currency, mode, product, tax and amount", () => {
  validatePrice(validPrice(), product, false, "included");
  for (const change of [
    { unit_amount: 1 }, { currency: "eur" }, { active: false }, { livemode: true },
    { type: "recurring" }, { billing_scheme: "tiered" }, { tax_behavior: "exclusive" },
    { transform_quantity: { divide_by: 10, round: "up" } },
    { lookup_key: "someone_else" }, { product: "prod_unexpanded" },
    { product: { deleted: true } }, { product: { active: false, metadata: {} } },
    { product: { active: true, metadata: { kuest_slug: "other-model" } } },
  ]) assert.throws(() => validatePrice(validPrice(change as Partial<Stripe.Price>), product, false, "included"));
  assert.throws(() => validatePrice(validPrice({ tax_behavior: "unspecified" }), product, false, "automatic"));
  assert.throws(() => validatePrice(validPrice({ tax_behavior: undefined }), product, false, "automatic"));
});

test("checkout is disabled by default and requires explicit business settings", () => {
  assert.equal(getCheckoutConfig().siteUrl, "http://localhost:3000");
  delete process.env.STRIPE_CHECKOUT_ENABLED;
  assert.throws(getCheckoutConfig);
  process.env.STRIPE_CHECKOUT_ENABLED = "true";
  delete process.env.STRIPE_FULFILLMENT_MODE;
  assert.throws(getCheckoutConfig);
});

test("live keys cannot be used locally or on Vercel Preview, or mixed with test mode", () => {
  process.env.STRIPE_SECRET_KEY = "rk_live_syntheticUnitTestOnly";
  assert.throws(getStripeConfig);
  process.env.STRIPE_MODE = "live";
  assert.throws(getStripeConfig);
  process.env.VERCEL_ENV = "production";
  assert.throws(getCheckoutConfig); // local URL forbidden for live
  process.env.SITE_URL = "https://kuest-electric.com";
  assert.equal(getCheckoutConfig().livemode, true);
});

test("redirect origin is configured, never chosen by the customer", () => {
  for (const site of ["https://user:password@kuest-electric.com", "https://example.com/path", "ftp://example.com", "http://example.com"]) {
    process.env.SITE_URL = site;
    assert.throws(getCheckoutConfig);
  }
});

test("creates one unit at the validated Stripe Price and reuses idempotency keys", async () => {
  const { stripe, creates } = fakeStripe();
  await createCheckout(stripe, product, requestId);
  await createCheckout(stripe, product, requestId);
  const params = creates[0][0] as Stripe.Checkout.SessionCreateParams;
  assert.deepEqual(params.line_items, [{ price: "price_test_catalog", quantity: 1 }]);
  assert.deepEqual(params.allowed_payment_method_types, ["card"]);
  assert.equal(params.success_url, "http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}");
  assert.deepEqual(creates[0][1], creates[1][1]);
  process.env.STRIPE_TAX_MODE = "automatic";
  await createCheckout(stripe, product, requestId);
  assert.notDeepEqual(creates[0][1], creates[2][1]);
});

test("missing or mismatched Stripe prices never create a Session", async () => {
  const { stripe, creates, client } = fakeStripe();
  client.prices.list = async () => ({ data: [] });
  await assert.rejects(createCheckout(stripe, product, requestId));
  client.prices.list = async () => ({ data: [validPrice({ unit_amount: 1 })] });
  await assert.rejects(createCheckout(stripe, product, requestId));
  assert.equal(creates.length, 0);
});

test("session status never treats unpaid completion or cancellation as success", () => {
  assert.equal(paymentState(validSession()), "paid");
  assert.equal(paymentState(validSession({ payment_status: "unpaid" })), "pending");
  assert.equal(paymentState(validSession({ status: "open", payment_status: "unpaid" })), "open");
  assert.equal(paymentState(validSession({ status: "expired", payment_status: "unpaid" })), "expired");
  assert.equal(paymentState(validSession({ payment_status: "unpaid", metadata: { kuest_async_failed: "true" } })), "failed");
  assert.equal(isKuestSession(validSession({ metadata: {} }), false), false);
  assert.equal(isKuestSession(validSession(), true), false);
});

test("paid validation rejects amount, currency or line item mismatches", async () => {
  const { stripe, client } = fakeStripe();
  await validatePaidSession(stripe, validSession());
  for (const overrides of [{ amount_subtotal: 1 }, { currency: "eur" }, { amount_total: 0 }]) {
    await assert.rejects(validatePaidSession(stripe, validSession(overrides)));
  }
  client.checkout.sessions.listLineItems = async () => ({ has_more: false,
    data: [{ quantity: 2, currency: "usd", price: validPrice() }] });
  await assert.rejects(validatePaidSession(stripe, validSession()));
});

test("webhook persists paid verification once and ignores other stores/modes", async () => {
  const session = validSession();
  const { stripe, updates } = fakeStripe(session);
  await processStripeEvent(stripe, event("checkout.session.completed"), false);
  await processStripeEvent(stripe, event("checkout.session.completed"), false);
  await processStripeEvent(stripe, event("checkout.session.async_payment_succeeded"), false);
  await processStripeEvent(stripe, event("checkout.session.completed", validSession({ metadata: {} })), false);
  await processStripeEvent(stripe, { ...event("checkout.session.completed"), livemode: true }, false);
  assert.equal(updates.length, 1);
  assert.equal(session.metadata?.kuest_payment_verified, "true");
});

test("out-of-order failure cannot downgrade a paid Session", async () => {
  const session = validSession();
  const { stripe } = fakeStripe(session);
  await processStripeEvent(stripe, event("checkout.session.async_payment_failed"), false);
  assert.equal(session.metadata?.kuest_payment_verified, "true");
  assert.equal(session.metadata?.kuest_async_failed, undefined);
  assert.equal(paymentState(session), "paid");
});

test("pending, expired and failed payments are never marked paid", async () => {
  const session = validSession({ payment_status: "unpaid" });
  const { stripe, updates } = fakeStripe(session);
  await processStripeEvent(stripe, event("checkout.session.completed"), false);
  await processStripeEvent(stripe, event("checkout.session.expired"), false);
  assert.equal(updates.length, 0);
  await processStripeEvent(stripe, event("checkout.session.async_payment_failed"), false);
  assert.equal(session.metadata?.kuest_async_failed, "true");
  assert.equal(session.metadata?.kuest_payment_verified, undefined);
});

test("a later successful payment takes precedence over an earlier failure marker", async () => {
  const session = validSession();
  session.metadata!.kuest_async_failed = "true";
  const { stripe } = fakeStripe(session);
  await processStripeEvent(stripe, event("checkout.session.async_payment_succeeded"), false);
  assert.equal(paymentState(session), "paid");
  assert.equal(session.metadata?.kuest_payment_verified, "true");
});

test("previous purchases validate against their price snapshot after catalog prices change", async () => {
  const originalPrice = product.price;
  const session = validSession();
  const { stripe, client } = fakeStripe();
  const historicalPrice = validPrice();
  client.checkout.sessions.listLineItems = async () => ({ has_more: false,
    data: [{ quantity: 1, currency: "usd", price: historicalPrice }] });
  try {
    product.price = originalPrice + 10;
    await validatePaidSession(stripe, session);
  } finally {
    product.price = originalPrice;
  }
});

test("webhook persistence failures propagate so Stripe can retry", async () => {
  const { stripe, client } = fakeStripe();
  client.checkout.sessions.update = async () => { throw new Error("temporary failure"); };
  await assert.rejects(processStripeEvent(stripe, event("checkout.session.completed"), false));
});

test("raw body limits cannot be bypassed by omitting Content-Length", async () => {
  await assert.rejects(readLimitedBody(new Request("http://localhost", { method: "POST", body: "x".repeat(1025) }), 1024));
});

test("checkout HTTP rejects cross-origin, wrong content type, malformed and manipulated JSON before calling Stripe", async () => {
  const request = (body: string, headers = {}) => new Request("http://localhost:3000/api/checkout", {
    method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json", ...headers }, body,
  });
  assert.equal((await checkoutPost(request("{}", { origin: "https://attacker.invalid" }))).status, 403);
  assert.equal((await checkoutPost(request("{}", { "content-type": "text/plain" }))).status, 415);
  assert.equal((await checkoutPost(request("{"))).status, 400);
  assert.equal((await checkoutPost(request(JSON.stringify({ productSlug: product.slug, requestId, price: 1 })))).status, 400);
  assert.equal((await checkoutPost(request("x".repeat(1025)))).status, 413);
});

test("webhook HTTP verifies signature against exact raw bytes and rejects tampering/replays", async () => {
  const payload = JSON.stringify(event("customer.created")); // valid ignored event, zero API calls
  const send = (body: string, signature?: string) => webhookPost(new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST", body, headers: signature ? { "stripe-signature": signature } : {},
  }));
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  assert.equal((await send(payload)).status, 400);
  assert.equal((await send(payload, signature)).status, 200);
  assert.equal((await send(`${payload} `, signature)).status, 400);
  const oldSignature = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret, timestamp: 1 });
  assert.equal((await send(payload, oldSignature)).status, 400);
});
