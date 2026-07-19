"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import type {
  Filament,
  LogEntry,
} from "@/components/philamentix/types";

import styles from "./page.module.css";

type WidgetId =
  | "quick-actions"
  | "inventory-summary"
  | "stock-health"
  | "urgent-reorders"
  | "recent-activity";

type WidgetSize = "half" | "full";

type WidgetSetting = {
  id: WidgetId;
  visible: boolean;
  size: WidgetSize;
};

const DEFAULT_WIDGETS: WidgetSetting[] = [
  {
    id: "quick-actions",
    visible: true,
    size: "full",
  },
  {
    id: "inventory-summary",
    visible: true,
    size: "full",
  },
  {
    id: "urgent-reorders",
    visible: true,
    size: "half",
  },
  {
    id: "recent-activity",
    visible: true,
    size: "half",
  },
  {
    id: "stock-health",
    visible: false,
    size: "half",
  },
];

const WIDGET_LABELS: Record<WidgetId, string> = {
  "quick-actions": "Schnellzugriffe",
  "inventory-summary": "Lagerübersicht",
  "stock-health": "Lagergesundheit",
  "urgent-reorders": "Dringend nachbestellen",
  "recent-activity": "Letzte Bewegungen",
};

function normalizeWidgetSettings(
  value: unknown,
): WidgetSetting[] {
  if (!Array.isArray(value)) {
    return DEFAULT_WIDGETS;
  }

  const validIds = new Set<WidgetId>(
    DEFAULT_WIDGETS.map((widget) => widget.id),
  );
  const seenIds = new Set<WidgetId>();
  const normalized: WidgetSetting[] = [];

  for (const entry of value) {
    if (
      typeof entry !== "object" ||
      entry === null
    ) {
      continue;
    }

    const candidate = entry as Partial<WidgetSetting>;

    if (
      !candidate.id ||
      !validIds.has(candidate.id) ||
      seenIds.has(candidate.id)
    ) {
      continue;
    }

    seenIds.add(candidate.id);
    normalized.push({
      id: candidate.id,
      visible: candidate.visible !== false,
      size:
        candidate.size === "full"
          ? "full"
          : "half",
    });
  }

  for (const defaultWidget of DEFAULT_WIDGETS) {
    if (!seenIds.has(defaultWidget.id)) {
      normalized.push(defaultWidget);
    }
  }

  return normalized;
}

function recommendedOrderAmount(
  filament: Filament,
): number {
  return Math.max(
    1,
    filament.minimumStock - filament.stock,
  );
}

function sortUrgentReorders(
  filaments: Filament[],
): Filament[] {
  return [...filaments].sort(
    (first, second) => {
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
    },
  );
}

