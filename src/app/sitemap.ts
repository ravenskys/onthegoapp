import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = new Date();
  const paths: { path: string; changeFrequency: "weekly" | "monthly"; priority: number }[] = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/about", changeFrequency: "monthly", priority: 0.85 },
    { path: "/services", changeFrequency: "monthly", priority: 0.9 },
    { path: "/fleet-services", changeFrequency: "monthly", priority: 0.85 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.9 },
  ];

  return paths.map(({ path, changeFrequency, priority }) => ({
    url: path === "" ? base : `${base}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
