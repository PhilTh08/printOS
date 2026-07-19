"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { useHub } from "@/components/philamentix/hub-provider";
import { PageHeader } from "@/components/philamentix/page-header";
import {
  normalizeBarcode,
  type StockMode,
} from "@/components/philamentix/types";

import styles from "./page.module.css";

export default function ScannerPage() {
  const router = useRouter();
  const {
    filaments,
    logs,
    adjustStock,
    busy,
  } = useHub();
  const [mode, setMode] =
    useState<StockMode>("in");
  const [barcode, setBarcode] = useState("");
  const [message, setMessage] = useState(
    "Scanner bereit.",
  );
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef({
    barcode: "",
    timestamp: 0,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  async function processBarcode(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleaned = normalizeBarcode(barcode);

    if (!cleaned || busy) {
      setError(
        cleaned ? "" : "Bitte einen Barcode scannen.",
      );
      return;
    }

    const now = performance.now();
    const duplicate =
      lastScanRef.current.barcode === cleaned &&
      now - lastScanRef.current.timestamp < 1200;

    if (duplicate) {
      setError(
        "Doppelscan verhindert. Bitte kurz warten.",
      );
      setBarcode("");
      inputRef.current?.focus();
      return;
    }

    lastScanRef.current = {
      barcode: cleaned,
      timestamp: now,
    };

    const filament = filaments.find(
      (item) => item.barcode === cleaned,
    );

    if (!filament) {
      if (mode === "out") {
        setError(
          "Dieses Filament existiert nicht in deinem Account.",
        );
        setBarcode("");
        inputRef.current?.focus();
        return;
      }

      router.push(
        `/filamente/neu?barcode=${encodeURIComponent(
          cleaned,
        )}&stock=1&source=scanner`,
      );
      return;
    }

    setError("");

    try {
      const updated = await adjustStock(
        filament.id,
        mode,
        "scan",
      );

      setMessage(
        `${updated.manufacturer} ${updated.material} ${updated.color}: Bestand ${updated.stock}.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Scan konnte nicht verarbeitet werden.",
      );
    } finally {
      setBarcode("");
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Lagerbewegung"
        title="Ein-/Auslagern"
        description="Bekannte EANs ändern direkt den Bestand. Eine unbekannte EAN öffnet beim Einlagern das Formular für deinen Account."
      />

      <section className={styles.scanner}>
        <div className={styles.modeSwitch}>
          <button
            type="button"
            className={
              mode === "in" ? styles.activeIn : ""
            }
            onClick={() => setMode("in")}
          >
            Einlagern
          </button>
          <button
            type="button"
            className={
              mode === "out"
                ? styles.activeOut
                : ""
            }
            onClick={() => setMode("out")}
          >
            Auslagern
          </button>
        </div>

        <form
          className={styles.scanForm}
          onSubmit={processBarcode}
        >
          <label>
            EAN / Barcode
            <input
              ref={inputRef}
              value={barcode}
              inputMode="numeric"
              autoComplete="off"
              onChange={(event) =>
                setBarcode(event.target.value)
              }
              placeholder="Barcode scannen oder eingeben"
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy
              ? "Wird verarbeitet …"
              : mode === "in"
                ? "Einlagern"
                : "Auslagern"}
          </button>
        </form>

        <div
          className={`${styles.message} ${
            error ? styles.messageError : ""
          }`}
        >
          {error || message}
        </div>
      </section>

      <section className={styles.recent}>
        <div className={styles.recentHead}>
          <h2>Letzte Scans</h2>
          <span>
            {logs.filter(
              (entry) => entry.source === "scan",
            ).length}
          </span>
        </div>

        <div className={styles.list}>
          {logs
            .filter(
              (entry) => entry.source === "scan",
            )
            .slice(0, 8)
            .map((entry) => (
              <div
                key={entry.id}
                className={styles.row}
              >
                <div>
                  <strong>{entry.filamentName}</strong>
                  <small>{entry.barcode}</small>
                </div>
                <div>
                  <b
                    className={
                      entry.action === "in"
                        ? styles.in
                        : styles.out
                    }
                  >
                    {entry.action === "in"
                      ? "Eingelagert"
                      : "Ausgelagert"}
                  </b>
                  <small>
                    Bestand {entry.stockAfter}
                  </small>
                </div>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}
