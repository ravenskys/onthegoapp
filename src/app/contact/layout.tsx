import type { Metadata } from "next";
import { marketingPageMetadata } from "@/lib/site-seo";

export const metadata: Metadata = marketingPageMetadata({
  title: "Contact Us",
  description:
    "Contact On The Go Maintenance by phone or email to schedule mobile vehicle service, inspections, or fleet support in Idaho—or use the booking request form.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
