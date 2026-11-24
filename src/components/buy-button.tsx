"use client";
import Link from "next/link";
import { useState } from "react";
import { productColors } from "@/data/products";
import { useCart } from "./cart-store";
export function BuyButton({ slug, name, enabled }: { slug: string; name: string; enabled: boolean }) {
  const [color, setColor] = useState("");
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const colors = productColors[slug];
  function addToBag() {
    if (colors && !colors.includes(color)) { setError("Please choose a color."); return; }
    try { add({ slug, ...(colors ? { color } : {}), quantity: 1 }); setError(""); setAdded(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to add item."); }
  }
  if (!enabled) return <div className="product-purchase"><p>Showroom pickup</p><a className="button button-outline" href="#showroom">Visit showroom</a></div>;
  return <div className="product-purchase"><p>Showroom pickup · No additional tax at checkout</p>
    {colors && <label>Color<select aria-label={`Choose color for ${name}`} value={color} onChange={e => { setColor(e.target.value); setError(""); setAdded(false); }}><option value="">Choose a color</option>{colors.map(value => <option key={value}>{value}</option>)}</select></label>}
    <button type="button" className="button button-accent" aria-label={`Add ${name} to bag`} onClick={addToBag}>Add to bag</button>
    {added && <p role="status">Added to your bag. <Link href="/cart">View bag</Link></p>}
    {error && <p role="alert" className="checkout-error">{error}</p>}
  </div>;
}
