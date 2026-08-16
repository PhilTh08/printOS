"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./layout.module.css";

const ADMIN_AREAS = [
  {
    href: "/admin",
    icon: "◆",
    label: "Admin & Support",
    description: "Benutzer, Wartung & Support",
  },
  {
    href: "/admin/releases",
    icon: "↟",
    label: "Release Center",
    description: "Production · Beta · Public",
  },
  {
    href: "/admin/logs",
    icon: "≡",
    label: "System-Log",
    description: "Alle wichtigen Systemaktionen",
  },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.adminShell}>
      <nav className={styles.areaBar} aria-label="Admin Center">
        <div className={styles.areaBarLabel}>
          <span>ADMIN CENTER</span>
          <small>V18.5 BETA</small>
        </div>

        <div className={styles.areaLinks}>
          {ADMIN_AREAS.map((area) => {
            const active =
              area.href === "/admin"
                ? pathname === "/admin"
                : pathname === area.href || pathname.startsWith(`${area.href}/`);

            return (
              <Link
                key={area.href}
                href={area.href}
                className={`${styles.areaLink} ${active ? styles.areaLinkActive : ""}`}
              >
                <span className={styles.areaIcon}>{area.icon}</span>
                <span className={styles.areaText}>
                  <strong>{area.label}</strong>
                  <small>{area.description}</small>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={styles.adminContent}>{children}</div>
    </div>
  );
}
