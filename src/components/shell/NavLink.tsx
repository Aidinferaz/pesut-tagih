"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type Props = {
  href: string;
  className: string;
  activeClassName: string;
  children: ReactNode;
};

/**
 * A nav link that knows when it is the current page. Reading the path is
 * request data on dynamic routes, so the plain link renders first and the
 * active state streams in.
 */
export function NavLink(props: Props) {
  return (
    <Suspense
      fallback={
        <Link href={props.href} className={props.className}>
          {props.children}
        </Link>
      }
    >
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink({ href, className, activeClassName, children }: Props) {
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
