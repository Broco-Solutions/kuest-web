"use client";
import { useEffect } from "react";
import { useCart } from "./cart-store";
export function PaidBagCleanup({ sessionId }: { sessionId: string }) {
  const { clearIfMatches } = useCart();
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("kuest_checkout_bag");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.sessionId !== sessionId) return;
      clearIfMatches(JSON.stringify(saved.items));
      sessionStorage.removeItem("kuest_checkout_bag");
    } catch { /* Payment remains confirmed if browser storage is unavailable. */ }
  }, [sessionId, clearIfMatches]);
  return null;
}
