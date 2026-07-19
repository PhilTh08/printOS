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
  StockMode,
} from "@/components/philamentix/types";

import styles from "./page.module.css";

type WidgetId =
  | "quick-actions"
  | "inventory-summary"
  | "stock-health"
  | "urgent-reorders"
  | "recent-activity"
  | "quick-stock"
  | "filament-search"
  | "today-balance"
  | "storage-locations";

type WidgetSize = "half" | "full";

type ActiveWidget = {
  id: WidgetId;
  size: WidgetSize;
};

type WidgetDefinition = {
  id: WidgetId;
  label: string;
  description: string;
  icon: string;
  defaultSize: WidgetSize;
};

const WIDGET_CATALOG: WidgetDefinition[] = [
  {
    id: "quick-actions",
    label: "Schnellzugriffe",
    description:
      "Scanner, neues Filament, Nachbestellen und Statistiken.",
    icon: "⌁",
    defaultSize: "full",
  },
  {
    id: "inventory-summary",
    label: "Lagerübersicht",
    description:
      "Rollen, Gesamtgewicht, kritische Bestände und heutige Bewegungen.",
    icon: "▦",
    defaultSize: "full",
  },
  {
    id: "urgent-reorders",
    label: "Dringend nachbestellen",
    description:
      "Zeigt die drei wichtigsten offenen Nachbestellungen.",
    icon: "!",
    defaultSize: "half",
  },
  {
    id: "recent-activity",
    label: "Letzte Bewegungen",
    description:
      "Die neuesten Ein- und Auslagerungen im Überblick.",
    icon: "≡",
    defaultSize: "half",
  },
  {
    id: "stock-health",
    label: "Lagergesundheit",
    description:
      "Prozentuale Übersicht stabiler und kritischer Filamenttypen.",
    icon: "◉",
    defaultSize: "half",
  },
  {
    id: "quick-stock",
    label: "Schnellbestand",
    description:
      "Ein Filament auswählen und den Bestand direkt um eine Rolle ändern.",
    icon: "±",
    defaultSize: "half",
  },
  {
    id: "filament-search",
    label: "Filamentsuche",
    description:
      "Filamente sofort nach Farbe, Material, Hersteller oder Barcode finden.",
    icon: "⌕",
    defaultSize: "half",
  },
  {
    id: "today-balance",
    label: "Tagesbilanz",
    description:
      "Heutige Einlagerungen, Auslagerungen und Nettoveränderung.",
    icon: "↕",
    defaultSize: "half",
  },
  {
    id: "storage-locations",
    label: "Lagerplätze",
    description:
      "Die wichtigsten Lagerplätze mit Rollen- und Typanzahl.",
    icon: "▤",
    defaultSize: "half",
  },
];

const DEFAULT_ACTIVE_WIDGETS: ActiveWidget[] = [
  {
    id: "quick-actions",
    size: "full",
  },
  {
    id: "inventory-summary",
    size: "full",
  },
  {
    id: "urgent-reorders",
    size: "half",
  },
  {
    id: "recent-activity",
    size: "half",
  },
];

function isWidgetId(value: unknown): value is WidgetId {
  return WIDGET_CATALOG.some(
    (widget) => widget.id === value,
  );
}

function getWidgetDefinition(
  id: WidgetId,
): WidgetDefinition {
  const definition = WIDGET_CATALOG.find(
    (widget) => widget.id === id,
  );

  if (!definition) {
    throw new Error(
      `Unbekanntes Dashboard-Widget: ${id}`,
    );
  }

  return definition;
}

