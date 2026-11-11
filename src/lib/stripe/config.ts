import "server-only";

export class CheckoutError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function getStripeConfig() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const mode = process.env.STRIPE_MODE;
  if (!key || !webhookSecret?.startsWith("whsec_") ||
      (mode !== "test" && mode !== "live") ||
      !new RegExp(`^(rk|sk)_${mode}_[A-Za-z0-9]+$`).test(key)) {
    throw new CheckoutError(503, "Online payment is temporarily unavailable. Please visit our showroom.");
  }
  // A preview or local process must never create live Checkout Sessions.
  if (mode === "live" && process.env.VERCEL_ENV !== "production") {
    throw new CheckoutError(503, "Online payment is temporarily unavailable. Please visit our showroom.");
  }
  return { key, webhookSecret, livemode: mode === "live" };
}

export function getCheckoutConfig() {
  if (process.env.STRIPE_CHECKOUT_ENABLED !== "true") {
    throw new CheckoutError(503, "Online payment is not available yet. Please visit our showroom.");
  }
  const stripe = getStripeConfig();
  const taxMode = process.env.STRIPE_TAX_MODE;
  if (process.env.STRIPE_FULFILLMENT_MODE !== "showroom_pickup" ||
      (taxMode !== "automatic" && taxMode !== "included")) {
    throw new CheckoutError(503, "Online payment is temporarily unavailable. Please visit our showroom.");
  }
  let site: URL;
  try {
    site = new URL(process.env.SITE_URL ?? "");
  } catch {
    throw new CheckoutError(503, "Online payment is temporarily unavailable. Please visit our showroom.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(site.hostname);
  if (site.username || site.password || site.pathname !== "/" || site.search || site.hash ||
      (site.protocol !== "https:" && !(site.protocol === "http:" && local && !stripe.livemode)) ||
      (stripe.livemode && site.origin !== "https://kuest-electric.com")) {
    throw new CheckoutError(503, "Online payment is temporarily unavailable. Please visit our showroom.");
  }
  return { ...stripe, siteUrl: site.origin, taxMode };
}