function formatActivityTime(
  entry: LogEntry,
): string {
  return new Date(entry.timestamp).toLocaleString(
    "de-DE",
    {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

export default function DashboardPage() {
  const {
    filaments,
    logs,
    displayName,
    user,
  } = useHub();

  const [editMode, setEditMode] = useState(false);
  const [settingsLoaded, setSettingsLoaded] =
    useState(false);
  const [widgets, setWidgets] =
    useState<WidgetSetting[]>(DEFAULT_WIDGETS);

  const storageKey = `philamentix-dashboard-widgets-${
    user?.id ?? "guest"
  }`;

  useEffect(() => {
    setSettingsLoaded(false);

    try {
      const savedValue =
        window.localStorage.getItem(storageKey);

      if (!savedValue) {
        setWidgets(DEFAULT_WIDGETS);
      } else {
        setWidgets(
          normalizeWidgetSettings(
            JSON.parse(savedValue),
          ),
        );
      }
    } catch {
      setWidgets(DEFAULT_WIDGETS);
    }

    setSettingsLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify(widgets),
    );
  }, [settingsLoaded, storageKey, widgets]);

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
      sum + recommendedOrderAmount(filament),
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

  const urgentReorders = useMemo(
    () =>
      sortUrgentReorders(
        criticalFilaments,
      ).slice(0, 3),
    [criticalFilaments],
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
  const recentLogs = logs.slice(0, 6);

  const visibleWidgets = widgets.filter(
    (widget) => widget.visible,
  );

  function updateWidget(
    id: WidgetId,
    update: Partial<WidgetSetting>,
  ) {
    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              ...update,
            }
          : widget,
      ),
    );
  }

  function moveWidget(
    id: WidgetId,
    direction: -1 | 1,
  ) {
    setWidgets((current) => {
      const currentIndex = current.findIndex(
        (widget) => widget.id === id,
      );
      const targetIndex =
        currentIndex + direction;

      if (
        currentIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= current.length
      ) {
        return current;
      }

      const next = [...current];
      const [movedWidget] = next.splice(
        currentIndex,
        1,
      );
      next.splice(targetIndex, 0, movedWidget);

      return next;
    });
  }

  function resetWidgets() {
    const confirmed = window.confirm(
      "Dashboard auf die Standardansicht zurücksetzen?",
    );

    if (!confirmed) {
      return;
    }

    setWidgets(DEFAULT_WIDGETS);
  }

  function renderWidget(id: WidgetId) {
    switch (id) {
      case "quick-actions":
        return (
          <>
            <div className={styles.widgetHeading}>
              <div>
                <span>Schnellzugriff</span>
                <h2>Direkt loslegen</h2>
              </div>
            </div>

            <div className={styles.quickActions}>
              <Link
                className={
                  styles.quickActionPrimary
                }
                href="/ein-auslagern"
              >
                <span>⌁</span>
                <div>
                  <strong>
                    Ein- oder auslagern
                  </strong>
                  <small>
                    Barcode scannen und Bestand
                    ändern
                  </small>
                </div>
                <b>→</b>
              </Link>

              <Link
                className={styles.quickAction}
                href="/filamente/neu"
              >
                <span>+</span>
                <div>
                  <strong>
                    Filament hinzufügen
                  </strong>
                  <small>
                    Neuen Datensatz anlegen
                  </small>
                </div>
              </Link>

              <Link
                className={styles.quickAction}
                href="/nachbestellen"
              >
                <span>!</span>
                <div>
                  <strong>Nachbestellen</strong>
                  <small>
                    {criticalFilaments.length}{" "}
                    {criticalFilaments.length === 1
                      ? "offene Position"
                      : "offene Positionen"}
                  </small>
                </div>
              </Link>

              <Link
                className={styles.quickAction}
                href="/statistiken"
              >
                <span>↗</span>
                <div>
                  <strong>Statistiken</strong>
                  <small>
                    Verteilung und Bewegungen
                  </small>
                </div>
              </Link>
            </div>
          </>
        );

      case "inventory-summary":
        return (
          <>
            <div className={styles.widgetHeading}>
              <div>
                <span>Überblick</span>
                <h2>Lagerübersicht</h2>
              </div>

              <Link href="/filamente">
                Bestand verwalten
              </Link>
            </div>

            <div className={styles.summaryGrid}>
              <div>
                <span>Rollen</span>
                <strong>{totalRolls}</strong>
                <small>
                  {filaments.length}{" "}
                  {filaments.length === 1
                    ? "Filamenttyp"
                    : "Filamenttypen"}
                </small>
              </div>

              <div>
                <span>Gesamtgewicht</span>
                <strong className={styles.blue}>
                  {(totalWeight / 1000).toLocaleString(
                    "de-DE",
                  )}{" "}
                  kg
                </strong>
                <small>aktuell verfügbar</small>
              </div>

              <div>
                <span>Kritisch</span>
                <strong
                  className={
                    criticalFilaments.length > 0
                      ? styles.red
                      : styles.green
                  }
                >
                  {criticalFilaments.length}
                </strong>
                <small>
                  {missingRolls}{" "}
                  {missingRolls === 1
                    ? "Rolle"
                    : "Rollen"}{" "}
                  empfohlen
                </small>
              </div>

              <div>
                <span>Heute</span>
                <strong>
                  {todaysLogs.length}
                </strong>
                <small>
                  <i className={styles.green}>
                    +{todaysIn}
                  </i>{" "}
                  rein ·{" "}
                  <i className={styles.red}>
                    −{todaysOut}
                  </i>{" "}
                  raus
                </small>
              </div>
            </div>
          </>
        );

      case "stock-health":
        return (
          <>
            <div className={styles.widgetHeading}>
              <div>
                <span>Lagerstatus</span>
                <h2>Lagergesundheit</h2>
              </div>

              <Link href="/nachbestellen">
                Details
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
                <p>
                  <span className={styles.dotGreen} />
                  <strong>
                    {healthyFilaments.length}
                  </strong>
                  <small>stabile Typen</small>
                </p>
                <p>
                  <span className={styles.dotRed} />
                  <strong>
                    {criticalFilaments.length}
                  </strong>
                  <small>kritische Typen</small>
                </p>
                <p>
                  <span
                    className={styles.dotOrange}
                  />
                  <strong>{missingRolls}</strong>
                  <small>empfohlene Rollen</small>
                </p>
              </div>
            </div>
          </>
        );

      case "urgent-reorders":
        return (
          <>
            <div className={styles.widgetHeading}>
              <div>
                <span>Priorität</span>
                <h2>Dringend nachbestellen</h2>
              </div>

              <Link href="/nachbestellen">
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
                  (filament) => {
                    const amount =
                      recommendedOrderAmount(
                        filament,
                      );

                    return (
                      <Link
                        className={styles.reorderRow}
                        key={filament.id}
                        href={`/filamente/${filament.id}`}
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

                        <div>
                          <strong>
                            {filament.material}{" "}
                            {filament.color}
                          </strong>
                          <small>
                            {filament.manufacturer}
                          </small>
                        </div>

                        <b>
                          +{amount}
                          <small>
                            {amount === 1
                              ? "Rolle"
                              : "Rollen"}
                          </small>
                        </b>
                      </Link>
                    );
                  },
                )}
              </div>
            )}
          </>
        );

      case "recent-activity":
        return (
          <>
            <div className={styles.widgetHeading}>
              <div>
                <span>Aktivität</span>
                <h2>Letzte Bewegungen</h2>
              </div>

              <Link href="/protokoll">
                Protokoll
              </Link>
            </div>

            {recentLogs.length === 0 ? (
              <div className={styles.emptyState}>
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

                    <div>
                      <strong>
                        {entry.filamentName}
                      </strong>
                      <small>
                        {entry.source === "scan"
                          ? "Barcode-Scanner"
                          : "Manuelle Änderung"}
                      </small>
                    </div>

                    <time>
                      {formatActivityTime(entry)}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </>
        );
    }
  }

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <span className="welcome-label">
            Willkommen zurück,
          </span>
          <h1>{displayName}</h1>
          <p>
            Dein persönliches Dashboard
          </p>
        </div>

        <div className={styles.headerActions}>
          <div className="system-status">
            <span className="status-dot" />
            System aktuell
          </div>

          <button
            className={
              editMode
                ? styles.editButtonActive
                : styles.editButton
            }
            type="button"
            onClick={() =>
              setEditMode((current) => !current)
            }
          >
            {editMode
              ? "Bearbeitung beenden"
              : "Dashboard bearbeiten"}
          </button>
        </div>
      </header>

      {editMode && (
        <section className={styles.editor}>
          <div className={styles.editorHeader}>
            <div>
              <span>Widget-Einstellungen</span>
              <h2>
                Dashboard selbst zusammenstellen
              </h2>
              <p>
                Widgets einblenden, ausblenden,
                sortieren und in der Breite ändern.
              </p>
            </div>

            <button
              type="button"
              onClick={resetWidgets}
            >
              Standard wiederherstellen
            </button>
          </div>

          <div className={styles.editorList}>
            {widgets.map((widget, index) => (
              <div
                className={styles.editorRow}
                key={widget.id}
              >
                <button
                  className={
                    widget.visible
                      ? styles.visibilityActive
                      : styles.visibilityButton
                  }
                  type="button"
                  aria-pressed={widget.visible}
                  onClick={() =>
                    updateWidget(widget.id, {
                      visible: !widget.visible,
                    })
                  }
                >
                  {widget.visible
                    ? "Sichtbar"
                    : "Ausgeblendet"}
                </button>

                <strong>
                  {WIDGET_LABELS[widget.id]}
                </strong>

                <label>
                  <span>Breite</span>
                  <select
                    value={widget.size}
                    onChange={(event) =>
                      updateWidget(widget.id, {
                        size:
                          event.target.value ===
                          "full"
                            ? "full"
                            : "half",
                      })
                    }
                  >
                    <option value="half">
                      Halbe Breite
                    </option>
                    <option value="full">
                      Volle Breite
                    </option>
                  </select>
                </label>

                <div
                  className={
                    styles.orderButtons
                  }
                >
                  <button
                    type="button"
                    aria-label={`${WIDGET_LABELS[widget.id]} nach oben verschieben`}
                    disabled={index === 0}
                    onClick={() =>
                      moveWidget(widget.id, -1)
                    }
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    aria-label={`${WIDGET_LABELS[widget.id]} nach unten verschieben`}
                    disabled={
                      index === widgets.length - 1
                    }
                    onClick={() =>
                      moveWidget(widget.id, 1)
                    }
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className={styles.storageNote}>
            Die Anordnung wird automatisch in diesem
            Browser gespeichert.
          </p>
        </section>
      )}

      {visibleWidgets.length === 0 ? (
        <section className={styles.noWidgets}>
          <span>▦</span>
          <h2>Keine Widgets sichtbar</h2>
          <p>
            Öffne „Dashboard bearbeiten“ und aktiviere
            mindestens ein Widget.
          </p>
        </section>
      ) : (
        <div className={styles.dashboardGrid}>
          {visibleWidgets.map((widget) => (
            <section
              className={`${styles.widget} ${
                widget.size === "full"
                  ? styles.widgetFull
                  : styles.widgetHalf
              } ${
                editMode
                  ? styles.widgetEditing
                  : ""
              }`}
              key={widget.id}
            >
              {editMode && (
                <span
                  className={styles.editingBadge}
                >
                  Widget
                </span>
              )}
              {renderWidget(widget.id)}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
