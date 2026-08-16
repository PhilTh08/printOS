"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./layout.module.css";

const ADMIN_AREAS = [
  {
    href: "/admin",
    label: "Admin & Support",
  },
  {
    href: "/admin/releases",
    label: "Release Center",
  },
  {
    href: "/admin/logs",
    label: "System-Log",
  },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [adminSectionNav, setAdminSectionNav] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname !== "/admin") {
      setAdminSectionNav(null);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const findNav = () => {
      if (cancelled) return;

      const nav = document.querySelector<HTMLElement>('nav[aria-label="Adminbereiche"]');
      if (nav) {
        setAdminSectionNav(nav);
        return;
      }

      attempts += 1;
      if (attempts < 20) window.setTimeout(findNav, 50);
    };

    findNav();

    return () => {
      cancelled = true;
      setAdminSectionNav(null);
    };
  }, [pathname]);

  const integratedLinks = adminSectionNav
    ? createPortal(
        <>
          <span className={styles.navDivider} aria-hidden="true" />
          <Link className={styles.integratedAdminLink} href="/admin/releases">
            <span className={styles.navDot} aria-hidden="true" />
            Release Center
          </Link>
          <Link className={styles.integratedAdminLink} href="/admin/logs">
            <span className={styles.navDot} aria-hidden="true" />
            System-Log
          </Link>
        </>,
        adminSectionNav,
      )
    : null;

  const showSubpageNavigation = pathname !== "/admin";

  return (
    <div className={styles.adminShell}>
      {showSubpageNavigation && (
        <nav className={styles.subpageBar} aria-label="Admin Center Navigation">
          {ADMIN_AREAS.map((area) => {
            const active =
              area.href === "/admin"
                ? pathname === "/admin"
                : pathname === area.href || pathname.startsWith(`${area.href}/`);

            return (
              <Link
                key={area.href}
                href={area.href}
                className={`${styles.subpageLink} ${active ? styles.subpageLinkActive : ""}`}
              >
                <span className={styles.navDot} aria-hidden="true" />
                <strong>{area.label}</strong>
              </Link>
            );
          })}
        </nav>
      )}

      {integratedLinks}
      <div className={styles.adminContent}>{children}</div>
    </div>
  );
}
