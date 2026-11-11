import "server-only";
import Stripe from "stripe";
import { getStripeConfig } from "./config";

export function getStripe() {
  return new Stripe(getStripeConfig().key, {
    apiVersion: "2026-10-28.endive",
    maxNetworkRetries: 2,
    timeout: 10000,
    appInfo: { name: "KUEST Electric", version: "1.0.0" },
  });
}

// Never log Stripe errors: request details can contain credentials or customer data.
export function logPaymentError(operation: string, error: unknown) {
  console.error(`Stripe ${operation} failed`, {
    type: error instanceof Stripe.errors.StripeError ? error.type : "InternalError",
  });
}