function normalizeActiveWidgets(
  value: unknown,
): ActiveWidget[] {
  if (!Array.isArray(value)) {
    return DEFAULT_ACTIVE_WIDGETS;
  }

  const seenIds = new Set<WidgetId>();
  const normalized: ActiveWidget[] = [];

  for (const entry of value) {
    if (
      typeof entry !== "object" ||
      entry === null
    ) {
      continue;
    }

    const candidate = entry as Partial<
      ActiveWidget & {
        visible: boolean;
      }
    >;

    if (
      !isWidgetId(candidate.id) ||
      seenIds.has(candidate.id) ||
      candidate.visible === false
    ) {
      continue;
    }

    seenIds.add(candidate.id);
    normalized.push({
      id: candidate.id,
      size:
        candidate.size === "full"
          ? "full"
          : "half",
    });
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
    busy,
    adjustStock,
  } = useHub();

  const [editMode, setEditMode] = useState(false);
  const [settingsLoaded, setSettingsLoaded] =
    useState(false);
  const [activeWidgets, setActiveWidgets] =
    useState<ActiveWidget[]>(
      DEFAULT_ACTIVE_WIDGETS,
    );
  const [
    selectedQuickStockId,
    setSelectedQuickStockId,
  ] = useState<number | null>(null);
  const [
    quickStockMessage,
    setQuickStockMessage,
  ] = useState("");
  const [
    quickStockError,
    setQuickStockError,
  ] = useState("");
  const [filamentSearch, setFilamentSearch] =
    useState("");

  const storageKey = `philamentix-dashboard-widgets-${
    user?.id ?? "guest"
  }`;

  useEffect(() => {
    setSettingsLoaded(false);

    try {
      const savedValue =
        window.localStorage.getItem(storageKey);

      if (!savedValue) {
        setActiveWidgets(
          DEFAULT_ACTIVE_WIDGETS,
        );
      } else {
        setActiveWidgets(
          normalizeActiveWidgets(
            JSON.parse(savedValue),
          ),
        );
      }
    } catch {
      setActiveWidgets(DEFAULT_ACTIVE_WIDGETS);
    }

    setSettingsLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify(activeWidgets),
    );
  }, [
    activeWidgets,
    settingsLoaded,
    storageKey,
  ]);

  useEffect(() => {
    if (filaments.length === 0) {
      setSelectedQuickStockId(null);
      return;
    }

    const selectionStillExists =
      selectedQuickStockId !== null &&
      filaments.some(
        (filament) =>
          filament.id === selectedQuickStockId,
      );

    if (!selectionStillExists) {
      setSelectedQuickStockId(
        filaments[0].id,
      );
    }
  }, [filaments, selectedQuickStockId]);

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
  const todayNet = todaysIn - todaysOut;
  const recentLogs = logs.slice(0, 6);

  const selectedQuickStock =
    filaments.find(
      (filament) =>
        filament.id === selectedQuickStockId,
    ) ??
    filaments[0] ??
    null;

  const searchResults = useMemo(() => {
    const query =
      filamentSearch.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return filaments
      .filter((filament) =>
        [
          filament.id,
          filament.barcode,
          filament.manufacturer,
          filament.material,
          filament.color,
          filament.location,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 6);
  }, [filamentSearch, filaments]);

  const storageLocations = useMemo(() => {
    const groups = new Map<
      string,
      {
        location: string;
        rolls: number;
        types: number;
        critical: number;
      }
    >();

    for (const filament of filaments) {
      const location =
        filament.location.trim() ||
        "Ohne Lagerplatz";
      const current = groups.get(location) ?? {
        location,
        rolls: 0,
        types: 0,
        critical: 0,
      };

      current.rolls += filament.stock;
      current.types += 1;

      if (
        filament.stock <=
        filament.minimumStock
      ) {
        current.critical += 1;
      }

      groups.set(location, current);
    }

    return [...groups.values()]
      .sort((first, second) => {
        if (first.rolls !== second.rolls) {
          return second.rolls - first.rolls;
        }

        return first.location.localeCompare(
          second.location,
          "de",
        );
      })
      .slice(0, 6);
  }, [filaments]);

  const activeIds = new Set(
    activeWidgets.map((widget) => widget.id),
  );
  const availableWidgets =
    WIDGET_CATALOG.filter(
      (widget) => !activeIds.has(widget.id),
    );

  function updateWidgetSize(
    id: WidgetId,
    size: WidgetSize,
  ) {
    setActiveWidgets((current) =>
      current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              size,
            }
          : widget,
      ),
    );
  }

  function moveWidget(
    id: WidgetId,
    direction: -1 | 1,
  ) {
    setActiveWidgets((current) => {
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

  function removeWidget(id: WidgetId) {
    setActiveWidgets((current) =>
      current.filter(
        (widget) => widget.id !== id,
      ),
    );
  }

  function addWidget(id: WidgetId) {
    setActiveWidgets((current) => {
      if (
        current.some(
          (widget) => widget.id === id,
        )
      ) {
        return current;
      }

      const definition =
        getWidgetDefinition(id);

      return [
        ...current,
        {
          id,
          size: definition.defaultSize,
        },
      ];
    });
  }

  function resetWidgets() {
    const confirmed = window.confirm(
      "Dashboard auf die Standardansicht zurücksetzen?",
    );

    if (!confirmed) {
      return;
    }

    setActiveWidgets(DEFAULT_ACTIVE_WIDGETS);
  }

  async function handleQuickStock(
    mode: StockMode,
  ) {
    if (!selectedQuickStock) {
      return;
    }

    setQuickStockMessage("");
    setQuickStockError("");

    try {
      const updated = await adjustStock(
        selectedQuickStock.id,
        mode,
        "manual",
      );

      setQuickStockMessage(
        `${updated.material} ${updated.color}: Bestand ist jetzt ${updated.stock}.`,
      );
    } catch (caughtError) {
      setQuickStockError(
        caughtError instanceof Error
          ? caughtError.message
          : "Bestand konnte nicht geändert werden.",
      );
    }
  }

  function renderWidget(id: WidgetId) {
    switch (id) {
      case "quick-actions":
        return (
          <>
            <WidgetHeading
              eyebrow="Schnellzugriff"
              title="Direkt loslegen"
            />

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
            <WidgetHeading
              eyebrow="Überblick"
              title="Lagerübersicht"
              href="/filamente"
              linkLabel="Bestand verwalten"
            />

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
            <WidgetHeading
              eyebrow="Lagerstatus"
              title="Lagergesundheit"
              href="/nachbestellen"
              linkLabel="Details"
            />

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
            <WidgetHeading
              eyebrow="Priorität"
              title="Dringend nachbestellen"
              href="/nachbestellen"
              linkLabel="Alle anzeigen"
            />

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
            <WidgetHeading
              eyebrow="Aktivität"
              title="Letzte Bewegungen"
              href="/protokoll"
              linkLabel="Protokoll"
            />

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

      case "quick-stock":
        return (
          <>
            <WidgetHeading
              eyebrow="Bestand"
              title="Schnellbestand"
              href="/ein-auslagern"
              linkLabel="Scanner öffnen"
            />

            {selectedQuickStock ? (
              <div className={styles.quickStock}>
                <label>
                  <span>Filament auswählen</span>
                  <select
                    value={selectedQuickStock.id}
                    onChange={(event) => {
                      setSelectedQuickStockId(
                        Number(event.target.value),
                      );
                      setQuickStockMessage("");
                      setQuickStockError("");
                    }}
                  >
                    {filaments.map((filament) => (
                      <option
                        key={filament.id}
                        value={filament.id}
                      >
                        {filament.manufacturer} ·{" "}
                        {filament.material} ·{" "}
                        {filament.color}
                      </option>
                    ))}
                  </select>
                </label>

                <div
                  className={styles.quickStockCurrent}
                >
                  <div>
                    <span>Aktueller Bestand</span>
                    <strong>
                      {selectedQuickStock.stock}
                    </strong>
                    <small>
                      Mindestbestand{" "}
                      {
                        selectedQuickStock.minimumStock
                      }
                    </small>
                  </div>

                  <div
                    className={styles.quickStockButtons}
                  >
                    <button
                      type="button"
                      disabled={
                        busy ||
                        selectedQuickStock.stock <= 0
                      }
                      onClick={() =>
                        void handleQuickStock("out")
                      }
                    >
                      − Auslagern
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void handleQuickStock("in")
                      }
                    >
                      + Einlagern
                    </button>
                  </div>
                </div>

                {(quickStockMessage ||
                  quickStockError) && (
                  <p
                    className={
                      quickStockError
                        ? styles.widgetError
                        : styles.widgetSuccess
                    }
                  >
                    {quickStockError ||
                      quickStockMessage}
                  </p>
                )}
              </div>
            ) : (
              <div className={styles.emptyState}>
                Lege zuerst ein Filament an.
              </div>
            )}
          </>
        );

      case "filament-search":
        return (
          <>
            <WidgetHeading
              eyebrow="Suche"
              title="Filament schnell finden"
              href="/filamente"
              linkLabel="Alle Filamente"
            />

            <div className={styles.searchWidget}>
              <input
                type="search"
                placeholder="Farbe, Material, Hersteller, Barcode …"
                value={filamentSearch}
                onChange={(event) =>
                  setFilamentSearch(
                    event.target.value,
                  )
                }
              />

              {!filamentSearch.trim() ? (
                <div
                  className={styles.searchPlaceholder}
                >
                  Suche starten, um passende
                  Filamente direkt zu öffnen.
                </div>
              ) : searchResults.length === 0 ? (
                <div
                  className={styles.searchPlaceholder}
                >
                  Kein Filament gefunden.
                </div>
              ) : (
                <div className={styles.searchResults}>
                  {searchResults.map((filament) => (
                    <Link
                      key={filament.id}
                      href={`/filamente/${filament.id}`}
                    >
                      <span
                        className={
                          filament.stock <=
                          filament.minimumStock
                            ? styles.searchStockLow
                            : styles.searchStockOk
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
                          {filament.location
                            ? ` · ${filament.location}`
                            : ""}
                        </small>
                      </div>
                      <b>→</b>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        );

      case "today-balance":
        return (
          <>
            <WidgetHeading
              eyebrow="Heute"
              title="Tagesbilanz"
              href="/protokoll"
              linkLabel="Details"
            />

            <div className={styles.balanceGrid}>
              <div className={styles.balanceIn}>
                <span>Einlagerungen</span>
                <strong>+{todaysIn}</strong>
              </div>

              <div className={styles.balanceOut}>
                <span>Auslagerungen</span>
                <strong>−{todaysOut}</strong>
              </div>

              <div
                className={
                  todayNet >= 0
                    ? styles.balanceNetPositive
                    : styles.balanceNetNegative
                }
              >
                <span>Netto</span>
                <strong>
                  {todayNet > 0 ? "+" : ""}
                  {todayNet}
                </strong>
              </div>
            </div>

            <div className={styles.balanceBar}>
              <div>
                <span
                  style={{
                    width: `${
                      todaysLogs.length === 0
                        ? 50
                        : Math.round(
                            (todaysIn /
                              todaysLogs.length) *
                              100,
                          )
                    }%`,
                  }}
                />
              </div>
              <small>
                {todaysLogs.length === 0
                  ? "Heute noch keine Bewegungen"
                  : `${todaysLogs.length} Bewegungen insgesamt`}
              </small>
            </div>

            <Link
              className={styles.balanceAction}
              href="/ein-auslagern"
            >
              Neue Lagerbewegung →
            </Link>
          </>
        );

      case "storage-locations":
        return (
          <>
            <WidgetHeading
              eyebrow="Organisation"
              title="Lagerplätze"
              href="/filamente"
              linkLabel="Filamente öffnen"
            />

            {storageLocations.length === 0 ? (
              <div className={styles.emptyState}>
                Noch keine Lagerplätze vorhanden.
              </div>
            ) : (
              <div className={styles.locationList}>
                {storageLocations.map(
                  (location) => (
                    <div
                      key={location.location}
                    >
                      <span>▤</span>
                      <div>
                        <strong>
                          {location.location}
                        </strong>
                        <small>
                          {location.types}{" "}
                          {location.types === 1
                            ? "Typ"
                            : "Typen"}
                          {location.critical > 0
                            ? ` · ${location.critical} kritisch`
                            : ""}
                        </small>
                      </div>
                      <b>
                        {location.rolls}
                        <small>Rollen</small>
                      </b>
                    </div>
                  ),
                )}
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
              <span>Dashboard-Konfiguration</span>
              <h2>
                Aktive Widgets verwalten
              </h2>
              <p>
                Entfernte Widgets verschwinden
                vollständig und können unten aus der
                Bibliothek wieder hinzugefügt werden.
              </p>
            </div>

            <button
              type="button"
              onClick={resetWidgets}
            >
              Standard wiederherstellen
            </button>
          </div>

          {activeWidgets.length === 0 ? (
            <div className={styles.emptyEditor}>
              Keine Widgets aktiv. Füge unten ein
              Widget aus der Bibliothek hinzu.
            </div>
          ) : (
            <div className={styles.editorList}>
              {activeWidgets.map(
                (widget, index) => {
                  const definition =
                    getWidgetDefinition(widget.id);

                  return (
                    <div
                      className={styles.editorRow}
                      key={widget.id}
                    >
                      <span
                        className={
                          styles.editorIcon
                        }
                      >
                        {definition.icon}
                      </span>

                      <div
                        className={
                          styles.editorWidgetText
                        }
                      >
                        <strong>
                          {definition.label}
                        </strong>
                        <small>
                          {definition.description}
                        </small>
                      </div>

                      <label>
                        <span>Breite</span>
                        <select
                          value={widget.size}
                          onChange={(event) =>
                            updateWidgetSize(
                              widget.id,
                              event.target.value ===
                                "full"
                                ? "full"
                                : "half",
                            )
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
                          styles.editorActions
                        }
                      >
                        <button
                          type="button"
                          aria-label={`${definition.label} nach oben verschieben`}
                          disabled={index === 0}
                          onClick={() =>
                            moveWidget(
                              widget.id,
                              -1,
                            )
                          }
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          aria-label={`${definition.label} nach unten verschieben`}
                          disabled={
                            index ===
                            activeWidgets.length - 1
                          }
                          onClick={() =>
                            moveWidget(
                              widget.id,
                              1,
                            )
                          }
                        >
                          ↓
                        </button>

                        <button
                          className={
                            styles.removeButton
                          }
                          type="button"
                          onClick={() =>
                            removeWidget(widget.id)
                          }
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}

          <div className={styles.libraryHeader}>
            <span>Widget-Bibliothek</span>
            <h2>Widgets hinzufügen</h2>
            <p>
              Neue und entfernte Widgets erscheinen
              hier.
            </p>
          </div>

          {availableWidgets.length === 0 ? (
            <div className={styles.emptyLibrary}>
              Alle verfügbaren Widgets sind bereits
              aktiv.
            </div>
          ) : (
            <div className={styles.widgetLibrary}>
              {availableWidgets.map((widget) => (
                <article key={widget.id}>
                  <span>{widget.icon}</span>
                  <div>
                    <strong>{widget.label}</strong>
                    <p>{widget.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      addWidget(widget.id)
                    }
                  >
                    + Hinzufügen
                  </button>
                </article>
              ))}
            </div>
          )}

          <p className={styles.storageNote}>
            Die Auswahl und Reihenfolge werden
            automatisch für diesen Benutzer in
            diesem Browser gespeichert.
          </p>
        </section>
      )}

      {activeWidgets.length === 0 ? (
        <section className={styles.noWidgets}>
          <span>▦</span>
          <h2>Dashboard ist leer</h2>
          <p>
            Öffne „Dashboard bearbeiten“ und füge
            Widgets aus der Bibliothek hinzu.
          </p>
        </section>
      ) : (
        <div className={styles.dashboardGrid}>
          {activeWidgets.map((widget) => (
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
                  Aktiv
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

function WidgetHeading({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className={styles.widgetHeading}>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>

      {href && linkLabel && (
        <Link href={href}>{linkLabel}</Link>
      )}
    </div>
  );
}
