"use client";

import { useId, useRef, useState } from "react";
import { ArrowIcon } from "./arrow-icon";

export function BuyButton({ productSlug }: { productSlug: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const requestId = useRef<string | null>(null);
  const errorId = useId();

  async function buy() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      // Reuse on network errors so retries cannot create a second Session.
      requestId.current ??= crypto.randomUUID();
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug, requestId: requestId.current }),
      });
      const data = await response.json();
      if (!response.ok) {
        requestId.current = null;
        throw new Error(typeof data.error === "string" ? data.error : "Payment is unavailable. Please try again.");
      }
      if (typeof data.url !== "string" || new URL(data.url).origin !== "https://checkout.stripe.com") {
        throw new Error("We could not open secure checkout. Please try again.");
      }
      window.location.assign(data.url);
    } catch (failure) {
      setError(failure instanceof Error && !(failure instanceof TypeError)
        ? failure.message : "Please check your connection and try again.");
      busy.current = false;
      setPending(false);
    }
  }

  return <div className="product-purchase">
    <button className="button button-accent buy-button" type="button" disabled={pending}
      aria-busy={pending} aria-describedby={error ? errorId : undefined} onClick={buy}>
      {pending ? "Opening secure checkout…" : "Buy for showroom pickup"}<ArrowIcon />
    </button>
    {error && <p className="checkout-error" role="alert" id={errorId}>{error}</p>}
  </div>;
}
