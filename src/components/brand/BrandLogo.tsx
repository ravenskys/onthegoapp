"use client";

import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  surface?: "light" | "dark";
};

export function BrandLogo({
  className = "",
  priority = false,
  surface = "light",
}: BrandLogoProps) {
  const wrapperClassName = [
    "otg-brand-logo",
    surface === "dark" ? "otg-brand-logo-dark-surface" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClassName}>
      <Image
        src="/logo-transparent-2026.png"
        alt="On The Go Maintenance"
        width={1024}
        height={1024}
        priority={priority}
        className="h-auto w-full"
      />
    </div>
  );
}
