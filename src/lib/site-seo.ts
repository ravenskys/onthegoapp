import type { Metadata } from "next";

/** Set `NEXT_PUBLIC_SITE_URL` in production (e.g. https://www.yoursite.com). */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (raw) {
    return raw;
  }
  return "http://localhost:3000";
}

export const SITE_NAME = "On The Go Maintenance";

export const SITE_DEFAULT_DESCRIPTION =
  "Mobile automotive maintenance, inspections, and fleet support in Idaho. We come to your home, workplace, or job site—plus online scheduling and a customer portal.";

/** Primary keywords for default metadata (Google uses page content first; this supports relevance). */
export const SITE_KEYWORDS = [
  "mobile mechanic Idaho",
  "mobile oil change",
  "fleet vehicle maintenance",
  "vehicle inspection",
  "On The Go Maintenance",
  "Boise mobile auto service",
] as const;

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === "/") {
    return base;
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getDefaultOpenGraphImages() {
  return [
    {
      url: absoluteUrl("/logo-transparent-2026.png"),
      width: 512,
      height: 512,
      alt: `${SITE_NAME} logo`,
    },
  ];
}

/** Shared SEO fields for public marketing routes (canonical, Open Graph, Twitter). */
export function marketingPageMetadata(params: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const { title, description, path } = params;
  const canonical = absoluteUrl(path);
  const ogTitle = `${title} | ${SITE_NAME}`;
  const images = getDefaultOpenGraphImages();
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description,
      url: canonical,
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [images[0].url],
    },
  };
}
