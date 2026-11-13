import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import Stripe from "stripe";
import { products } from "../src/data/products";
import { createCheckout } from "../src/lib/checkout";
import { getCheckoutConfiguration, priceVariable } from "../src/lib/commerce-config";
import { isKuestSession, paymentStatus, receiveWebhook } from "../src/lib/payment";

const key = "sk_test_fixture";
const secret = "whsec_fixture";
const origin = "http://localhost:3000";
beforeEach(() => {
  Object.assign(process.env, { NODE_ENV: "test", VERCEL_ENV: "preview", STRIPE_SECRET_KEY: key, STRIPE_WEBHOOK_SECRET: secret,
    SITE_URL: origin, STRIPE_PICKUP_TAX_LOCATION: "taxloc_fixture", STRIPE_PRICE_NAVEE_GT3: "price_fixture", STRIPE_LIVE_CHECKOUT_ENABLED: "false" });
});
const request = (body: unknown = { slug: "navee-gt3" }, requestOrigin = origin) => new Request(`${origin}/api/checkout`, {
  method: "POST", headers: { origin: requestOrigin, "Content-Type": "application/json", "Idempotency-Key": "cfc0a036-63f2-4f7c-a0d7-11eb52ea4532" }, body: JSON.stringify(body),
});
function session(overrides: Record<string, unknown> = {}): Stripe.Checkout.Session {
  return { id: "cs_test_fixture", mode: "payment", status: "complete", payment_status: "paid", livemode: false,
    metadata: { website: "kuest-electric", checkout_mode: "test" }, amount_total: 85600, currency: "usd", ...overrides } as unknown as Stripe.Checkout.Session;
}
function fixture(overrides = {}) {
  const stripe = new Stripe(key);
  let createCalls = 0;
  let retrieveCalls = 0;
  let params: Stripe.Checkout.SessionCreateParams | undefined;
  let options: Stripe.RequestOptions | undefined;
  Object.defineProperty(stripe.prices, "retrieve", { value: async () => { retrieveCalls++; return {
    active: true, livemode: false, currency: "usd", type: "one_time", unit_amount: 80000, tax_behavior: "exclusive",
    product: { active: true, name: "NAVEE GT3", tax_details: { tax_code: "txcd_99999999", performance_location: "taxloc_fixture" } }, ...overrides,
  }; } });
  Object.defineProperty(stripe.checkout.sessions, "create", { configurable: true, value: async (p: Stripe.Checkout.SessionCreateParams, o: Stripe.RequestOptions) => {
    createCalls++; params = p; options = o; return { url: "https://checkout.stripe.com/c/pay/cs_test_fixture", livemode: false };
  } });
  return { stripe, get calls() { return { createCalls, retrieveCalls }; }, get params() { return params!; }, get options() { return options!; } };
}

