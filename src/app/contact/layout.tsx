import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Contact Us",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
