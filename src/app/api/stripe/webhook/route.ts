import { receiveWebhook } from "@/lib/payment";
export const runtime = "nodejs";
export async function POST(request: Request) { return receiveWebhook(request); }
