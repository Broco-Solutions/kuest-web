"use client";
import { useSyncExternalStore } from "react";
import { CART_KEY, itemKey, restoreCart, validateCart, type CartItem } from "@/lib/cart";
const empty: CartItem[] = [];
let rawCache: string | null | undefined;
let snapshot: CartItem[] = empty;
const listeners = new Set<() => void>();
function getSnapshot() {
  try { const raw = localStorage.getItem(CART_KEY); if (raw !== rawCache) { rawCache = raw; snapshot = restoreCart(raw); } }
  catch { /* The bag also works in memory when storage is blocked. */ }
  return snapshot;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const changed = (event: StorageEvent) => { if (event.key === CART_KEY || event.key === null) listener(); };
  window.addEventListener("storage", changed);
  return () => { listeners.delete(listener); window.removeEventListener("storage", changed); };
}
function save(items: CartItem[]) {
  const next = items.length ? validateCart(items) : [];
  const raw = JSON.stringify(next);
  try { localStorage.setItem(CART_KEY, raw); rawCache = raw; } catch { /* Keep the in-memory bag. */ }
  snapshot = next; listeners.forEach(listener => listener());
}
export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => empty);
  return { items,
    add(item: CartItem) { save([...getSnapshot(), item]); },
    update(key: string, quantity: number) { save(getSnapshot().map(item => itemKey(item) === key ? { ...item, quantity } : item)); },
    remove(key: string) { save(getSnapshot().filter(item => itemKey(item) !== key)); },
    clearIfMatches(saved: string) { if (JSON.stringify(getSnapshot()) === saved) save([]); },
  };
}
