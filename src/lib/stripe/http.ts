import "server-only";
import { CheckoutError } from "./config";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readLimitedBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new CheckoutError(413, "Request is too large.");
  }
  if (!request.body) throw new CheckoutError(400, "Request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new CheckoutError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
