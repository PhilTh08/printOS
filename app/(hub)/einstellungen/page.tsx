"use client";

import { useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";

import styles from "./page.module.css";

export default function SettingsPage() {
  const { logs, clearLogs, busy } = useHub();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resetStatistics() {
    const confirmed = window.confirm(
      "Möchtest du wirklich deine Statistik und das komplette Protokoll löschen? Filamente und Bestände bleiben erhalten.",
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await clearLogs();
      setMessage("Deine Statistik wurde zurückgesetzt.");
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
          <span className="welcome-label">System</span>
          <h1>Einstellungen</h1>
          <p>
            Philamentix Hub verwalten und zurücksetzen
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

      <section className="settings-grid">
        <article className="panel settings-card">
          <div className="settings-card-heading">
            <div>
              <span className="settings-icon">↺</span>
              <div>
                <h2>Statistiken zurücksetzen</h2>
                <p>
                  Entfernt alle bisherigen Lagerbewegungen und startet deine Statistik bei null.
                </p>
              </div>
            </div>
          </div>

          <div className="settings-warning">
            <strong>Achtung</strong>
            <p>
              Da die Statistiken aus dem persönlichen Protokoll berechnet werden, wird dabei auch dein vollständiges Ein- und Auslagerungsprotokoll gelöscht. Filamente und aktuelle Bestände bleiben erhalten.
            </p>
          </div>

          <div className="settings-actions">
            <button
              className="danger-reset-button"
              type="button"
              disabled={busy || logs.length === 0}
              onClick={() => void resetStatistics()}
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
