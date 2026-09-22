import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://kuest-electric.com", changeFrequency: "monthly", priority: 1 }];
}
