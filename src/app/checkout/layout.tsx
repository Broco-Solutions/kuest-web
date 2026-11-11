import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Checkout | KUEST Electric",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
  referrer: "no-referrer",
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <main className="checkout-page">
    <Link href="/" className="checkout-logo" aria-label="KUEST home">
      <Image src="/brand/logo/logo-kuest-negro.png" alt="KUEST Electric" width={178} height={59} />
    </Link>
    <section className="checkout-panel">{children}</section>
  </main>;
}
