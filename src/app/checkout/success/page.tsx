import Link from "next/link";
import { getStripe, logPaymentError } from "@/lib/stripe/client";
import { getStripeConfig } from "@/lib/stripe/config";
import { isKuestSession, paymentState, validatePaidSession, type PaymentState } from "@/lib/stripe/checkout";

const messages: Record<PaymentState | "unavailable", { title: string; body: string }> = {
  paid: { title: "Payment received.", body: "Thank you for choosing KUEST. Your purchase is for pickup at 8330 Biscayne Blvd, Unit A, Miami. Bring your payment confirmation and ID. Payment confirmation does not mean your ride is ready for pickup; please confirm availability with the showroom." },
  pending: { title: "Payment processing.", body: "Your payment has not been confirmed yet. Please check again shortly before trying another payment. Your ride is not ready for pickup." },
  open: { title: "Payment incomplete.", body: "Payment has not been confirmed. You can return to the collection when you are ready to try again." },
  expired: { title: "Checkout expired.", body: "This checkout is no longer available. Return to the collection to start again." },
  failed: { title: "Payment unsuccessful.", body: "Payment could not be confirmed. Please return to the collection to try again, or visit our showroom." },
  unavailable: { title: "Unable to verify payment.", body: "We could not verify this payment right now. If you already paid, please check your Stripe receipt or visit the showroom before paying again." },
};

export default async function SuccessPage({ searchParams }: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const { session_id: sessionId } = await searchParams;
  let state: PaymentState | "unavailable" = "unavailable";
  if (typeof sessionId === "string" && /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (isKuestSession(session, getStripeConfig().livemode)) {
        state = paymentState(session);
        if (state === "paid") await validatePaidSession(stripe, session);
      }
    } catch (error) {
      state = "unavailable";
      logPaymentError("status", error);
    }
  }
  const message = messages[state];
  return <>
    <p className="eyebrow electric">KUEST / SECURE CHECKOUT</p>
    <h1>{message.title}</h1>
    <p className="body-copy">{message.body}</p>
    <div className="checkout-actions">
      {(state === "pending" || state === "unavailable") && typeof sessionId === "string" &&
        /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId) &&
        <a className="button button-accent" href={`/checkout/success?session_id=${encodeURIComponent(sessionId)}`}>Check payment again</a>}
      <Link className="button button-outline" href="/#all-models">Back to collection</Link>
      <Link className="text-link light" href="/#showroom">Visit our showroom</Link>
    </div>
  </>;
}
