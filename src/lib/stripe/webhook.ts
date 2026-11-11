import "server-only";
import type Stripe from "stripe";
import { isKuestSession, validatePaidSession } from "./checkout";

const sessionEvents = new Set([
  "checkout.session.completed", "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed", "checkout.session.expired",
]);

export async function processStripeEvent(stripe: Stripe, event: Stripe.Event, livemode: boolean) {
  if (!sessionEvents.has(event.type) || event.livemode !== livemode) return;
  const snapshot = event.data.object as Stripe.Checkout.Session;
  if (!isKuestSession(snapshot, livemode)) return;
  // Re-read current state: deliveries can be duplicated, concurrent or out of order.
  const session = await stripe.checkout.sessions.retrieve(snapshot.id);
  if (!isKuestSession(session, livemode)) throw new Error("Session ownership mismatch");

  if (session.status === "complete" && session.payment_status === "paid") {
    await validatePaidSession(stripe, session);
    if (session.metadata?.kuest_payment_verified === "true") return;
    // A durable, monotonic verification marker on Stripe itself. No fulfillment side effects.
    await stripe.checkout.sessions.update(session.id, {
      metadata: { kuest_payment_verified: "true" },
    }, { idempotencyKey: `kuest-paid-${session.id}` });
  } else if (event.type === "checkout.session.async_payment_failed" &&
             session.metadata?.kuest_async_failed !== "true") {
    await stripe.checkout.sessions.update(session.id, {
      metadata: { kuest_async_failed: "true" },
    }, { idempotencyKey: `kuest-failed-${session.id}` });
  }
  // Expired/open/pending remain recorded by Stripe. Never mark them paid or ready for pickup.
}
