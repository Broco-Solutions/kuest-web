import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import Stripe from "stripe";
import { cartTotal, restoreCart, validateCart } from "../src/lib/cart";
import { createCheckout } from "../src/lib/checkout";
const items = [{ slug: "jasion-thunder-pro", color: "Blue", quantity: 2 }, { slug: "navee-gt3", quantity: 1 }];
beforeEach(() => {
  Object.assign(process.env, { NODE_ENV: "test", VERCEL_ENV: "preview", STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture", SITE_URL: "http://localhost:3000", STRIPE_PRICE_JASION_THUNDER_PRO: "price_thunder", STRIPE_PRICE_NAVEE_GT3: "price_gt3" });
  delete process.env.STRIPE_PICKUP_TAX_LOCATION;
});
const request = (value: unknown) => new Request("http://localhost:3000/api/checkout", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json", "idempotency-key": "cfc0a036-63f2-4f7c-a0d7-11eb52ea4532" }, body: JSON.stringify(value) });
test("bag merges identical variants and keeps different colors separate", () => {
  const bag = validateCart([...items, { slug: "jasion-thunder-pro", color: "Blue", quantity: 1 }, { slug: "jasion-thunder-pro", color: "Black", quantity: 1 }]);
  assert.equal(bag.length, 3); assert.equal(bag[0].quantity, 3);
  assert.equal(cartTotal(bag), 1440000);
  assert.deepEqual(restoreCart(JSON.stringify(bag)), bag);
  for (const raw of ["oops", "{}", '[{"slug":"missing","quantity":1}]']) assert.deepEqual(restoreCart(raw), []);
});
test("rejects tampered prices, unsupported variants, duplicates over limits and invalid quantities", () => {
  for (const value of [[], {}, [{ slug: "navee-gt3", quantity: -1 }], [{ slug: "navee-gt3", quantity: 1.5 }], [{ slug: "navee-gt3", quantity: "2" }], [{ slug: "navee-gt3", quantity: 11 }], [{ slug: "navee-gt3", quantity: 1, price: 1 }], [{ slug: "jasion-thunder-pro", quantity: 1 }], [{ slug: "navee-gt3", quantity: 1, color: "Red" }], [{ slug: "navee-gt3", quantity: 6 }, { slug: "navee-gt3", quantity: 5 }]]) assert.throws(() => validateCart(value));
});
function fixture(stale = false) {
  const stripe = new Stripe("sk_test_fixture");
  let calls = 0; let params: Stripe.Checkout.SessionCreateParams;
  Object.defineProperty(stripe.prices, "retrieve", { value: async (id: string) => ({ active: true, livemode: false, currency: "usd", type: "one_time", tax_behavior: "exclusive", unit_amount: id === "price_thunder" ? 340000 : stale ? 1 : 80000, product: { active: true, name: id === "price_thunder" ? "Jasion Thunder PRO" : "NAVEE GT3" } }) });
  Object.defineProperty(stripe.checkout.sessions, "create", { value: async (p: Stripe.Checkout.SessionCreateParams) => { calls++; params = p; return { id: "cs_test_fixture", livemode: false, url: "https://checkout.stripe.com/c/pay/cs_test_fixture" }; } });
  return { stripe, get calls() { return calls; }, get params() { return params!; } };
}
test("multi-product checkout uses server prices, fixed quantities, preserves colors, and never adds tax", async () => {
  const mock = fixture(); const response = await createCheckout(request({ items }), () => mock.stripe);
  assert.equal(response.status, 200);
  assert.deepEqual(mock.params.line_items, [{ price: "price_thunder", quantity: 2 }, { price: "price_gt3", quantity: 1 }]);
  assert.deepEqual(mock.params.automatic_tax, { enabled: false });
  assert.equal(mock.params.cancel_url, "http://localhost:3000/cart");
  assert.deepEqual(JSON.parse(mock.params.metadata!.item_1 as string), items[0]);
  assert.equal(mock.params.payment_intent_data!.metadata!.item_1, mock.params.metadata!.item_1);
  assert.equal((await response.json()).sessionId, "cs_test_fixture");
  assert.ok(!JSON.stringify(mock.params).includes('tax_rates'));
});
test("one invalid item or missing price prevents creating the entire checkout", async () => {
  const mock = fixture(true);
  assert.equal((await createCheckout(request({ items }), () => mock.stripe)).status, 503); assert.equal(mock.calls, 0);
  delete process.env.STRIPE_PRICE_NAVEE_GT3;
  assert.equal((await createCheckout(request({ items }), () => mock.stripe)).status, 503); assert.equal(mock.calls, 0);
  assert.equal((await createCheckout(request({ items, success_url: "https://evil.example" }), () => mock.stripe)).status, 400);
});
