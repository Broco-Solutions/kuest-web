"use client";
import { useRef, useState } from "react";
import { productColors } from "@/data/products";

export function BuyButton({ slug, name, enabled }: { slug: string; name: string; enabled: boolean }) {
  const [color, setColor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ key: string; color: string } | null>(null);
  const inFlight = useRef(false);
  const colors = productColors[slug];
  async function buy() {
    if (inFlight.current) return;
    if (colors && !colors.includes(color)) { setError("Please choose a color."); return; }
    inFlight.current = true;
    setBusy(true); setError("");
    if (!attempt.current || attempt.current.color !== color) attempt.current = { key: crypto.randomUUID(), color };
    try {
      const response = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.current.key },
        body: JSON.stringify({ slug, ...(colors ? { color } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment is unavailable. Please try again.");
      const url = new URL(data.url);
      if (url.origin !== "https://checkout.stripe.com") throw new Error("Payment is unavailable. Please try again.");
      window.location.assign(url.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect. Please try again.");
      setBusy(false); inFlight.current = false;
    }
  }
  if (!enabled) return <div className="product-purchase"><p>Showroom pickup · Sales tax added at checkout</p><a className="button button-outline" href="#showroom">Visit showroom</a></div>;
  return <div className="product-purchase">
    <p>Showroom pickup · Sales tax added at checkout</p>
    {colors && <label>Color<select aria-label={`Choose color for ${name}`} value={color} disabled={busy} onChange={(e) => { setColor(e.target.value); setError(""); }}><option value="">Choose a color</option>{colors.map((value) => <option key={value}>{value}</option>)}</select></label>}
    <button type="button" className="button button-accent" disabled={busy} aria-label={`Buy ${name}`} onClick={buy}>{busy ? "Opening secure payment…" : "Buy now"}</button>
    {error && <p role="alert" className="checkout-error">{error}</p>}
  </div>;
}
