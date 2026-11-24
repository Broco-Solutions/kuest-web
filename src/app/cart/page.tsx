import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { products } from "@/data/products";
import { getCheckoutConfiguration, priceVariable } from "@/lib/commerce-config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your bag | KUEST", robots: { index: false, follow: false }, alternates: { canonical: "/cart" } };
export default function CartPage() {
  const availableSlugs = getCheckoutConfiguration() ? products.filter(p => /^price_[A-Za-z0-9]+$/.test(process.env[priceVariable(p.slug)] ?? "")).map(p => p.slug) : [];
  return <CartView availableSlugs={availableSlugs} />;
}
