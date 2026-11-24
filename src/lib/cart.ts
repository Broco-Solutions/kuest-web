import { products, productColors } from "../data/products";

export type CartItem = { slug: string; color?: string; quantity: number };
export const CART_KEY = "kuest_cart_v1";
export const MAX_QUANTITY = 10;
export const MAX_CART_LINES = 20;
export const MAX_CART_UNITS = 50;
export function itemKey(item: Pick<CartItem, "slug" | "color">) {
  return JSON.stringify([item.slug, item.color ?? null]);
}
export function validateCart(value: unknown): CartItem[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_CART_LINES) throw new Error("Choose between 1 and 20 items.");
  const merged = new Map<string, CartItem>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Invalid bag item.");
    const row = entry as Record<string, unknown>;
    if (Object.keys(row).some(key => !["slug", "color", "quantity"].includes(key))) throw new Error("Invalid bag fields.");
    const product = products.find(p => p.slug === row.slug);
    if (!product) throw new Error("Unknown product.");
    const colors = productColors[product.slug];
    if (colors ? !colors.includes(row.color as string) : row.color !== undefined) throw new Error("Please select an available color.");
    if (!Number.isInteger(row.quantity) || (row.quantity as number) < 1 || (row.quantity as number) > MAX_QUANTITY) throw new Error("Quantity must be between 1 and 10.");
    const item: CartItem = { slug: product.slug, ...(colors ? { color: row.color as string } : {}), quantity: row.quantity as number };
    const key = itemKey(item);
    item.quantity += merged.get(key)?.quantity ?? 0;
    if (item.quantity > MAX_QUANTITY) throw new Error("Maximum 10 of each model and color.");
    merged.set(key, item);
  }
  const result = [...merged.values()];
  if (result.reduce((n, item) => n + item.quantity, 0) > MAX_CART_UNITS) throw new Error("Maximum 50 units per order.");
  return result;
}
export function restoreCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try { const parsed: unknown = JSON.parse(raw); return Array.isArray(parsed) && !parsed.length ? [] : validateCart(parsed); }
  catch { return []; }
}
export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + products.find(p => p.slug === item.slug)!.price * 100 * item.quantity, 0);
}
