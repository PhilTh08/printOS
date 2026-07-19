"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { useHub } from "@/components/philamentix/hub-provider";
import {
  normalizeBarcode,
  type StockMode,
} from "@/components/philamentix/types";

import styles from "./page.module.css";

export default function StoragePage() {
  const router = useRouter();
  const { filaments, adjustStock, busy } = useHub();
  const [mode, setMode] = useState<StockMode>("in");
  const [barcode, setBarcode] = useState("");
  const [message, setMessage] =
    useState("Scanner bereit.");
  const [unknownBarcode, setUnknownBarcode] =
    useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef({
    barcode: "",
    timestamp: 0,
  });

  const totalRolls = filaments.reduce(
    (sum, filament) => sum + filament.stock,
    0,
  );
  const totalWeight = filaments.reduce(
    (sum, filament) =>
      sum + filament.stock * filament.weightPerRoll,
    0,
  );
  const criticalFilaments = filaments.filter(
    (filament) =>
      filament.stock <= filament.minimumStock,
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  async function processBarcode() {
    const scannedBarcode = normalizeBarcode(barcode);

    if (!scannedBarcode || busy) {
      if (!scannedBarcode) {
        setMessage("Bitte einen Barcode scannen.");
      }
      inputRef.current?.focus();
      return;
    }

    const currentTimestamp = performance.now();
    const duplicate =
      lastScanRef.current.barcode === scannedBarcode &&
      currentTimestamp - lastScanRef.current.timestamp <
        1200;

    if (duplicate) {
      setMessage(
        "Doppelscan verhindert. Bitte kurz warten und erneut scannen.",
      );
      setBarcode("");
      inputRef.current?.focus();
      return;
    }

    lastScanRef.current = {
      barcode: scannedBarcode,
      timestamp: currentTimestamp,
    };

    const filament = filaments.find(
      (item) => item.barcode === scannedBarcode,
    );

    if (!filament) {
      setUnknownBarcode(scannedBarcode);
      setMessage(
        `Barcode ${scannedBarcode} ist in deinem Account nicht bekannt.`,
      );
      setBarcode("");
      inputRef.current?.focus();
      return;
    }

    setUnknownBarcode("");

    try {
      const updated = await adjustStock(
        filament.id,
        mode,
        "scan",
      );
      setMessage(
        mode === "in"
          ? `${updated.manufacturer} ${updated.material} ${updated.color} eingelagert. Neuer Bestand: ${updated.stock} Rollen.`
          : `${updated.manufacturer} ${updated.material} ${updated.color} entfernt. Neuer Bestand: ${updated.stock} Rollen.`,
      );
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Lagerbewegung konnte nicht gespeichert werden.",
      );
    } finally {
      setBarcode("");
      inputRef.current?.focus();
    }
  }

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <h1>Filamentlager</h1>
          <p>
            Barcode scannen und Rollen automatisch verwalten
          </p>
        </div>

        <div className="system-status">
          <span className="status-dot" />
          Scanner bereit
        </div>
      </header>

      <section className="statistics">
        <article className="stat-card">
          <span>Filamenttypen</span>
          <strong className="accent">
            {filaments.length}
          </strong>
        </article>

        <article className="stat-card">
          <span>Rollen gesamt</span>
          <strong>{totalRolls}</strong>
        </article>

        <article className="stat-card">
          <span>Gesamtgewicht</span>
          <strong className="blue">
            {(totalWeight / 1000).toLocaleString(
              "de-DE",
            )}{" "}
            kg
          </strong>
        </article>

        <article className="stat-card">
          <span>Unter Mindestbestand</span>
          <strong className="red">
            {criticalFilaments.length}
          </strong>
        </article>
      </section>

      <section className="workspace">
        <article
          className="panel scanner-panel"
          onClick={() => inputRef.current?.focus()}
        >
          <div className="scanner-heading">
            <h2>Barcode-Scanner</h2>
            <span
              className={`mode-indicator ${
                mode === "in"
                  ? "mode-indicator-in"
                  : "mode-indicator-out"
              }`}
            >
              {mode === "in" ? "EINLAGERN" : "ENTFERNEN"}
            </span>
          </div>

          <div className="mode-buttons">
            <button
              className={`mode-button ${
                mode === "in" ? "active" : ""
              }`}
              type="button"
              onClick={() => setMode("in")}
            >
              + Rolle einlagern
            </button>

            <button
              className={`mode-button remove ${
                mode === "out" ? "remove-active" : ""
              }`}
              type="button"
              onClick={() => setMode("out")}
            >
              − Rolle entfernen
            </button>
          </div>

          <input
            ref={inputRef}
            className="barcode-input"
            type="text"
            value={barcode}
            onChange={(event) =>
              setBarcode(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void processBarcode();
              }
            }}
            aria-label="Barcode"
            autoFocus
          />

          <div
            className={`scanner-message ${
              message.includes("eingelagert")
                ? "success-message"
                : message.includes("entfernt") ||
                    message.includes("nicht bekannt") ||
                    message.includes("keinen Bestand") ||
                    message.includes("null")
                  ? "error-message"
                  : ""
            }`}
          >
            <span>{message}</span>

            {unknownBarcode && mode === "in" && (
              <button
                className="unknown-barcode-button"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  router.push(
                    `/filamente/neu?barcode=${encodeURIComponent(
                      unknownBarcode,
                    )}&stock=1&source=scanner`,
                  );
                }}
              >
                Filament mit diesem Barcode anlegen
              </button>
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Kritische Bestände</h2>

          {criticalFilaments.length === 0 ? (
            <p className="empty-message">
              Keine kritischen Bestände.
            </p>
          ) : (
            <div className="warning-list">
              {criticalFilaments.map((filament) => (
                <div
                  className="warning-card"
                  key={filament.id}
                >
                  <div className="warning-header">
                    <strong>
                      {filament.material} {filament.color}
                    </strong>
                    <span>{filament.stock} Rollen</span>
                  </div>

                  <p>
                    {filament.manufacturer} ·{" "}
                    {filament.location || "Kein Lagerort"}
                  </p>

                  <button
                    className="order-button"
                    type="button"
                    disabled={!filament.orderLink}
                    onClick={() => {
                      if (filament.orderLink) {
                        window.open(
                          filament.orderLink,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }
                    }}
                  >
                    Nachbestellen
                  </button>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
