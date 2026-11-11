import { getStripe, logPaymentError } from "@/lib/stripe/client";
import { CheckoutError, getCheckoutConfig } from "@/lib/stripe/config";
import { createCheckout, parsePurchase } from "@/lib/stripe/checkout";
import { json, readLimitedBody } from "@/lib/stripe/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const config = getCheckoutConfig();
    // Never derive redirect URLs from Host / X-Forwarded-Host or client input.
    if (request.headers.get("origin") !== config.siteUrl ||
        request.headers.get("sec-fetch-site") === "cross-site") {
      return json({ error: "Please start checkout from the KUEST website." }, 403);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return json({ error: "A JSON request is required." }, 415);
    }
    const body = await readLimitedBody(request, 1024);
    let input: unknown;
    try { input = JSON.parse(body); }
    catch { return json({ error: "Invalid request." }, 400); }
    const { product, requestId } = parsePurchase(input);
    return json({ url: await createCheckout(getStripe(), product, requestId) });
  } catch (error) {
    if (error instanceof CheckoutError) return json({ error: error.message }, error.status);
    logPaymentError("checkout", error);
    return json({ error: "We could not start payment. Please try again or visit our showroom." }, 502);
  }
}
