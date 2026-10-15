import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://agents.index";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/es/admin", "/en/admin", "/api/"] }],
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
