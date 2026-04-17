"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUserRoles } from "@/lib/portal-auth";
import { getBookNowHref, PUBLIC_BOOK_NOW_HREF } from "@/lib/site-booking";

type BookNowLinkProps = {
  className?: string;
  children: React.ReactNode;
};

/**
 * Contact / scheduling entry: `/contact` for guests, customer scheduler when signed in with portal access.
 */
export function BookNowLink({ className, children }: BookNowLinkProps) {
  const [href, setHref] = useState(PUBLIC_BOOK_NOW_HREF);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const { roles } = await getUserRoles();
        if (isMounted) {
          setHref(getBookNowHref(roles));
        }
      } catch {
        if (isMounted) {
          setHref(PUBLIC_BOOK_NOW_HREF);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
