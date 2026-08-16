"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { supabase } from "@/lib/supabase";
import styles from "./layout.module.css";

const ADMIN_AREAS = [
  { href: "/admin", label: "Admin & Support" },
  { href: "/admin/releases", label: "Release" },
  { href: "/admin/logs", label: "System-Log" },
  { href: "/admin/status", label: "Systemstatus" },
] as const;

type AdminAccountLabel = {
  id: string;
  email: string;
  displayName?: string;
  isAdmin?: boolean;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
        const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>("button"));
        const oldRelease = buttons.find((button) => button.textContent?.trim() === "Release");
        if (oldRelease) oldRelease.style.display = "none";

        if (window.localStorage.getItem("philamentix-admin-section") === "release") {
          window.localStorage.setItem("philamentix-admin-section", "users");
          const usersButton = buttons.find((button) => button.textContent?.trim() === "Benutzer");
          usersButton?.click();
        }

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

  useEffect(() => {
    if (pathname !== "/admin") return;

    let cancelled = false;
    let observer: MutationObserver | null = null;
    const cleanupListeners: Array<() => void> = [];

    const setupMaintenanceAccountLabels = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const response = await fetch("/api/admin/users", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok || cancelled) return;

        const result = await response.json() as { users?: AdminAccountLabel[] };
        const users = result.users ?? [];
        const accountById = new Map(users.map((account) => [account.id, account]));

        const updateLabels = () => {
          if (cancelled) return;

          for (const select of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
            const matchingOptions = Array.from(select.options).filter((option) => accountById.has(option.value));
            if (matchingOptions.length === 0) continue;

            for (const option of matchingOptions) {
              const account = accountById.get(option.value);
              if (!account) continue;
              option.textContent = `${account.email}${account.isAdmin ? " · Admin" : ""}`;
            }

            const updateSecondaryLabel = () => {
              const account = accountById.get(select.value);
              const small = select.parentElement?.querySelector<HTMLElement>("small");
              if (!small || !account) return;
              small.textContent = account.displayName && account.displayName !== account.email
                ? account.displayName
                : "";
            };

            updateSecondaryLabel();
            if (select.dataset.maintenanceEmailLabels !== "true") {
              select.dataset.maintenanceEmailLabels = "true";
              select.addEventListener("change", updateSecondaryLabel);
              cleanupListeners.push(() => select.removeEventListener("change", updateSecondaryLabel));
            }
          }
        };

        updateLabels();
        observer = new MutationObserver(updateLabels);
        observer.observe(document.body, { childList: true, subtree: true });
      } catch {
        // Die Wartungsansicht bleibt auch ohne Zusatz-Label vollständig nutzbar.
      }
    };

    void setupMaintenanceAccountLabels();

    return () => {
      cancelled = true;
      observer?.disconnect();
      cleanupListeners.forEach((cleanup) => cleanup());
    };
  }, [pathname]);

  const integratedLinks = adminSectionNav
    ? createPortal(
        <>
          <span className={styles.navDivider} aria-hidden="true" />
          <Link className={styles.integratedAdminLink} href="/admin/releases">
            <span className={styles.navDot} aria-hidden="true" />
            Release
          </Link>
          <Link className={styles.integratedAdminLink} href="/admin/logs">
            <span className={styles.navDot} aria-hidden="true" />
            System-Log
          </Link>
          <Link className={styles.integratedAdminLink} href="/admin/status">
            <span className={styles.navDot} aria-hidden="true" />
            Systemstatus
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
            const active = area.href === "/admin" ? pathname === "/admin" : pathname === area.href || pathname.startsWith(`${area.href}/`);
            return (
              <Link key={area.href} href={area.href} className={`${styles.subpageLink} ${active ? styles.subpageLinkActive : ""}`}>
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
