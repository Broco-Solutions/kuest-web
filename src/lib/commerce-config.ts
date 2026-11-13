export function priceVariable(slug: string) {
  return `STRIPE_PRICE_${slug.replaceAll("-", "_").toUpperCase()}`;
}

export function getStripeConfiguration() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const match = secretKey?.match(/^(?:sk|rk)_(test|live)_[A-Za-z0-9]+$/);
  return secretKey && match ? { secretKey, livemode: match[1] === "live" } : null;
}

export function getCheckoutConfiguration() {
  const stripe = getStripeConfiguration();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const pickupLocation = process.env.STRIPE_PICKUP_TAX_LOCATION?.trim();
  if (!stripe || !webhookSecret?.startsWith("whsec_") || !/^taxloc_[A-Za-z0-9]+$/.test(pickupLocation ?? "")) return null;
  if (stripe.livemode && (
    process.env.NODE_ENV !== "production" ||
    process.env.STRIPE_LIVE_CHECKOUT_ENABLED !== "true" ||
    (process.env.VERCEL_ENV !== undefined && process.env.VERCEL_ENV !== "production")
  )) return null;
  try {
    const url = new URL(process.env.SITE_URL ?? "");
    const local = !stripe.livemode && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((!local && url.protocol !== "https:") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (stripe.livemode && url.origin !== "https://kuest-electric.com") return null;
    return { ...stripe, siteOrigin: url.origin, pickupLocation: pickupLocation! };
  } catch {
    return null;
  }
}
