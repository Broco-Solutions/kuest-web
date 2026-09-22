import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: "https://kuest-electric.com/sitemap.xml", host: "https://kuest-electric.com" };
}
