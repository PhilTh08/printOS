"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import {
  defaultFilamentDefaults,
  type FilamentDefaults,
  type FilamentImageMode,
} from "@/components/philamentix/types";

import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

const IMAGE_MODES: Array<{
  id: FilamentImageMode;
  label: string;
  description: string;
}> = [
  {
    id: "off",
    label: "Aus",
    description:
      "Keine Bilder in Übersicht und Detailansicht. Die Karten sind besonders kompakt.",
  },
  {
    id: "small",
    label: "Klein",
    description:
      "Kompakte Vorschaubilder mit mehr Platz für Bestandsinformationen.",
  },
  {
    id: "large",
    label: "Groß",
    description:
      "Große Produktbilder wie bisher. Ideal für die visuelle Erkennung.",
  },
];

export default function SettingsPage() {
  const {
    user,
    filaments,
    logs,
    clearLogs,
    busy,
    exportData,
    importData,
    filamentImageMode,
    filamentDefaults,
    preferenceSyncState,
    preferenceMessage,
    updateFilamentImageMode,
    updateFilamentDefaults,
  } = useHub();
  const importInputRef =
    useRef<HTMLInputElement>(null);
  const [defaultsForm, setDefaultsForm] =
    useState<FilamentDefaults>(
      filamentDefaults,
    );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [orderCount, setOrderCount] =
    useState(0);

  useEffect(() => {
    setDefaultsForm(filamentDefaults);
  }, [filamentDefaults]);

  useEffect(() => {
    if (!user) {
      setOrderCount(0);
      return;
    }

    let active = true;

    void supabase
      .from("orders")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)
      .then(({ count, error: countError }) => {
        if (!active) {
          return;
        }

        if (countError) {
          setOrderCount(0);
          return;
        }

        setOrderCount(count ?? 0);
      });

    return () => {
      active = false;
    };
  }, [user]);

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function setDefaultField<
    K extends keyof FilamentDefaults,
  >(
    key: K,
    value: FilamentDefaults[K],
  ) {
    setDefaultsForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function selectImageMode(
    mode: FilamentImageMode,
  ) {
    clearFeedback();

    try {
      await updateFilamentImageMode(mode);
      setMessage(
        `Filamentbilder wurden auf „${
          IMAGE_MODES.find(
            (item) => item.id === mode,
          )?.label ?? mode
        }“ gestellt.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Bilddarstellung konnte nicht gespeichert werden.",
      );
    }
  }

  async function saveDefaults(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    clearFeedback();

    try {
      await updateFilamentDefaults(
        defaultsForm,
      );
      setMessage(
        "Standardwerte für neue Filamente wurden gespeichert.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Standardwerte konnten nicht gespeichert werden.",
      );
    }
  }

  async function resetDefaults() {
    clearFeedback();
    setDefaultsForm(defaultFilamentDefaults);

    try {
      await updateFilamentDefaults(
        defaultFilamentDefaults,
      );
      setMessage(
        "Standardwerte wurden auf die Werkseinstellungen zurückgesetzt.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Standardwerte konnten nicht zurückgesetzt werden.",
      );
    }
  }

  async function handleExport() {
    clearFeedback();

    try {
      await exportData();
      setMessage(
        "Dein persönliches CSV-Backup inklusive Aufträgen wurde exportiert.",
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

      if (user) {
        const {
          count,
          error: countError,
        } = await supabase
          .from("orders")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("user_id", user.id);

        if (!countError) {
          setOrderCount(count ?? 0);
        }
      }

      setMessage(
        "CSV-Backup wurde erfolgreich wiederhergestellt.",
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

  const preferenceStatusLabel =
    preferenceSyncState === "loading"
      ? "Wird geladen"
      : preferenceSyncState === "saving"
        ? "Wird gespeichert"
        : preferenceSyncState === "synced"
          ? "Cloud-Sync aktiv"
          : preferenceSyncState === "local"
            ? "Nur lokal"
            : "Sync-Fehler";

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <span className="welcome-label">
            System
          </span>
          <h1>Einstellungen</h1>
          <p>
            Darstellung, Standardwerte, Backups und
            persönliche Daten verwalten
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
          className={`${styles.settingsCard} ${styles.displayCard}`}
        >
          <div className={styles.cardHeading}>
            <span className={styles.settingsIcon}>
              ◫
            </span>

            <div>
              <span className={styles.eyebrow}>
                Darstellung
              </span>
              <h2>Filamentbilder anzeigen</h2>
              <p>
                Bestimme, wie groß Produktbilder in
                den Filamenttypen und auf der
                Detailseite dargestellt werden.
                Beim Bearbeiten bleibt die
                Bildvorschau immer verfügbar.
              </p>
            </div>
          </div>

          <div className={styles.imageModeOptions}>
            {IMAGE_MODES.map((mode) => (
              <button
                className={`${styles.imageModeButton} ${
                  filamentImageMode === mode.id
                    ? styles.imageModeSelected
                    : ""
                }`}
                type="button"
                key={mode.id}
                aria-pressed={
                  filamentImageMode === mode.id
                }
                disabled={
                  preferenceSyncState ===
                  "saving"
                }
                onClick={() =>
                  void selectImageMode(mode.id)
                }
              >
                <span
                  className={`${styles.modePreview} ${
                    mode.id === "off"
                      ? styles.modePreviewOff
                      : mode.id === "small"
                        ? styles.modePreviewSmall
                        : styles.modePreviewLarge
                  }`}
                >
                  {mode.id !== "off" && (
                    <i>FILAMENT</i>
                  )}
                  <b>
                    <em />
                    <em />
                    <em />
                  </b>
                </span>

                <strong>{mode.label}</strong>
                <small>{mode.description}</small>
              </button>
            ))}
          </div>
        </article>

        <article
          className={`${styles.settingsCard} ${styles.defaultsCard}`}
        >
          <div className={styles.cardHeading}>
            <span className={styles.settingsIcon}>
              ⎘
            </span>

            <div>
              <span className={styles.eyebrow}>
                Neue Filamente
              </span>
              <h2>Standardwerte</h2>
              <p>
                Diese Werte werden beim manuellen
                Anlegen und nach einem unbekannten
                Barcode automatisch vorausgefüllt.
                Bestehende Filamente werden nicht
                verändert.
              </p>
            </div>
          </div>

          <form
            className={styles.defaultsForm}
            onSubmit={(event) =>
              void saveDefaults(event)
            }
          >
            <label>
              <span>Standard-Hersteller</span>
              <input
                value={
                  defaultsForm.manufacturer
                }
                onChange={(event) =>
                  setDefaultField(
                    "manufacturer",
                    event.target.value,
                  )
                }
                placeholder="z. B. Bambu Lab"
              />
            </label>

            <label>
              <span>Standard-Material</span>
              <input
                value={defaultsForm.material}
                onChange={(event) =>
                  setDefaultField(
                    "material",
                    event.target.value,
                  )
                }
                placeholder="z. B. PLA"
              />
            </label>

            <label>
              <span>Gewicht pro Rolle</span>
              <div
                className={
                  styles.numberInputWithUnit
                }
              >
                <input
                  type="number"
                  min="1"
                  max="50000"
                  value={
                    defaultsForm.weightPerRoll
                  }
                  onChange={(event) =>
                    setDefaultField(
                      "weightPerRoll",
                      Number(
                        event.target.value,
                      ) || 1,
                    )
                  }
                />
                <b>g</b>
              </div>
            </label>

            <label>
              <span>Standard-Lagerplatz</span>
              <input
                value={defaultsForm.location}
                onChange={(event) =>
                  setDefaultField(
                    "location",
                    event.target.value,
                  )
                }
                placeholder="z. B. Regal A2"
              />
            </label>

            <label>
              <span>Standard-Mindestbestand</span>
              <div
                className={
                  styles.numberInputWithUnit
                }
              >
                <input
                  type="number"
                  min="0"
                  max="9999"
                  value={
                    defaultsForm.minimumStock
                  }
                  onChange={(event) =>
                    setDefaultField(
                      "minimumStock",
                      Math.max(
                        0,
                        Number(
                          event.target.value,
                        ) || 0,
                      ),
                    )
                  }
                />
                <b>Rollen</b>
              </div>
            </label>

            <div
              className={styles.defaultsPreview}
            >
              <span>Vorschau für neue Einträge</span>
              <strong>
                {defaultsForm.manufacturer ||
                  "Kein Hersteller"}{" "}
                ·{" "}
                {defaultsForm.material || "PLA"}
              </strong>
              <small>
                {defaultsForm.weightPerRoll} g ·{" "}
                {defaultsForm.location ||
                  "Kein Lagerplatz"}{" "}
                · Mindestbestand{" "}
                {defaultsForm.minimumStock}
              </small>
            </div>

            <div
              className={styles.defaultsActions}
            >
              <button
                className={
                  styles.secondarySettingsButton
                }
                type="button"
                disabled={
                  preferenceSyncState ===
                  "saving"
                }
                onClick={() =>
                  void resetDefaults()
                }
              >
                Werkseinstellungen
              </button>

              <button
                className={
                  styles.primarySettingsButton
                }
                type="submit"
                disabled={
                  preferenceSyncState ===
                  "saving"
                }
              >
                {preferenceSyncState === "saving"
                  ? "Wird gespeichert …"
                  : "Standardwerte speichern"}
              </button>
            </div>
          </form>
        </article>

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
                Exportiere Filamente, Protokolle und
                Aufträge gemeinsam als CSV-Datei oder
                stelle ein vorhandenes Philamentix-Backup
                wieder her.
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
              <span>Aufträge</span>
              <strong>{orderCount}</strong>
            </div>
            <div>
              <span>Format</span>
              <strong>CSV</strong>
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
              onClick={() =>
                void handleExport()
              }
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
              accept="text/csv,.csv"
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

        <div
          className={`${styles.preferenceStatus} ${
            preferenceSyncState === "synced"
              ? styles.preferenceSynced
              : preferenceSyncState ===
                    "error"
                ? styles.preferenceError
                : preferenceSyncState ===
                      "local"
                  ? styles.preferenceLocal
                  : styles.preferenceWorking
          }`}
        >
          <span />
          <div>
            <strong>
              {preferenceStatusLabel}
            </strong>
            <small>{preferenceMessage}</small>
          </div>
        </div>
      </section>
    </div>
  );
}
