import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/customer/",
        "/manager/",
        "/tech/",
        "/admin/",
        "/portal",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
