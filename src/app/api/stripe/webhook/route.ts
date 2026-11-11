import Stripe from "stripe";
import { getStripe, logPaymentError } from "@/lib/stripe/client";
import { CheckoutError, getStripeConfig } from "@/lib/stripe/config";
import { json, readLimitedBody } from "@/lib/stripe/http";
import { processStripeEvent } from "@/lib/stripe/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const config = getStripeConfig();
    const signature = request.headers.get("stripe-signature");
    if (!signature) return json({ error: "Missing signature." }, 400);
    const body = await readLimitedBody(request, 262144);
    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(body, signature, config.webhookSecret);
    } catch {
      return json({ error: "Invalid signature or payload." }, 400);
    }
    await processStripeEvent(getStripe(), event, config.livemode);
    return json({ received: true });
  } catch (error) {
    if (error instanceof CheckoutError) return json({ error: error.message }, error.status);
    logPaymentError("webhook", error);
    // Stripe must retry if verification/persistence fails. Never acknowledge lost work.
    return json({ error: "Event processing failed." }, 500);
  }
}
