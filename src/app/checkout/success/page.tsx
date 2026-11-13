import Link from "next/link";
import type { Metadata } from "next";
import { getCheckoutStatus } from "@/lib/payment";
export const metadata: Metadata = { title: "Payment status | KUEST", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Success({ searchParams }: { searchParams: Promise<{ session_id?: string | string[] }> }) {
  const { session_id } = await searchParams;
  const status = await getCheckoutStatus(typeof session_id === "string" ? session_id : undefined);
  const copy = {
    paid: ["Payment confirmed", "Thank you for your purchase. Please wait for KUEST to confirm when your order is ready for pickup."],
    pending: ["Payment processing", "Your payment has not been confirmed yet. Please avoid paying again and check with KUEST before collecting your order."],
    failed: ["Payment not completed", "This payment was not completed. You can return to the collection to try again."],
    unavailable: ["We could not verify your payment", "If you already paid, please check your receipt or contact the showroom before trying again."],
  }[status];
  return <main className="checkout-result"><Link href="/" className="eyebrow">KUEST / MIAMI</Link><h1>{copy[0]}</h1><p>{copy[1]}</p><address>Showroom pickup<br />8330 Biscayne Blvd, Unit A<br />Miami, FL 33138</address>{status === "pending" && <a className="button button-outline" href={`/checkout/success?session_id=${session_id}`}>Check payment status</a>}<Link className="button button-accent" href="/#all-models">Back to collection</Link></main>;
}
