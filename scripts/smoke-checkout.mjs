import assert from "node:assert/strict";

// Local smoke test of the disabled configuration; never targets production/Stripe.
const base = new URL(process.argv[2] ?? "http://localhost:3000");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "Local URL required");
const home = await fetch(base);
const homeHtml = await home.text();
assert.equal(home.status, 200);
assert.equal((homeHtml.match(/class="product-card"/g) ?? []).length, 9);
assert.ok(!homeHtml.includes("Buy for showroom pickup"));

const cancel = await fetch(new URL("/checkout/cancel", base));
const cancelHtml = await cancel.text();
assert.equal(cancel.status, 200);
assert.ok(cancelHtml.includes("Checkout closed."));
assert.ok(cancelHtml.includes("noindex"));

const status = await fetch(new URL("/checkout/success?session_id=invalid", base));
const statusHtml = await status.text();
assert.equal(status.status, 200);
assert.ok(statusHtml.includes("Unable to verify payment."));
assert.ok(!statusHtml.includes("Payment received."));
assert.ok(statusHtml.includes('name="referrer" content="no-referrer"'));

const checkoutUrl = new URL("/api/checkout", base);
const disabled = await fetch(checkoutUrl, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: base.origin }, body: "{}",
});
assert.equal(disabled.status, 503);
assert.equal(disabled.headers.get("cache-control"), "no-store");
assert.equal((await fetch(checkoutUrl)).status, 405);
console.log("Local HTTP smoke passed: 9 models, payments disabled, cancel/status pages, noindex, no-referrer, API disabled.");
