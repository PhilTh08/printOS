"use client";

import { useMemo, useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";

import styles from "./page.module.css";

export default function ProtocolPage() {
  const { logs, clearLogs, busy } = useHub();
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return logs;
    }

    return logs.filter((entry) =>
      [
        entry.filamentName,
        entry.barcode,
        entry.source,
        entry.action,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [logs, search]);

  async function removeLogs() {
    const confirmed = window.confirm(
      "Möchtest du dein komplettes Protokoll wirklich löschen? Die Statistik wird dadurch ebenfalls zurückgesetzt.",
    );

    if (!confirmed) {
      return;
    }

    try {
      await clearLogs();
    } catch (caughtError) {
      window.alert(
        caughtError instanceof Error
          ? caughtError.message
          : "Protokoll konnte nicht gelöscht werden.",
      );
    }
  }

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <h1>Bewegungsprotokoll</h1>
          <p>
            Alle Einlagerungen und Entnahmen im Überblick
          </p>
        </div>

        <button
          className="delete-button"
          type="button"
          onClick={() => void removeLogs()}
          disabled={busy || logs.length === 0}
        >
          Protokoll leeren
        </button>
      </header>

      <div className="filament-toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Protokoll durchsuchen …"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />
      </div>

      {filteredLogs.length === 0 ? (
        <div className="empty-state">
          Noch keine passenden Lagerbewegungen vorhanden.
        </div>
      ) : (
        <section className="log-list">
          {filteredLogs.map((entry) => (
            <article className="log-card" key={entry.id}>
              <div
                className={`log-symbol ${
                  entry.action === "in"
                    ? "log-symbol-in"
                    : "log-symbol-out"
                }`}
              >
                {entry.action === "in" ? "+" : "−"}
              </div>

              <div className="log-content">
                <div className="log-header">
                  <strong>{entry.filamentName}</strong>
                  <time>
                    {new Date(entry.timestamp).toLocaleString(
                      "de-DE",
                    )}
                  </time>
                </div>

                <div className="log-details">
                  <span>
                    {entry.action === "in"
                      ? "1 Rolle eingelagert"
                      : "1 Rolle entfernt"}
                  </span>
                  <span>
                    Quelle:{" "}
                    {entry.source === "scan"
                      ? "Barcode-Scanner"
                      : "Manuelle Änderung"}
                  </span>
                  <span>Barcode: {entry.barcode}</span>
                  <span>
                    Bestand danach: {entry.stockAfter} Rollen
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
