"use client";

import Link from "next/link";

import { useHub } from "@/components/philamentix/hub-provider";
import { PageHeader } from "@/components/philamentix/page-header";

import styles from "./page.module.css";

export default function DashboardPage() {
  const {
    filaments,
    logs,
    displayName,
    loading,
    error,
  } = useHub();

  const totalRolls = filaments.reduce(
    (sum, filament) => sum + filament.stock,
    0,
  );
  const totalWeight = filaments.reduce(
    (sum, filament) =>
      sum + filament.stock * filament.weightPerRoll,
    0,
  );
  const critical = filaments.filter(
    (filament) =>
      filament.stock <= filament.minimumStock,
  );

  return (
    <>
      <PageHeader
        eyebrow={`Hallo ${displayName}`}
        title="Dashboard"
        description="Dein persönliches Filamentlager. Andere Accounts sehen diese Daten nicht."
        actions={
          <Link
            className={styles.primaryLink}
            href="/ein-auslagern"
          >
            Scanner öffnen
          </Link>
        }
      />

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      <section className={styles.metrics}>
        <article>
          <span>Filamenttypen</span>
          <strong>
            {loading ? "…" : filaments.length}
          </strong>
        </article>
        <article>
          <span>Rollen gesamt</span>
          <strong>
            {loading ? "…" : totalRolls}
          </strong>
        </article>
        <article>
          <span>Gesamtgewicht</span>
          <strong>
            {loading
              ? "…"
              : `${(totalWeight / 1000).toLocaleString(
                  "de-DE",
                  { maximumFractionDigits: 1 },
                )} kg`}
          </strong>
        </article>
        <article>
          <span>Kritische Bestände</span>
          <strong>{loading ? "…" : critical.length}</strong>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <span>Aufmerksamkeit</span>
              <h2>Niedrige Bestände</h2>
            </div>
            <Link href="/filamente">
              Alle Filamente
            </Link>
          </div>

          <div className={styles.list}>
            {critical.length === 0 ? (
              <p className={styles.empty}>
                Alle Bestände liegen über dem Mindestbestand.
              </p>
            ) : (
              critical.slice(0, 6).map((filament) => (
                <Link
                  key={filament.id}
                  href={`/filamente/${filament.id}`}
                  className={styles.listItem}
                >
                  <div>
                    <strong>
                      {filament.material} · {filament.color}
                    </strong>
                    <span>
                      {filament.manufacturer} ·{" "}
                      {filament.location || "Kein Lagerplatz"}
                    </span>
                  </div>
                  <b>{filament.stock}</b>
                </Link>
              ))
            )}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <span>Aktivität</span>
              <h2>Letzte Bewegungen</h2>
            </div>
            <Link href="/protokoll">
              Protokoll
            </Link>
          </div>

          <div className={styles.list}>
            {logs.length === 0 ? (
              <p className={styles.empty}>
                Noch keine Lagerbewegungen.
              </p>
            ) : (
              logs.slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className={styles.listItem}
                >
                  <div>
                    <strong>{entry.filamentName}</strong>
                    <span>
                      {new Date(
                        entry.timestamp,
                      ).toLocaleString("de-DE")}
                    </span>
                  </div>
                  <b
                    className={
                      entry.action === "in"
                        ? styles.in
                        : styles.out
                    }
                  >
                    {entry.action === "in" ? "+1" : "-1"}
                  </b>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </>
  );
}
