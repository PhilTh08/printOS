"use client";

import { useMemo, useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import {
  buildFilamentActivity,
  buildMaterialSummary,
  buildMovementChart,
  logsForRange,
} from "@/components/philamentix/statistics";
import type { StatisticsRange } from "@/components/philamentix/types";

import styles from "./page.module.css";

export default function StatisticsPage() {
  const { filaments, logs } = useHub();
  const [statisticsRange, setStatisticsRange] =
    useState<StatisticsRange>("30");
  const [selectedMaterial, setSelectedMaterial] =
    useState<string | null>(null);

  const filteredLogs = useMemo(
    () => logsForRange(logs, statisticsRange),
    [logs, statisticsRange],
  );
  const materialStatistics = useMemo(
    () => buildMaterialSummary(filaments, filteredLogs),
    [filaments, filteredLogs],
  );
  const filamentActivity = useMemo(
    () => buildFilamentActivity(filaments, filteredLogs),
    [filaments, filteredLogs],
  );
  const movementChart = useMemo(
    () => buildMovementChart(filteredLogs, statisticsRange),
    [filteredLogs, statisticsRange],
  );

  const totalStock = filaments.reduce(
    (sum, filament) => sum + filament.stock,
    0,
  );
  const totalWeight = filaments.reduce(
    (sum, filament) =>
      sum + filament.stock * filament.weightPerRoll,
    0,
  );
  const totalIn = filteredLogs.filter(
    (entry) => entry.action === "in",
  ).length;
  const totalOut = filteredLogs.filter(
    (entry) => entry.action === "out",
  ).length;
  const criticalCount = filaments.filter(
    (filament) =>
      filament.stock <= filament.minimumStock,
  ).length;
  const mostActiveMaterial = materialStatistics[0]
    ? [...materialStatistics].sort(
        (a, b) => b.activity - a.activity,
      )[0]
    : null;
  const mostActiveFilament = filamentActivity[0] ?? null;
  const maximumChartValue = Math.max(
    1,
    ...movementChart.map((item) =>
      Math.max(item.incoming, item.outgoing),
    ),
  );

  const manufacturerMap = new Map<string, number>();
  for (const filament of filaments) {
    manufacturerMap.set(
      filament.manufacturer,
      (manufacturerMap.get(filament.manufacturer) ?? 0) +
        filament.stock,
    );
  }
  const manufacturerSummary = [...manufacturerMap.entries()]
    .map(([manufacturer, stock]) => ({
      manufacturer,
      stock,
    }))
    .sort((a, b) => b.stock - a.stock);

  const topOutgoing = [...filamentActivity]
    .filter((item) => item.outgoing > 0)
    .sort((a, b) => b.outgoing - a.outgoing)
    .slice(0, 5);
  const topIncoming = [...filamentActivity]
    .filter((item) => item.incoming > 0)
    .sort((a, b) => b.incoming - a.incoming)
    .slice(0, 5);
  const largestStocks = [...filaments]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5);
  const lowestStocks = [...filaments]
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  const selectedMaterialSummary =
    materialStatistics.find(
      (item) => item.material === selectedMaterial,
    ) ?? null;
  const selectedMaterialFilaments = filaments.filter(
    (filament) => filament.material === selectedMaterial,
  );
  const selectedBarcodes = new Set(
    selectedMaterialFilaments.map(
      (filament) => filament.barcode,
    ),
  );
  const selectedMaterialLogs = filteredLogs
    .filter((entry) => selectedBarcodes.has(entry.barcode))
    .slice(0, 12);

  const colorStock = new Map<string, number>();
  const manufacturerStock = new Map<string, number>();
  for (const filament of selectedMaterialFilaments) {
    colorStock.set(
      filament.color,
      (colorStock.get(filament.color) ?? 0) +
        filament.stock,
    );
    manufacturerStock.set(
      filament.manufacturer,
      (manufacturerStock.get(filament.manufacturer) ?? 0) +
        filament.stock,
    );
  }
  const selectedMaterialTopColor = [...colorStock.entries()]
    .map(([color, stock]) => ({ color, stock }))
    .sort((a, b) => b.stock - a.stock)[0];
  const selectedMaterialTopManufacturer = [
    ...manufacturerStock.entries(),
  ]
    .map(([manufacturer, stock]) => ({
      manufacturer,
      stock,
    }))
    .sort((a, b) => b.stock - a.stock)[0];
  const rangeDays =
    statisticsRange === "all"
      ? null
      : Number(statisticsRange);
  const weeklyAverage =
    selectedMaterialSummary && rangeDays
      ? (
          selectedMaterialSummary.activity /
          Math.max(1, rangeDays / 7)
        ).toLocaleString("de-DE", {
          maximumFractionDigits: 1,
        })
      : selectedMaterialSummary
        ? selectedMaterialSummary.activity.toLocaleString(
            "de-DE",
          )
        : "–";

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <h1>
            {selectedMaterial === null
              ? "Statistik"
              : `${selectedMaterial} – Details`}
          </h1>
          <p>
            {selectedMaterial === null
              ? "Bestand, Bewegungen und Datenqualität im Überblick"
              : "Varianten, Bestand und Aktivität dieses Materials"}
          </p>
        </div>

        {selectedMaterial === null ? (
          <div className="system-status">
            <span className="status-dot" />
            Live aus dem Lagerbestand
          </div>
        ) : (
          <button
            className="secondary-button"
            type="button"
            onClick={() => setSelectedMaterial(null)}
          >
            ← Zurück zur Statistik
          </button>
        )}
      </header>

      <section className="statistics-range-bar">
        <div>
          <strong>Zeitraum</strong>
          <span>Bewegungen und Ranglisten anpassen</span>
        </div>

        <div className="statistics-range-buttons">
          {(
            [
              ["7", "7 Tage"],
              ["30", "30 Tage"],
              ["90", "90 Tage"],
              ["all", "Gesamt"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                statisticsRange === value ? "active" : ""
              }
              onClick={() => setStatisticsRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {selectedMaterial === null ? (
        <>
          <section className="statistics-overview statistics-overview-eight">
            <article className="statistics-overview-card">
              <span>Rollenbestand</span>
              <strong>{totalStock}</strong>
              <small>{filaments.length} Filamenttypen</small>
            </article>

            <article className="statistics-overview-card">
              <span>Gesamtgewicht</span>
              <strong>
                {(totalWeight / 1000).toLocaleString(
                  "de-DE",
                  { maximumFractionDigits: 1 },
                )}{" "}
                kg
              </strong>
              <small>Aktuell im Lager</small>
            </article>

            <article className="statistics-overview-card">
              <span>Eingelagert</span>
              <strong className="green">+{totalIn}</strong>
              <small>Im gewählten Zeitraum</small>
            </article>

            <article className="statistics-overview-card">
              <span>Entnommen</span>
              <strong className="red">−{totalOut}</strong>
              <small>Im gewählten Zeitraum</small>
            </article>

            <article className="statistics-overview-card">
              <span>Bestandsänderung</span>
              <strong
                className={
                  totalIn - totalOut >= 0 ? "green" : "red"
                }
              >
                {totalIn - totalOut >= 0 ? "+" : ""}
                {totalIn - totalOut}
              </strong>
              <small>Zugänge minus Entnahmen</small>
            </article>

            <article className="statistics-overview-card">
              <span>Kritische Typen</span>
              <strong className="red">{criticalCount}</strong>
              <small>Am oder unter Minimum</small>
            </article>

            <article className="statistics-overview-card">
              <span>Aktivstes Material</span>
              <strong className="statistics-text-value">
                {mostActiveMaterial?.activity
                  ? mostActiveMaterial.material
                  : "–"}
              </strong>
              <small>
                {mostActiveMaterial?.activity ?? 0} Bewegungen
              </small>
            </article>

            <article className="statistics-overview-card">
              <span>Aktivster Typ</span>
              <strong className="statistics-text-value">
                {mostActiveFilament
                  ? `${mostActiveFilament.filament.material} ${mostActiveFilament.filament.color}`
                  : "–"}
              </strong>
              <small>
                {mostActiveFilament?.activity ?? 0} Bewegungen
              </small>
            </article>
          </section>

          <section className="statistics-main-grid">
            <article className="panel statistics-chart-panel">
              <div className="dashboard-panel-header">
                <div>
                  <h2>Bewegungsverlauf</h2>
                  <p>
                    Einlagerungen und Entnahmen im Zeitverlauf
                  </p>
                </div>

                <div className="chart-legend">
                  <span>
                    <i className="chart-incoming" />
                    Eingelagert
                  </span>
                  <span>
                    <i className="chart-outgoing" />
                    Entnommen
                  </span>
                </div>
              </div>

              <div className="movement-chart">
                {movementChart.map((item, index) => (
                  <div
                    className="movement-chart-column"
                    key={`${item.label}-${index}`}
                  >
                    <div className="movement-chart-bars">
                      <div
                        className="movement-chart-bar movement-chart-in"
                        title={`${item.incoming} eingelagert`}
                        style={{
                          height: `${Math.max(
                            (item.incoming /
                              maximumChartValue) *
                              100,
                            item.incoming > 0 ? 8 : 0,
                          )}%`,
                        }}
                      />
                      <div
                        className="movement-chart-bar movement-chart-out"
                        title={`${item.outgoing} entnommen`}
                        style={{
                          height: `${Math.max(
                            (item.outgoing /
                              maximumChartValue) *
                              100,
                            item.outgoing > 0 ? 8 : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel statistics-chart-panel">
              <div className="dashboard-panel-header">
                <div>
                  <h2>Herstellerverteilung</h2>
                  <p>Rollenbestand nach Hersteller</p>
                </div>
              </div>

              <div className="statistics-ranking-list">
                {manufacturerSummary.length === 0 ? (
                  <p className="empty-message">
                    Noch keine Hersteller vorhanden.
                  </p>
                ) : (
                  manufacturerSummary.map((item, index) => (
                    <div
                      className="statistics-ranking-row"
                      key={item.manufacturer}
                    >
                      <span className="statistics-rank">
                        {index + 1}
                      </span>
                      <div>
                        <strong>{item.manufacturer}</strong>
                        <div className="statistics-mini-bar">
                          <div
                            style={{
                              width: `${
                                manufacturerSummary[0]?.stock
                                  ? (item.stock /
                                      manufacturerSummary[0]
                                        .stock) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                      <strong>{item.stock}</strong>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <section className="statistics-ranking-grid">
            <article className="panel">
              <div className="dashboard-panel-header">
                <div>
                  <h2>Meist entnommen</h2>
                  <p>Top 5 im Zeitraum</p>
                </div>
              </div>
              <RankingList
                items={topOutgoing.map((item) => ({
                  id: item.filament.id,
                  title: `${item.filament.material} ${item.filament.color}`,
                  subtitle: item.filament.manufacturer,
                  value: item.outgoing,
                  valueClass: "red",
                }))}
                empty="Keine Entnahmen vorhanden."
              />
            </article>

            <article className="panel">
              <div className="dashboard-panel-header">
                <div>
                  <h2>Meist eingelagert</h2>
                  <p>Top 5 im Zeitraum</p>
                </div>
              </div>
              <RankingList
                items={topIncoming.map((item) => ({
                  id: item.filament.id,
                  title: `${item.filament.material} ${item.filament.color}`,
                  subtitle: item.filament.manufacturer,
                  value: item.incoming,
                  valueClass: "green",
                }))}
                empty="Keine Einlagerungen vorhanden."
              />
            </article>

            <article className="panel">
              <div className="dashboard-panel-header">
                <div>
                  <h2>Größte Bestände</h2>
                  <p>Top 5 nach Rollenanzahl</p>
                </div>
              </div>
              <RankingList
                items={largestStocks.map((filament) => ({
                  id: filament.id,
                  title: `${filament.material} ${filament.color}`,
                  subtitle: filament.manufacturer,
                  value: filament.stock,
                }))}
                empty="Noch keine Bestände vorhanden."
              />
            </article>

            <article className="panel">
              <div className="dashboard-panel-header">
                <div>
                  <h2>Niedrigste Bestände</h2>
                  <p>Top 5 mit Handlungsbedarf</p>
                </div>
              </div>
              <RankingList
                items={lowestStocks.map((filament) => ({
                  id: filament.id,
                  title: `${filament.material} ${filament.color}`,
                  subtitle: filament.manufacturer,
                  value: filament.stock,
                  valueClass:
                    filament.stock <= filament.minimumStock
                      ? "red"
                      : "",
                }))}
                empty="Noch keine Bestände vorhanden."
              />
            </article>
          </section>

          {materialStatistics.length === 0 ? (
            <div className="empty-state">
              Noch keine Materialdaten vorhanden.
            </div>
          ) : (
            <section className="material-statistics-list">
              {materialStatistics.map((item) => {
                const maximumStock = Math.max(
                  1,
                  ...materialStatistics.map(
                    (material) => material.stock,
                  ),
                );

                return (
                  <article
                    className="material-statistics-card"
                    key={item.material}
                  >
                    <div className="material-statistics-heading">
                      <div>
                        <span className="material-statistics-label">
                          Material
                        </span>
                        <h2>{item.material}</h2>
                        <p>{item.typeCount} Filamenttypen</p>
                      </div>
                      <div className="material-statistics-stock">
                        <strong>{item.stock}</strong>
                        <span>Rollen</span>
                      </div>
                    </div>

                    <div className="material-statistics-progress">
                      <div
                        style={{
                          width: `${
                            (item.stock / maximumStock) * 100
                          }%`,
                        }}
                      />
                    </div>

                    <div className="material-statistics-values">
                      <div>
                        <span>Gewicht</span>
                        <strong>
                          {(item.weight / 1000).toLocaleString(
                            "de-DE",
                            { maximumFractionDigits: 1 },
                          )}{" "}
                          kg
                        </strong>
                      </div>
                      <div>
                        <span>Eingelagert</span>
                        <strong className="green">
                          +{item.incoming}
                        </strong>
                      </div>
                      <div>
                        <span>Entnommen</span>
                        <strong className="red">
                          −{item.outgoing}
                        </strong>
                      </div>
                      <div>
                        <span>Kritisch</span>
                        <strong>{item.criticalCount}</strong>
                      </div>
                      <div>
                        <span>Letzter Zugang</span>
                        <strong className="statistics-small-value">
                          {item.lastIn
                            ? new Date(
                                item.lastIn,
                              ).toLocaleDateString("de-DE")
                            : "–"}
                        </strong>
                      </div>
                      <div>
                        <span>Letzte Entnahme</span>
                        <strong className="statistics-small-value">
                          {item.lastOut
                            ? new Date(
                                item.lastOut,
                              ).toLocaleDateString("de-DE")
                            : "–"}
                        </strong>
                      </div>
                      <div>
                        <span>Aktivität</span>
                        <strong>{item.activity}</strong>
                      </div>
                    </div>

                    <div className="material-statistics-actions">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() =>
                          setSelectedMaterial(item.material)
                        }
                      >
                        Details öffnen
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      ) : (
        <section className="material-detail-layout material-detail-layout-full">
          {selectedMaterialSummary && (
            <section className="material-detail-kpis">
              <article>
                <span>Bestand</span>
                <strong>{selectedMaterialSummary.stock}</strong>
                <small>Rollen verfügbar</small>
              </article>
              <article>
                <span>Bewegungen</span>
                <strong>{selectedMaterialSummary.activity}</strong>
                <small>Im gewählten Zeitraum</small>
              </article>
              <article>
                <span>Häufigste Farbe</span>
                <strong className="statistics-text-value">
                  {selectedMaterialTopColor?.color ?? "–"}
                </strong>
                <small>
                  {selectedMaterialTopColor?.stock ?? 0} Rollen
                </small>
              </article>
              <article>
                <span>Top-Hersteller</span>
                <strong className="statistics-text-value">
                  {selectedMaterialTopManufacturer?.manufacturer ??
                    "–"}
                </strong>
                <small>
                  {selectedMaterialTopManufacturer?.stock ?? 0} Rollen
                </small>
              </article>
              <article>
                <span>Ø pro Woche</span>
                <strong>{weeklyAverage}</strong>
                <small>Bewegungen</small>
              </article>
              <article>
                <span>Kritische Typen</span>
                <strong
                  className={
                    selectedMaterialSummary.criticalCount > 0
                      ? "red"
                      : "green"
                  }
                >
                  {selectedMaterialSummary.criticalCount}
                </strong>
                <small>Handlungsbedarf</small>
              </article>
            </section>
          )}

          <article className="panel material-detail-summary">
            <div className="dashboard-panel-header">
              <div>
                <h2>Varianten</h2>
                <p>
                  Farben, Hersteller, Lagerorte und Bestand
                </p>
              </div>
              <span className="material-detail-count">
                {selectedMaterialFilaments.length} Typen
              </span>
            </div>

            <div className="material-detail-table">
              <div className="material-detail-table-head">
                <span>Filament</span>
                <span>Lagerort</span>
                <span>Bestand</span>
                <span>Status</span>
              </div>
              {selectedMaterialFilaments.map((filament) => {
                const critical =
                  filament.stock <= filament.minimumStock;
                return (
                  <div
                    className="material-detail-row"
                    key={filament.id}
                  >
                    <div>
                      <strong>{filament.color}</strong>
                      <span>{filament.manufacturer}</span>
                    </div>
                    <span>
                      {filament.location || "Kein Lagerort"}
                    </span>
                    <strong>{filament.stock} Rollen</strong>
                    <span
                      className={`material-detail-status ${
                        critical
                          ? "material-detail-critical"
                          : "material-detail-ok"
                      }`}
                    >
                      {critical ? "Kritisch" : "In Ordnung"}
                    </span>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel material-detail-movements">
            <div className="dashboard-panel-header">
              <div>
                <h2>Bewegungen</h2>
                <p>
                  Die letzten Aktionen im gewählten Zeitraum
                </p>
              </div>
            </div>

            {selectedMaterialLogs.length === 0 ? (
              <p className="empty-message">
                Keine Bewegungen in diesem Zeitraum.
              </p>
            ) : (
              <div className="recent-movements">
                {selectedMaterialLogs.map((entry) => (
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
      )}
    </div>
  );
}

function RankingList({
  items,
  empty,
}: {
  items: Array<{
    id: number;
    title: string;
    subtitle: string;
    value: number;
    valueClass?: string;
  }>;
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="empty-message">{empty}</p>;
  }

  return (
    <div className="statistics-ranking-list">
      {items.map((item, index) => (
        <div
          className="statistics-ranking-row"
          key={item.id}
        >
          <span className="statistics-rank">{index + 1}</span>
          <div>
            <strong>{item.title}</strong>
            <span>{item.subtitle}</span>
          </div>
          <strong className={item.valueClass ?? ""}>
            {item.value}
          </strong>
        </div>
      ))}
    </div>
  );
}
