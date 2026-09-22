import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0].toLowerCase();

  if (hostname === "www.kuest-electric.com") {
    const destination = new URL(request.nextUrl.pathname + request.nextUrl.search, "https://kuest-electric.com");
    return NextResponse.redirect(destination, 308);
  }

  return NextResponse.next();
}

export const config = { matcher: "/:path*" };