test("checkout uses server price, exclusive pickup tax, fixed quantity and safe return URLs", async () => {
  const mock = fixture();
  const result = await createCheckout(request(), () => mock.stripe);
  assert.equal(result.status, 200);
  assert.deepEqual(mock.params.line_items, [{ price: "price_fixture", quantity: 1 }]);
  assert.deepEqual(mock.params.automatic_tax, { enabled: true });
  assert.equal(mock.params.shipping_address_collection, undefined);
  assert.equal(mock.params.metadata?.fulfillment, "showroom_pickup");
  assert.equal(mock.params.success_url, `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
  assert.equal(mock.options.idempotencyKey, "kuest-cfc0a036-63f2-4f7c-a0d7-11eb52ea4532");
});
test("rejects client price/quantity/return URLs and unknown models without touching Stripe", async () => {
  const mock = fixture();
  for (const body of [{ slug: "navee-gt3", price: 1 }, { slug: "navee-gt3", quantity: 0 }, { slug: "navee-gt3", success_url: "https://evil.example" }, { slug: "missing" }, null]) {
    assert.equal((await createCheckout(request(body), () => mock.stripe)).status, 400);
  }
  assert.deepEqual(mock.calls, { createCalls: 0, retrieveCalls: 0 });
});
test("rejects cross-origin, malformed idempotency keys, oversized and invalid JSON", async () => {
  const mock = fixture();
  assert.equal((await createCheckout(request(undefined, "https://evil.example"), () => mock.stripe)).status, 403);
  const noId = request(); noId.headers.delete("idempotency-key");
  assert.equal((await createCheckout(noId, () => mock.stripe)).status, 400);
  const bad = (text: string) => new Request(`${origin}/api/checkout`, { method: "POST", headers: request().headers, body: text });
  assert.equal((await createCheckout(bad("{"), () => mock.stripe)).status, 400);
  assert.equal((await createCheckout(bad("x".repeat(2049)), () => mock.stripe)).status, 413);
  assert.deepEqual(mock.calls, { createCalls: 0, retrieveCalls: 0 });
});
test("requires a valid color for models with color options", async () => {
  const mock = fixture();
  for (const color of [undefined, "Red", 4]) assert.equal((await createCheckout(request({ slug: "jasion-thunder-pro", color }), () => mock.stripe)).status, 400);
  assert.deepEqual(mock.calls, { createCalls: 0, retrieveCalls: 0 });
});
test("selected color is retained on the Checkout session and payment", async () => {
  process.env.STRIPE_PRICE_JASION_THUNDER_PRO = "price_fixture";
  const mock = fixture({ unit_amount: 340000, product: { active: true, name: "Jasion Thunder PRO", tax_details: { tax_code: "txcd_99999999", performance_location: "taxloc_fixture" } } });
  assert.equal((await createCheckout(request({ slug: "jasion-thunder-pro", color: "Blue" }), () => mock.stripe)).status, 200);
  assert.equal(mock.params.metadata?.color, "Blue");
  assert.equal(mock.params.payment_intent_data?.metadata?.color, "Blue");
});
test("missing signing secret or price keeps checkout unavailable", async () => {
  const mock = fixture();
  delete process.env.STRIPE_PRICE_NAVEE_GT3;
  assert.equal((await createCheckout(request(), () => mock.stripe)).status, 503);
  process.env.STRIPE_PRICE_NAVEE_GT3 = "price_fixture";
  delete process.env.STRIPE_WEBHOOK_SECRET;
  assert.equal((await createCheckout(request(), () => mock.stripe)).status, 503);
  assert.deepEqual(mock.calls, { createCalls: 0, retrieveCalls: 0 });
});
test("stale, inclusive, recurring, wrong-account or incorrect pickup prices never create a payment", async () => {
  for (const overrides of [{ unit_amount: 1 }, { tax_behavior: "inclusive" }, { currency: "eur" }, { active: false }, { livemode: true }, { type: "recurring" },
    { product: { active: true, name: "Wrong model" } }, { product: { active: true, name: "NAVEE GT3", tax_details: { tax_code: "txcd_99999999", performance_location: "taxloc_wrong" } } }]) {
    const mock = fixture(overrides);
    assert.equal((await createCheckout(request(), () => mock.stripe)).status, 503);
    assert.equal(mock.calls.createCalls, 0);
  }
});
test("live keys are blocked locally and on previews; production must opt in", () => {
  process.env.STRIPE_SECRET_KEY = "rk_live_fixture";
  assert.equal(getCheckoutConfiguration(), null);
  Object.assign(process.env, { NODE_ENV: "production", SITE_URL: "https://kuest-electric.com", STRIPE_LIVE_CHECKOUT_ENABLED: "true" });
  assert.equal(getCheckoutConfiguration(), null);
  process.env.VERCEL_ENV = "production";
  assert.equal(getCheckoutConfiguration()?.livemode, true);
  process.env.SITE_URL = "https://nuvola-home.com";
  assert.equal(getCheckoutConfiguration(), null);
});
test("a completed but unpaid session and unrelated sessions are never confirmed", () => {
  assert.equal(paymentStatus(session({ payment_status: "unpaid" })), "pending");
  assert.equal(paymentStatus(session({ status: "open" })), "unavailable");
  assert.equal(paymentStatus(session({ status: "expired", payment_status: "unpaid" })), "failed");
  assert.equal(paymentStatus(session()), "paid");
  assert.equal(isKuestSession(session({ metadata: { website: "nuvola-home" } }), false), false);
  assert.equal(isKuestSession(session(), true), false);
  assert.equal(priceVariable("jasion-eb5-ultra-e"), "STRIPE_PRICE_JASION_EB5_ULTRA_E");
});
function webhook(stripe: Stripe, type = "checkout.session.completed", object = session(), livemode = false) {
  const payload = JSON.stringify({ id: "evt_fixture", object: "event", type, livemode, data: { object } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request(`${origin}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": signature }, body: payload });
}
test("webhook validates the raw-body signature and timestamp before accepting events", async () => {
  const stripe = new Stripe(key);
  const invalid = webhook(stripe); invalid.headers.set("stripe-signature", "bad");
  assert.equal((await receiveWebhook(invalid, () => stripe)).status, 400);
  const stale = new Request(`${origin}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload: "{}", secret, timestamp: 1 }) }, body: "{}" });
  assert.equal((await receiveWebhook(stale, () => stripe)).status, 400);
});
test("webhook retries verification failures and safely rechecks duplicate/out-of-order events", async () => {
  const stripe = new Stripe(key);
  Object.defineProperty(stripe.checkout.sessions, "retrieve", { configurable: true, value: async () => { throw new Error("network failure"); } });
  assert.equal((await receiveWebhook(webhook(stripe), () => stripe)).status, 500);
  let reads = 0;
  Object.defineProperty(stripe.checkout.sessions, "retrieve", { value: async () => { reads++; return session(); } });
  const logged: unknown[][] = [];
  const original = console.info;
  console.info = (...args) => { logged.push(args); };
  try {
    for (const event of ["checkout.session.completed", "checkout.session.completed", "checkout.session.async_payment_failed"]) {
      assert.equal((await receiveWebhook(webhook(stripe, event), () => stripe)).status, 200);
    }
  } finally { console.info = original; }
  assert.equal(reads, 3);
  for (const entry of logged) assert.equal((entry[1] as { status: string }).status, "paid");
});
test("webhook ignores Nuvola events, other modes and unrelated event types", async () => {
  const stripe = new Stripe(key);
  Object.defineProperty(stripe.checkout.sessions, "retrieve", { value: async () => { assert.fail("Should not fetch"); } });
  for (const req of [webhook(stripe, "checkout.session.completed", session({ metadata: {} })), webhook(stripe, "checkout.session.completed", session(), true), webhook(stripe, "customer.created")]) {
    assert.equal((await receiveWebhook(req, () => stripe)).status, 200);
  }
});
test("webhook keeps unpaid completions pending and reports failed async payments", async () => {
  const stripe = new Stripe(key);
  Object.defineProperty(stripe.checkout.sessions, "retrieve", { value: async () => session({ payment_status: "unpaid" }) });
  const statuses: string[] = [];
  const original = console.info;
  console.info = (_name, record) => { statuses.push(record.status); };
  try {
    await receiveWebhook(webhook(stripe), () => stripe);
    await receiveWebhook(webhook(stripe, "checkout.session.async_payment_failed"), () => stripe);
  } finally { console.info = original; }
  assert.deepEqual(statuses, ["pending", "failed"]);
});

test("production live checkout stays blocked for false, missing and malformed flags without calling Stripe", async () => {
  Object.assign(process.env, { NODE_ENV: "production", VERCEL_ENV: "production", SITE_URL: "https://kuest-electric.com", STRIPE_SECRET_KEY: "rk_live_fixture" });
  for (const flag of ["false", "TRUE", "1", "", undefined]) {
    if (flag === undefined) delete process.env.STRIPE_LIVE_CHECKOUT_ENABLED;
    else process.env.STRIPE_LIVE_CHECKOUT_ENABLED = flag;
    assert.equal(getCheckoutConfiguration(), null);
    const response = await createCheckout(request(), () => { assert.fail("Disabled checkout must not access Stripe"); });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("every catalog model has a unique configured price variable", () => {
  const names = products.map((product) => priceVariable(product.slug));
  assert.equal(names.length, 9);
  assert.equal(new Set(names).size, 9);
  assert.ok(names.includes("STRIPE_PRICE_JAISON_RETROVOLT"));
  assert.ok(names.includes("STRIPE_PRICE_NAVEE_UT5_ULTRA_XUT5"));
});

test("checkout retries retain their Stripe idempotency key", async () => {
  const mock = fixture();
  assert.equal((await createCheckout(request(), () => mock.stripe)).status, 200);
  const firstKey = mock.options.idempotencyKey;
  assert.equal((await createCheckout(request(), () => mock.stripe)).status, 200);
  assert.equal(mock.options.idempotencyKey, firstKey);
});

test("checkout rejects unsafe Stripe redirects and reports upstream failures without exposing details", async () => {
  for (const outcome of ["redirect", "failure"]) {
    const mock = fixture();
    Object.defineProperty(mock.stripe.checkout.sessions, "create", { value: async () => {
      if (outcome === "failure") throw new Error("private upstream detail");
      return { url: "https://evil.example/pay", livemode: false };
    } });
    const response = await createCheckout(request(), () => mock.stripe);
    assert.equal(response.status, 502);
    assert.equal((await response.text()).includes("private upstream detail"), false);
  }
});

test("webhook rejects missing signatures and modified bodies before reading a session", async () => {
  const stripe = new Stripe(key);
  Object.defineProperty(stripe.checkout.sessions, "retrieve", { value: async () => { assert.fail("Unverified events must not access Stripe"); } });
  const unsigned = new Request(`${origin}/api/stripe/webhook`, { method: "POST", body: "{}" });
  assert.equal((await receiveWebhook(unsigned, () => stripe)).status, 400);
  const signed = webhook(stripe);
  const tampered = new Request(signed.url, { method: "POST", headers: signed.headers, body: `${await signed.text()} ` });
  assert.equal((await receiveWebhook(tampered, () => stripe)).status, 400);
});

test("webhook returns a configuration failure when the signing secret is missing", async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const response = await receiveWebhook(new Request(`${origin}/api/stripe/webhook`, { method: "POST", body: "{}" }), () => {
    assert.fail("Unconfigured webhook must not access Stripe");
  });
  assert.equal(response.status, 503);
});
