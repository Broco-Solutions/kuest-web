import Link from "next/link";

export default function CancelPage() {
  return <>
    <p className="eyebrow electric">KUEST / SECURE CHECKOUT</p>
    <h1>Checkout closed.</h1>
    <p className="body-copy">You returned without completing checkout here. If you paid in another tab, check your payment confirmation before trying again. You can continue exploring the collection or visit us in Miami.</p>
    <div className="checkout-actions">
      <Link className="button button-accent" href="/#all-models">Back to collection</Link>
      <Link className="text-link light" href="/#showroom">Visit our showroom</Link>
    </div>
  </>;
}
