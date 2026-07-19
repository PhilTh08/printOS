"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useHub } from "./hub-provider";
import styles from "./hub-shell.module.css";

const navigation = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "▦",
  },
  {
    href: "/statistiken",
    label: "Statistiken",
    icon: "▥",
  },
  {
    href: "/ein-auslagern",
    label: "Ein-/Auslagern",
    icon: "⌁",
  },
  {
    href: "/filamente",
    label: "Filamente",
    icon: "◫",
  },
  {
    href: "/protokoll",
    label: "Protokoll",
    icon: "≡",
  },
  {
    href: "/profil",
    label: "Profil",
    icon: "◎",
  },
  {
    href: "/einstellungen",
    label: "Einstellungen",
    icon: "⚙",
  },
];

export function HubShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    authReady,
    loading,
    displayName,
    signOut,
  } = useHub();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (authReady && !user) {
      router.replace("/");
    }
  }, [authReady, user, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const currentTitle = useMemo(() => {
    if (pathname.startsWith("/filamente/")) {
      return "Filament";
    }

    return (
      navigation.find((item) =>
        pathname.startsWith(item.href),
      )?.label ?? "Philamentix Hub"
    );
  }, [pathname]);

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  if (!authReady || (loading && !user)) {
    return (
      <div className={styles.fullscreenState}>
        Philamentix Hub wird geladen …
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.app}>
      <aside
        className={`${styles.sidebar} ${
          menuOpen ? styles.sidebarOpen : ""
        }`}
      >
        <div className={styles.brand}>
          <span className={styles.brandMark}>P</span>
          <div>
            <strong>Philamentix</strong>
            <small>Hub</small>
          </div>
        </div>

        <nav className={styles.navigation}>
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/filamente" &&
                pathname.startsWith("/filamente/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${
                  active ? styles.active : ""
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.userBox}>
          <div>
            <span>Angemeldet als</span>
            <strong>{displayName}</strong>
            <small>{user.email}</small>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
          >
            Abmelden
          </button>
        </div>
      </aside>

      {menuOpen && (
        <button
          className={styles.backdrop}
          aria-label="Menü schließen"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className={styles.workspace}>
        <header className={styles.mobileHeader}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenuOpen(true)}
            aria-label="Navigation öffnen"
          >
            ☰
          </button>
          <strong>{currentTitle}</strong>
          <span className={styles.mobileStatus} />
        </header>

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
