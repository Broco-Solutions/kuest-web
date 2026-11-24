"use client";
import Link from "next/link";
import { useCart } from "./cart-store";
export function BagLink() {
  const { items } = useCart();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return <Link href="/cart" className="bag-link" aria-label={`Shopping bag, ${count} items`}>Bag <span>{count}</span></Link>;
}
