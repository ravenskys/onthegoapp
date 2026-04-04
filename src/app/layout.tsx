import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "On The Go Maintenance",
  description: "Mobile vehicle maintenance, inspections, and customer portal for On The Go Maintenance",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
