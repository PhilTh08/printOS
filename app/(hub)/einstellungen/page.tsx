"use client";

import {
  ChangeEvent,
  useRef,
  useState,
} from "react";

import { useHub } from "@/components/philamentix/hub-provider";

import styles from "./page.module.css";

export default function SettingsPage() {
  const {
    filaments,
    logs,
    clearLogs,
    busy,
    exportData,
    importData,
  } = useHub();
  const importInputRef =
    useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function handleExport() {
    clearFeedback();

    try {
      exportData();
      setMessage(
        "Dein persönliches Backup wurde exportiert.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Backup konnte nicht exportiert werden.",
      );
    }
  }

  async function handleImport(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    clearFeedback();

    try {
      await importData(file);
      setMessage(
        "Backup wurde erfolgreich importiert.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Backup konnte nicht importiert werden.",
      );
    }
  }

  async function resetStatistics() {
    const confirmed = window.confirm(
      "Möchtest du wirklich deine Statistik und das komplette Protokoll löschen? Filamente und Bestände bleiben erhalten.",
    );

    if (!confirmed) {
      return;
    }

    clearFeedback();

    try {
      await clearLogs();
      setMessage(
        "Deine Statistik wurde zurückgesetzt.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Statistik konnte nicht zurückgesetzt werden.",
      );
    }
  }

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <span className="welcome-label">
            System
          </span>
          <h1>Einstellungen</h1>
          <p>
            Backups, Daten und Philamentix Hub
            verwalten
          </p>
        </div>

        <div className="system-status">
          <span className="status-dot" />
          System bereit
        </div>
      </header>

      {(message || error) && (
        <div
          className={`page-feedback ${
            error ? "error" : "success"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className={styles.settingsGrid}>
        <article
          className={`${styles.settingsCard} ${styles.backupCard}`}
        >
          <div className={styles.cardHeading}>
            <span className={styles.settingsIcon}>
              ⇄
            </span>

            <div>
              <span className={styles.eyebrow}>
                Persönliche Daten
              </span>
              <h2>Backup & Wiederherstellung</h2>
              <p>
                Exportiere deinen Lagerbestand und
                dein Protokoll als JSON-Datei oder
                stelle ein vorhandenes Backup wieder
                her.
              </p>
            </div>
          </div>

          <div className={styles.backupStats}>
            <div>
              <span>Filamente</span>
              <strong>{filaments.length}</strong>
            </div>
            <div>
              <span>Protokolleinträge</span>
              <strong>{logs.length}</strong>
            </div>
            <div>
              <span>Format</span>
              <strong>JSON</strong>
            </div>
          </div>

          <div className={styles.infoBox}>
            <strong>Wichtig beim Import</strong>
            <p>
              Ein importiertes Backup ersetzt deine
              aktuellen persönlichen Filamente und
              Protokolle. Vor dem Import erscheint
              deshalb noch eine Sicherheitsabfrage.
            </p>
          </div>

          <div className={styles.backupActions}>
            <button
              className={styles.exportButton}
              type="button"
              disabled={busy}
              onClick={handleExport}
            >
              ⇩ Daten exportieren
            </button>

            <button
              className={styles.importButton}
              type="button"
              disabled={busy}
              onClick={() =>
                importInputRef.current?.click()
              }
            >
              ⇧ Daten importieren
            </button>

            <input
              ref={importInputRef}
              className={styles.hiddenInput}
              type="file"
              accept="application/json,.json"
              onChange={(event) =>
                void handleImport(event)
              }
            />
          </div>
        </article>

        <article className={styles.settingsCard}>
          <div className={styles.cardHeading}>
            <span className={styles.settingsIcon}>
              ↺
            </span>

            <div>
              <span className={styles.eyebrow}>
                Statistik
              </span>
              <h2>Statistiken zurücksetzen</h2>
              <p>
                Entfernt alle bisherigen
                Lagerbewegungen und startet deine
                Statistik bei null.
              </p>
            </div>
          </div>

          <div
            className={`${styles.infoBox} ${styles.warningBox}`}
          >
            <strong>Achtung</strong>
            <p>
              Da die Statistiken aus dem persönlichen
              Protokoll berechnet werden, wird dabei
              auch dein vollständiges Ein- und
              Auslagerungsprotokoll gelöscht.
              Filamente und aktuelle Bestände bleiben
              erhalten.
            </p>
          </div>

          <div className={styles.resetActions}>
            <button
              className={styles.dangerButton}
              type="button"
              disabled={busy || logs.length === 0}
              onClick={() =>
                void resetStatistics()
              }
            >
              {busy
                ? "Wird zurückgesetzt …"
                : logs.length === 0
                  ? "Statistiken bereits leer"
                  : "Statistiken zurücksetzen"}
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}
