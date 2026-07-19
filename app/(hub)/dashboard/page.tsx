"use client";

import Link from "next/link";

import { useHub } from "@/components/philamentix/hub-provider";

import styles from "./page.module.css";

export default function DashboardPage() {
  const { filaments, logs, displayName } = useHub();

  const totalRolls = filaments.reduce(
    (sum, filament) => sum + filament.stock,
    0,
  );
  const totalWeight = filaments.reduce(
    (sum, filament) =>
      sum +
      filament.stock * filament.weightPerRoll,
    0,
  );
  const criticalFilaments = filaments.filter(
    (filament) =>
      filament.stock <= filament.minimumStock,
  );
  const healthyFilaments = filaments.filter(
    (filament) =>
      filament.stock > filament.minimumStock,
  );
  const missingRolls = criticalFilaments.reduce(
    (sum, filament) =>
      sum +
      Math.max(
        1,
        filament.minimumStock - filament.stock,
      ),
    0,
  );
  const stockHealth =
    filaments.length === 0
      ? 100
      : Math.round(
          (healthyFilaments.length /
            filaments.length) *
            100,
        );

  const urgentReorders = [
    ...criticalFilaments,
  ]
    .sort((first, second) => {
      const firstIsEmpty = first.stock === 0;
      const secondIsEmpty = second.stock === 0;

      if (firstIsEmpty !== secondIsEmpty) {
        return firstIsEmpty ? -1 : 1;
      }

      const firstDeficit =
        first.minimumStock - first.stock;
      const secondDeficit =
        second.minimumStock - second.stock;

      if (firstDeficit !== secondDeficit) {
        return secondDeficit - firstDeficit;
      }

      if (first.stock !== second.stock) {
        return first.stock - second.stock;
      }

      return `${first.manufacturer} ${first.material} ${first.color}`.localeCompare(
        `${second.manufacturer} ${second.material} ${second.color}`,
        "de",
      );
    })
    .slice(0, 3);

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
  const recentLogs = logs.slice(0, 6);

  const healthLabel =
    criticalFilaments.length === 0
      ? "Lagerbestand stabil"
      : stockHealth >= 70
        ? "Einige Bestände benötigen Aufmerksamkeit"
        : "Mehrere Bestände sind kritisch";

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <span className="welcome-label">
            Willkommen zurück,
          </span>
          <h1>{displayName}</h1>
          <p>
            Dein Filamentlager auf einen Blick
          </p>
        </div>

        <div className="system-status">
          <span className="status-dot" />
          System aktuell
        </div>
      </header>

      <section
        className={styles.quickActions}
        aria-label="Schnellzugriffe"
      >
        <Link
          className={styles.quickActionPrimary}
          href="/ein-auslagern"
        >
          <span className={styles.quickActionIcon}>
            ⌁
          </span>
          <div>
            <strong>Ein- oder auslagern</strong>
            <small>
              Barcode scannen und Bestand ändern
            </small>
          </div>
          <b>→</b>
        </Link>

        <Link
          className={styles.quickAction}
          href="/filamente/neu"
        >
          <span className={styles.quickActionIcon}>
            +
          </span>
          <div>
            <strong>Filament hinzufügen</strong>
            <small>Neuen Datensatz anlegen</small>
          </div>
        </Link>

        <Link
          className={styles.quickAction}
          href="/nachbestellen"
        >
          <span className={styles.quickActionIcon}>
            !
          </span>
          <div>
            <strong>Nachbestellen</strong>
            <small>
              {criticalFilaments.length} offene{" "}
              {criticalFilaments.length === 1
                ? "Position"
                : "Positionen"}
            </small>
          </div>
        </Link>

        <Link
          className={styles.quickAction}
          href="/statistiken"
        >
          <span className={styles.quickActionIcon}>
            ↗
          </span>
          <div>
            <strong>Statistiken</strong>
            <small>Verteilung und Bewegungen</small>
          </div>
        </Link>
      </section>

      <section className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <span>Rollen im Lager</span>
          <strong>{totalRolls}</strong>
          <small>
            aus {filaments.length}{" "}
            {filaments.length === 1
              ? "Filamenttyp"
              : "Filamenttypen"}
          </small>
        </article>

        <article className={styles.kpiCard}>
          <span>Gesamtgewicht</span>
          <strong className={styles.kpiBlue}>
            {(totalWeight / 1000).toLocaleString(
              "de-DE",
            )}{" "}
            kg
          </strong>
          <small>Aktuell verfügbar</small>
        </article>

        <article className={styles.kpiCard}>
          <span>Lagergesundheit</span>
          <strong
            className={
              criticalFilaments.length === 0
                ? styles.kpiGreen
                : styles.kpiOrange
            }
          >
            {stockHealth} %
          </strong>
          <small>{healthLabel}</small>
        </article>

        <article className={styles.kpiCard}>
          <span>Bewegungen heute</span>
          <strong>{todaysLogs.length}</strong>
          <small>
            <span className={styles.incoming}>
              +{todaysIn}
            </span>{" "}
            Einlagerungen ·{" "}
            <span className={styles.outgoing}>
              −{todaysOut}
            </span>{" "}
            Auslagerungen
          </small>
        </article>
      </section>

      <section className={styles.mainGrid}>
        <article
          className={`${styles.panel} ${styles.healthPanel}`}
        >
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>
                Lagerstatus
              </span>
              <h2>Bestandslage</h2>
              <p>
                Verhältnis zwischen stabilen und
                kritischen Filamenttypen
              </p>
            </div>

            <Link
              className={styles.panelLink}
              href="/filamente"
            >
              Bestand verwalten
            </Link>
          </div>

          <div className={styles.healthContent}>
            <div
              className={styles.healthRing}
              style={{
                background: `conic-gradient(
                  ${
                    criticalFilaments.length === 0
                      ? "var(--green)"
                      : "var(--accent)"
                  } ${stockHealth}%,
                  #253137 ${stockHealth}% 100%
                )`,
              }}
            >
              <div>
                <strong>{stockHealth}%</strong>
                <span>stabil</span>
              </div>
            </div>

            <div className={styles.healthFacts}>
              <div>
                <span
                  className={styles.factDotGreen}
                />
                <p>
                  <strong>
                    {healthyFilaments.length}
                  </strong>
                  <span>
                    über dem Mindestbestand
                  </span>
                </p>
              </div>

              <div>
                <span className={styles.factDotRed} />
                <p>
                  <strong>
                    {criticalFilaments.length}
                  </strong>
                  <span>
                    kritisch oder knapp
                  </span>
                </p>
              </div>

              <div>
                <span
                  className={styles.factDotOrange}
                />
                <p>
                  <strong>{missingRolls}</strong>
                  <span>
                    Rollen als Bestellempfehlung
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className={styles.healthFooter}>
            <span
              className={
                criticalFilaments.length === 0
                  ? styles.healthGood
                  : styles.healthAttention
              }
            >
              {criticalFilaments.length === 0
                ? "✓ Keine offenen Bestandswarnungen"
                : `! ${criticalFilaments.length} ${
                    criticalFilaments.length === 1
                      ? "Bestandswarnung"
                      : "Bestandswarnungen"
                  } offen`}
            </span>

            <Link href="/nachbestellen">
              Nachbestellliste öffnen →
            </Link>
          </div>
        </article>

        <article
          className={`${styles.panel} ${styles.reorderPanel}`}
        >
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>
                Priorität
              </span>
              <h2>Dringend nachbestellen</h2>
              <p>
                Die drei wichtigsten Positionen
              </p>
            </div>

            <Link
              className={styles.panelLink}
              href="/nachbestellen"
            >
              Alle anzeigen
            </Link>
          </div>

          {urgentReorders.length === 0 ? (
            <div className={styles.allGood}>
              <span>✓</span>
              <div>
                <strong>
                  Alles im grünen Bereich
                </strong>
                <p>
                  Momentan muss nichts nachbestellt
                  werden.
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.reorderList}>
              {urgentReorders.map(
                (filament, index) => {
                  const recommendedAmount =
                    Math.max(
                      1,
                      filament.minimumStock -
                        filament.stock,
                    );

                  return (
                    <Link
                      className={
                        styles.reorderRow
                      }
                      key={filament.id}
                      href={`/filamente/${filament.id}`}
                      style={{
                        animationDelay: `${index * 70}ms`,
                      }}
                    >
                      <span
                        className={
                          filament.stock === 0
                            ? styles.stockEmpty
                            : styles.stockCritical
                        }
                      >
                        {filament.stock}
                      </span>

                      <div
                        className={
                          styles.reorderMain
                        }
                      >
                        <strong>
                          {filament.material}{" "}
                          {filament.color}
                        </strong>
                        <span>
                          {filament.manufacturer}
                          {filament.location
                            ? ` · ${filament.location}`
                            : ""}
                        </span>
                      </div>

                      <div
                        className={
                          styles.reorderAmount
                        }
                      >
                        <strong>
                          +{recommendedAmount}
                        </strong>
                        <span>
                          {recommendedAmount === 1
                            ? "Rolle"
                            : "Rollen"}
                        </span>
                      </div>
                    </Link>
                  );
                },
              )}
            </div>
          )}
        </article>

        <article
          className={`${styles.panel} ${styles.activityPanel}`}
        >
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>
                Aktivität
              </span>
              <h2>Letzte Bewegungen</h2>
              <p>
                Die sechs neuesten Lageraktionen
              </p>
            </div>

            <Link
              className={styles.panelLink}
              href="/protokoll"
            >
              Protokoll öffnen
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <div className={styles.emptyActivity}>
              Noch keine Lagerbewegungen vorhanden.
            </div>
          ) : (
            <div className={styles.activityList}>
              {recentLogs.map((entry) => (
                <div
                  className={styles.activityRow}
                  key={entry.id}
                >
                  <span
                    className={
                      entry.action === "in"
                        ? styles.activityIn
                        : styles.activityOut
                    }
                  >
                    {entry.action === "in"
                      ? "+"
                      : "−"}
                  </span>

                  <div
                    className={
                      styles.activityMain
                    }
                  >
                    <strong>
                      {entry.filamentName}
                    </strong>
                    <span>
                      {entry.source === "scan"
                        ? "Barcode-Scanner"
                        : "Manuelle Änderung"}
                    </span>
                  </div>

                  <div
                    className={
                      styles.activityMeta
                    }
                  >
                    <strong>
                      {entry.stockAfter}{" "}
                      {entry.stockAfter === 1
                        ? "Rolle"
                        : "Rollen"}
                    </strong>
                    <time>
                      {new Date(
                        entry.timestamp,
                      ).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
