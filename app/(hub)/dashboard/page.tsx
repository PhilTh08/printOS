"use client";

import Link from "next/link";

import { useHub } from "@/components/philamentix/hub-provider";
import { buildMaterialSummary } from "@/components/philamentix/statistics";

import styles from "./page.module.css";

export default function DashboardPage() {
  const { filaments, logs, displayName } = useHub();

  const totalRolls = filaments.reduce(
    (sum, filament) => sum + filament.stock,
    0,
  );
  const totalWeight = filaments.reduce(
    (sum, filament) =>
      sum + filament.stock * filament.weightPerRoll,
    0,
  );
  const criticalFilaments = filaments.filter(
    (filament) =>
      filament.stock <= filament.minimumStock,
  );
  const today = new Date();
  const todaysLogs = logs.filter((entry) => {
    const date = new Date(entry.timestamp);
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  });
  const todaysIn = todaysLogs.filter(
    (entry) => entry.action === "in",
  ).length;
  const todaysOut = todaysLogs.filter(
    (entry) => entry.action === "out",
  ).length;
  const materialSummary = buildMaterialSummary(
    filaments,
    logs,
  );
  const largestMaterialStock = Math.max(
    1,
    ...materialSummary.map((item) => item.stock),
  );
  const recentLogs = logs.slice(0, 5);

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <span className="welcome-label">
            Willkommen zurück,
          </span>
          <h1>{displayName}</h1>
          <p>
            Bestand, Bewegungen und Warnungen auf einen Blick
          </p>
        </div>

        <div className="system-status">
          <span className="status-dot" />
          System aktuell
        </div>
      </header>

      <section className="dashboard-kpis">
        <article className="dashboard-kpi">
          <span>Rollen im Lager</span>
          <strong>{totalRolls}</strong>
          <small>{filaments.length} Filamenttypen</small>
        </article>

        <article className="dashboard-kpi">
          <span>Gesamtgewicht</span>
          <strong className="blue">
            {(totalWeight / 1000).toLocaleString(
              "de-DE",
            )}{" "}
            kg
          </strong>
          <small>Aktueller Lagerbestand</small>
        </article>

        <article className="dashboard-kpi">
          <span>Kritische Bestände</span>
          <strong className="red">
            {criticalFilaments.length}
          </strong>
          <small>Bestand ≤ Mindestbestand</small>
        </article>

        <article className="dashboard-kpi">
          <span>Bewegungen heute</span>
          <strong>{todaysLogs.length}</strong>
          <small>
            <span className="dashboard-in">+{todaysIn}</span>{" "}
            /{" "}
            <span className="dashboard-out">−{todaysOut}</span>
          </small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Materialverteilung</h2>
              <p>Rollenbestand nach Material</p>
            </div>
          </div>

          {materialSummary.length === 0 ? (
            <p className="empty-message">
              Noch keine Filamente vorhanden.
            </p>
          ) : (
            <div className="material-summary">
              {materialSummary.map((item) => {
                const percentage =
                  (item.stock / largestMaterialStock) * 100;

                return (
                  <div
                    className="material-summary-row"
                    key={item.material}
                  >
                    <div className="material-summary-label">
                      <span>{item.material}</span>
                      <strong>{item.stock} Rollen</strong>
                    </div>
                    <div className="material-summary-bar">
                      <div
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="panel dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Kritische Bestände</h2>
              <p>Filamente mit Handlungsbedarf</p>
            </div>

            <Link
              className="dashboard-link-button"
              href="/nachbestellen"
            >
              Nachbestellen
            </Link>
          </div>

          {criticalFilaments.length === 0 ? (
            <div className="dashboard-all-good">
              <span>✓</span>
              <div>
                <strong>Alles im grünen Bereich</strong>
                <p>
                  Kein Filament liegt unter dem Mindestbestand.
                </p>
              </div>
            </div>
          ) : (
            <div className="dashboard-warning-list">
              {criticalFilaments
                .slice(0, 4)
                .map((filament) => (
                  <Link
                    className="dashboard-warning-row"
                    key={filament.id}
                    href={`/filamente/${filament.id}`}
                  >
                    <div>
                      <strong>
                        {filament.material} {filament.color}
                      </strong>
                      <span>{filament.manufacturer}</span>
                    </div>
                    <div className="dashboard-warning-stock">
                      <strong>{filament.stock}</strong>
                      <span>
                        Minimum {filament.minimumStock}
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </article>

        <article className="panel dashboard-panel dashboard-recent">
          <div className="dashboard-panel-header">
            <div>
              <h2>Letzte Bewegungen</h2>
              <p>Die fünf neuesten Lageraktionen</p>
            </div>

            <Link
              className="dashboard-link-button"
              href="/protokoll"
            >
              Alle anzeigen
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <p className="empty-message">
              Noch keine Lagerbewegungen vorhanden.
            </p>
          ) : (
            <div className="recent-movements">
              {recentLogs.map((entry) => (
                <div
                  className="recent-movement-row"
                  key={entry.id}
                >
                  <span
                    className={`recent-movement-symbol ${
                      entry.action === "in"
                        ? "recent-movement-in"
                        : "recent-movement-out"
                    }`}
                  >
                    {entry.action === "in" ? "+" : "−"}
                  </span>

                  <div className="recent-movement-main">
                    <strong>{entry.filamentName}</strong>
                    <span>
                      {entry.source === "scan"
                        ? "Barcode-Scanner"
                        : "Manuelle Änderung"}
                    </span>
                  </div>

                  <div className="recent-movement-meta">
                    <strong>{entry.stockAfter} Rollen</strong>
                    <time>
                      {new Date(entry.timestamp).toLocaleString(
                        "de-DE",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
