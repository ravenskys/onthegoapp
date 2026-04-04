import Link from "next/link";
import Image from "next/image";
import { siteNavItems } from "./site-config";

type SiteHeaderProps = {
  activePath: string;
};

export function SiteHeader({ activePath }: SiteHeaderProps) {
  return (
    <header className="otg-site-header">
      <div className="otg-site-container otg-site-nav">
        <Link href="/" className="otg-site-logo">
          <Image
            src="/logo-transparent-2026.png"
            alt="On The Go Maintenance Logo"
            width={56}
            height={56}
          />
          <div className="otg-site-logo-text">
            On The <span>Go</span> Maintenance
          </div>
        </Link>

        <nav>
          <ul className="otg-site-nav-links">
            {siteNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={activePath === item.href ? "active" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
