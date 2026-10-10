"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A nav link that knows when it is the current page. */
export function NavLink({
  href,
  className,
  activeClassName,
  children,
}: {
  href: string;
  className: string;
  activeClassName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? activeClassName : ""}`}
    >
      {children}
    </Link>
  );
}
