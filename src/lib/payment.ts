import Stripe from "stripe";
import { getStripeConfiguration } from "@/lib/commerce-config";

export type PaymentStatus = "paid" | "pending" | "failed" | "unavailable";
export function isKuestSession(session: Stripe.Checkout.Session, livemode: boolean) {
  return session.livemode === livemode && session.mode === "payment" && session.metadata?.website === "kuest-electric" &&
    session.metadata?.checkout_mode === (livemode ? "live" : "test");
}
export function paymentStatus(session: Stripe.Checkout.Session): PaymentStatus {
  if (session.status === "complete" && session.payment_status === "paid") return "paid";
  if (session.status === "expired") return "failed";
  if (session.status === "complete") return "pending";
  return "unavailable";
}
export async function getCheckoutStatus(id: string | undefined): Promise<PaymentStatus> {
  const config = getStripeConfiguration();
  if (!config || !id || !/^cs_(test|live)_[A-Za-z0-9]{1,240}$/.test(id) || !id.startsWith(config.livemode ? "cs_live_" : "cs_test_")) return "unavailable";
  try {
    const stripe = new Stripe(config.secretKey, { timeout: 15_000 });
    const session = await stripe.checkout.sessions.retrieve(id);
    return isKuestSession(session, config.livemode) ? paymentStatus(session) : "unavailable";
  } catch { return "unavailable"; }
}

export async function receiveWebhook(request: Request, makeStripe = (key: string) => new Stripe(key, { timeout: 15_000 })) {
  const config = getStripeConfiguration();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!config || !secret?.startsWith("whsec_")) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });
  const stripe = makeStripe(config.secretKey);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await request.text(), signature, secret); }
  catch { return Response.json({ error: "Invalid signature." }, { status: 400 }); }
  const handled = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"];
  if (event.livemode === config.livemode && handled.includes(event.type)) {
    const snapshot = event.data.object as Stripe.Checkout.Session;
    if (isKuestSession(snapshot, config.livemode)) {
      try {
        // Persisted Stripe sessions are the order ledger. Re-fetch for out-of-order events.
        const session = await stripe.checkout.sessions.retrieve(snapshot.id);
        if (isKuestSession(session, config.livemode)) {
          let status = paymentStatus(session);
          if (status !== "paid" && event.type === "checkout.session.async_payment_failed") status = "failed";
          // Observational only. Retries cannot duplicate fulfillment, emails or stock changes.
          console.info("KUEST_PAYMENT_STATUS", { eventId: event.id, sessionId: session.id, status, amountTotal: session.amount_total, currency: session.currency });
        }
      } catch {
        console.error("KUEST_WEBHOOK_RETRY", { eventId: event.id });
        return Response.json({ error: "Unable to verify payment." }, { status: 500 });
      }
    }
  }
  return Response.json({ received: true });
}
