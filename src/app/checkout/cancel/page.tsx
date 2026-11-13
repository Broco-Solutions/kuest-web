import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Checkout closed | KUEST", robots: { index: false, follow: false } };
export default function Cancel() {
  return <main className="checkout-result"><Link href="/" className="eyebrow">KUEST / MIAMI</Link><h1>Checkout closed</h1><p>You left checkout before returning to KUEST. If you submitted a payment, check your receipt or contact the showroom before paying again.</p><Link className="button button-accent" href="/#all-models">Back to collection</Link></main>;
}
