"use client";

import { useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import { PageHeader } from "@/components/philamentix/page-header";

import styles from "./page.module.css";

export default function SettingsPage() {
  const { logs, clearLogs, busy } = useHub();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resetStatistics() {
    const confirmed = window.confirm(
      "Wirklich dein vollständiges Protokoll und damit deine Statistik zurücksetzen? Filamente und Bestände bleiben erhalten.",
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

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
    <>
      <PageHeader
        eyebrow="System"
        title="Einstellungen"
        description="Diese Einstellungen betreffen ausschließlich deinen Account."
      />

      {(message || error) && (
        <div
          className={`${styles.feedback} ${
            error ? styles.error : styles.success
          }`}
        >
          {error || message}
        </div>
      )}

      <section className={styles.panel}>
        <div>
          <span>Persönliche Daten</span>
          <h2>Statistiken zurücksetzen</h2>
          <p>
            Löscht deine {logs.length} Protokolleinträge.
            Filamente und aktuelle Bestände bleiben
            erhalten.
          </p>
        </div>

        <button
          type="button"
          disabled={busy || logs.length === 0}
          onClick={() => void resetStatistics()}
        >
          {logs.length === 0
            ? "Statistik bereits leer"
            : "Statistik zurücksetzen"}
        </button>
      </section>
    </>
  );
}
