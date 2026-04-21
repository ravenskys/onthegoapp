import type { Metadata, Viewport } from "next";
import "./globals.css";
import {
  SITE_DEFAULT_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  getDefaultOpenGraphImages,
  getSiteUrl,
} from "@/lib/site-seo";

const siteUrl = getSiteUrl();

const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME} | Mobile Automotive Maintenance & Inspections`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DEFAULT_DESCRIPTION,
  keywords: [...SITE_KEYWORDS],
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Mobile Automotive Maintenance`,
    description: SITE_DEFAULT_DESCRIPTION,
    images: getDefaultOpenGraphImages(),
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Mobile Automotive Maintenance`,
    description: SITE_DEFAULT_DESCRIPTION,
    images: [getDefaultOpenGraphImages()[0].url],
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  ...(googleVerification
    ? {
        verification: {
          google: googleVerification,
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
