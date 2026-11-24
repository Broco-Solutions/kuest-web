"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { products, formatPrice, productColors } from "@/data/products";
import { cartTotal, itemKey, MAX_QUANTITY } from "@/lib/cart";
import { useCart } from "./cart-store";
export function CartView({ availableSlugs }: { availableSlugs: string[] }) {
  const { items, update, remove } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const attempt = useRef<{ key: string; body: string } | null>(null);
  const unavailable = items.some(item => !availableSlugs.includes(item.slug));
  function change(action: () => void) { try { action(); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update bag."); } }
  async function checkout() {
    if (inFlight.current || !items.length || unavailable) return;
    inFlight.current = true; setBusy(true); setError("");
    const body = JSON.stringify({ items });
    if (!attempt.current || attempt.current.body !== body) attempt.current = { key: crypto.randomUUID(), body };
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.current.key }, body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start payment.");
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.origin !== "https://checkout.stripe.com") throw new Error("Unable to start payment.");
      // Save the exact bag for cleanup only after server-verified payment.
      try { sessionStorage.setItem("kuest_checkout_bag", JSON.stringify({ sessionId: data.sessionId, items })); } catch { /* Optional cleanup only. */ }
      window.location.assign(url.href);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to connect. Please try again."); setBusy(false); inFlight.current = false; }
  }
  return <main className="cart-page"><header className="cart-header"><Link href="/" className="eyebrow">KUEST / MIAMI</Link><Link href="/#all-models">Continue shopping</Link></header><h1>Your bag<span>.</span></h1>
    {!items.length ? <div className="cart-empty"><p>Your next ride is waiting. Add a model from the collection to get started.</p><Link className="button button-accent" href="/#all-models">Explore collection</Link></div> : <div className="cart-layout"><section aria-label="Bag items" className="cart-items">{items.map(item => {
      const product = products.find(p => p.slug === item.slug)!;
      const colors = productColors[item.slug];
      const image = product.images[colors && item.color ? colors.indexOf(item.color) : 0] ?? product.images[0];
      return <article key={itemKey(item)} className="cart-item"><div className="cart-image"><Image src={image} alt={product.name} fill sizes="140px" /></div><div><h2>{product.name}</h2>{item.color && <p>Color: {item.color}</p>}<p>{formatPrice(product.price)} each</p>{!availableSlugs.includes(item.slug) && <p className="checkout-error">Temporarily unavailable online. Remove to continue.</p>}<label>Quantity<select aria-label={`Quantity for ${product.name}${item.color ? ` ${item.color}` : ""}`} value={item.quantity} disabled={busy} onChange={e => change(() => update(itemKey(item), Number(e.target.value)))}>{Array.from({ length: MAX_QUANTITY }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label><button type="button" className="cart-remove" disabled={busy} onClick={() => change(() => remove(itemKey(item)))} aria-label={`Remove ${product.name}${item.color ? ` ${item.color}` : ""}`}>Remove</button></div><strong>{formatPrice(product.price * item.quantity)}</strong></article>;
    })}</section><aside className="cart-summary"><h2>Order summary</h2><div><span>Subtotal</span><strong>{formatPrice(cartTotal(items) / 100)}</strong></div><div><span>Additional tax</span><span>$0</span></div><div className="cart-total"><span>Total (USD)</span><strong>{formatPrice(cartTotal(items) / 100)}</strong></div><p>Pickup at 8330 Biscayne Blvd, Unit A, Miami. Wait for KUEST to confirm your order is ready.</p><button type="button" className="button button-accent" disabled={busy || unavailable} onClick={checkout}>{busy ? "Opening secure checkout…" : "Checkout with Stripe"}</button><p>Pay for all items together securely through Stripe.</p></aside></div>}
    {error && <p role="alert" className="checkout-error">{error}</p>}
  </main>;
}
