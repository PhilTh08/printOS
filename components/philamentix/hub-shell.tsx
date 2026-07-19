"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { useHub } from "./hub-provider";

const navigation = [
  {
    title: "Übersicht",
    items: [
      { href: "/dashboard", icon: "⌂", label: "Dashboard" },
      { href: "/statistiken", icon: "▥", label: "Statistik" },
    ],
  },
  {
    title: "Lager",
    items: [
      { href: "/ein-auslagern", icon: "▣", label: "Ein-/Auslagerung" },
      { href: "/filamente", icon: "▤", label: "Filamenttypen" },
      { href: "/protokoll", icon: "≡", label: "Protokoll" },
    ],
  },
  {
    title: "Konto",
    items: [
      { href: "/profil", icon: "●", label: "Profil & Sicherheit" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/einstellungen", icon: "⚙", label: "Einstellungen" },
    ],
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
    busy,
    error,
    displayName,
    signOut,
    exportData,
    importData,
  } = useHub();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authReady && !user) {
      router.replace("/");
    }
  }, [authReady, user, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sidebarOpen]);

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  async function handleImport(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      await importData(file);
      window.alert("Backup wurde erfolgreich importiert.");
    } catch (caughtError) {
      window.alert(
        caughtError instanceof Error
          ? caughtError.message
          : "Backup konnte nicht importiert werden.",
      );
    }
  }

  if (!authReady || (loading && !user)) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="login-brand">
            <div className="login-logo">
              Philamentix<span>Hub</span>
            </div>
            <p>FILAMENT MANAGEMENT</p>
          </div>
          <div className="login-heading">
            <span className="login-lock">●</span>
            <div>
              <h1>Daten werden geladen</h1>
              <p>Dein persönlicher Lagerbestand wird synchronisiert.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="app-shell">
      <header className="mobile-app-header">
        <button
          className="mobile-menu-button"
          type="button"
          aria-label="Navigation öffnen"
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="mobile-logo">
          Philamentix<span>Hub</span>
        </div>

        <span className="mobile-sync-status">
          <i />
          Online
        </span>
      </header>

      <button
        className={`sidebar-overlay ${
          sidebarOpen ? "visible" : ""
        }`}
        type="button"
        aria-label="Navigation schließen"
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-brand-row">
          <div>
            <div className="logo">
              Philamentix<span>Hub</span>
            </div>
            <p className="version">
              FILAMENT MANAGEMENT // V1.0
            </p>
          </div>

          <button
            className="sidebar-close-button"
            type="button"
            aria-label="Navigation schließen"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <nav>
          {navigation.map((group) => (
            <div key={group.title}>
              <p className="nav-title">{group.title}</p>
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href === "/filamente" &&
                    pathname.startsWith("/filamente/"));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-button nav-button-link ${
                      active ? "active" : ""
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}

          <p className="nav-title">Daten</p>

          <button
            className="nav-button"
            type="button"
            onClick={() => {
              exportData();
              setSidebarOpen(false);
            }}
          >
            <span>⇩</span>
            Daten exportieren
          </button>

          <button
            className="nav-button"
            type="button"
            onClick={() => {
              importInputRef.current?.click();
              setSidebarOpen(false);
            }}
          >
            <span>⇧</span>
            Daten importieren
          </button>

          <input
            ref={importInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleImport(event)}
          />
        </nav>

        <div className="sidebar-account">
          <Link
            className="sidebar-account-info sidebar-account-link"
            href="/profil"
          >
            <span>Angemeldet als</span>
            <strong>{displayName}</strong>
            <small>{user.email}</small>
          </Link>

          <button
            className="sidebar-logout-button"
            type="button"
            onClick={() => void handleSignOut()}
          >
            Abmelden
          </button>
        </div>
      </aside>

      <main className="main-content">
        {loading && (
          <div className="database-status-banner">
            Supabase-Daten werden geladen …
          </div>
        )}

        {error && (
          <div className="database-error-banner">
            <strong>Datenbankfehler:</strong> {error}
          </div>
        )}

        {busy && (
          <div className="database-saving-indicator">
            Wird gespeichert …
          </div>
        )}

        <div className="route-page">{children}</div>
      </main>
    </div>
  );
}
