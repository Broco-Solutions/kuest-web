import { createCheckout } from "@/lib/checkout";
export const runtime = "nodejs";
export async function POST(request: Request) { return createCheckout(request); }
