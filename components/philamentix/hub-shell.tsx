"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { useHub } from "./hub-provider";
import {
  MAINTENANCE_AREAS,
  maintenanceAreaForPathname,
} from "./maintenance";

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
      { href: "/nachbestellen", icon: "!", label: "Nachbestellen" },
      { href: "/protokoll", icon: "≡", label: "Protokoll" },
    ],
  },
  {
    title: "Produktion",
    items: [
      {
        href: "/auftraege",
        icon: "▧",
        label: "Aufträge",
      },
      {
        href: "/druckbibliothek",
        icon: "◇",
        label: "Druckbibliothek",
      },
      {
        href: "/produktion",
        icon: "▦",
        label: "Produktion",
      },
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

const adminNavigation = {
  title: "Administration",
  items: [
    {
      href: "/admin",
      icon: "◆",
      label: "Admin & Support",
    },
    {
      href: "/admin/releases",
      icon: "↟",
      label: "Release Center",
    },
    {
      href: "/admin/logs",
      icon: "≡",
      label: "System-Log",
    },
  ],
};

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
    isAdmin,
    adminRoleReady,
    releaseInfo,
    releaseReady,
    hasReleaseAccess,
    maintenanceReady,
    isAreaInMaintenance,
    isAreaHidden,
    maintenanceMessageForArea,
    filaments,
    signOut,
  } = useHub();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const visibleNavigation = isAdmin
    ? [...navigation, adminNavigation]
    : navigation;
  const reorderCount = filaments.filter(
    (filament) =>
      filament.stock <= filament.minimumStock,
  ).length;
  const currentMaintenanceArea =
    maintenanceAreaForPathname(pathname);
  const currentAreaMeta = MAINTENANCE_AREAS.find(
    (area) => area.id === currentMaintenanceArea,
  );
  const currentAreaBlocked = Boolean(
    adminRoleReady &&
      maintenanceReady &&
      !isAdmin &&
      currentMaintenanceArea &&
      isAreaInMaintenance(currentMaintenanceArea),
  );
  const currentAreaHidden = Boolean(
    adminRoleReady &&
      maintenanceReady &&
      !isAdmin &&
      currentMaintenanceArea &&
      isAreaHidden(currentMaintenanceArea),
  );
  const currentMaintenanceMessage =
    currentMaintenanceArea
      ? maintenanceMessageForArea(currentMaintenanceArea)
      : "";

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
              {releaseInfo.channel} // {releaseInfo.version}
            </p>
            {releaseInfo.betaTester && (
              <span className="sidebar-beta-tester-badge">
                BETA TESTER
              </span>
            )}
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

        {releaseInfo.messageEnabled &&
          releaseInfo.message.trim() && (
            <div
              className={`sidebar-roll-message ${
                releaseInfo.audience === "beta"
                  ? "sidebar-roll-message-beta"
                  : ""
              }`}
              title={releaseInfo.message}
              aria-label={`Systemmeldung: ${releaseInfo.message}`}
              data-roll-speed={releaseInfo.rollMessageSpeed}
            >
              <span className="sidebar-roll-message-text">
                {releaseInfo.message}
              </span>
            </div>
          )}

        <nav>
          {visibleNavigation.map((group) => {
            const visibleItems = group.items.filter((item) => {
              if (
                item.href === "/produktion" &&
                (!releaseReady || !hasReleaseAccess("18.0"))
              ) {
                return false;
              }

              const area = maintenanceAreaForPathname(item.href);

              return !(
                adminRoleReady &&
                !isAdmin &&
                maintenanceReady &&
                area &&
                isAreaHidden(area)
              );
            });

            if (visibleItems.length === 0) {
              return null;
            }

            return (
              <div key={group.title}>
                <p className="nav-title">{group.title}</p>
                {visibleItems.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href === "/filamente" &&
                      pathname.startsWith("/filamente/")) ||
                    (item.href === "/druckbibliothek" &&
                      pathname.startsWith("/druckbibliothek/")) ||
                    (item.href !== "/admin" &&
                      item.href.startsWith("/admin/") &&
                      pathname.startsWith(`${item.href}/`));
                  const itemMaintenanceArea =
                    maintenanceAreaForPathname(item.href);
                  const itemInMaintenance = Boolean(
                    adminRoleReady &&
                      !isAdmin &&
                      maintenanceReady &&
                      itemMaintenanceArea &&
                      isAreaInMaintenance(itemMaintenanceArea),
                  );

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-button nav-button-link ${
                        active ? "active" : ""
                      } ${
                        itemInMaintenance
                          ? "nav-button-maintenance"
                          : ""
                      }`}
                      title={
                        itemInMaintenance
                          ? `${item.label} befindet sich im Wartungsmodus`
                          : undefined
                      }
                    >
                      <span>{item.icon}</span>
                      <span className="nav-item-label">
                        {item.label}
                      </span>
                      {itemInMaintenance && (
                        <span className="nav-maintenance-badge">
                          WARTUNG
                        </span>
                      )}
                      {item.href === "/nachbestellen" &&
                        reorderCount > 0 && (
                          <span className="nav-alert-badge">
                            {reorderCount > 99
                              ? "99+"
                              : reorderCount}
                          </span>
                        )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
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

        <div className="route-page">
          {currentAreaHidden ? (
            <section className="maintenance-screen maintenance-screen-hidden">
              <div className="maintenance-screen-icon">◌</div>
              <span className="maintenance-screen-kicker">
                BEREICH AUSGEBLENDET
              </span>
              <h1>
                {currentAreaMeta?.label ?? "Dieser Bereich"} ist für
                deinen Account aktuell nicht freigeschaltet
              </h1>
              <p>
                Dieser Bereich wurde durch die Administration ausgeblendet.
                Der Inhalt wird für deinen Account nicht geladen.
              </p>
              <div className="maintenance-screen-status">
                <i />
                Andere freigegebene Bereiche kannst du normal weiter nutzen.
              </div>
            </section>
          ) : currentAreaBlocked ? (
            <section className="maintenance-screen">
              <div className="maintenance-screen-icon">⚙</div>
              <span className="maintenance-screen-kicker">
                WARTUNGSMODUS
              </span>
              <h1>
                {currentAreaMeta?.label ?? "Dieser Bereich"} ist
                vorübergehend nicht verfügbar
              </h1>
              <p>
                {currentMaintenanceMessage ||
                  "Dieser Bereich wird gerade gewartet. Bitte versuche es später erneut."}
              </p>
              <div className="maintenance-screen-status">
                <i />
                Deine Daten bleiben unverändert gespeichert.
              </div>
              <button
                type="button"
                className="maintenance-signout-button"
                onClick={() => void handleSignOut()}
              >
                Abmelden
              </button>
            </section>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
