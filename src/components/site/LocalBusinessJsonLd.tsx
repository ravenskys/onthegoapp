import {
  SITE_EMAIL,
  SITE_PHONE_E164,
} from "@/lib/site-contact";
import {
  SITE_DEFAULT_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
  getSiteUrl,
} from "@/lib/site-seo";

/**
 * Automotive / local service structured data for Google rich results eligibility.
 * Renders on the marketing home page only.
 */
export function LocalBusinessJsonLd() {
  const url = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "AutomotiveRepair",
    name: SITE_NAME,
    description: SITE_DEFAULT_DESCRIPTION,
    url,
    image: absoluteUrl("/logo-transparent-2026.png"),
    telephone: SITE_PHONE_E164,
    email: SITE_EMAIL,
    areaServed: {
      "@type": "State",
      name: "Idaho",
    },
    priceRange: "$$",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
