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

type ZxingResult = {
  getText: () => string;
};

type ZxingScannerControls = {
  stop: () => void;
  switchTorch?: (enabled: boolean) => Promise<void>;
};

type ZxingReader = {
  possibleFormats: unknown[];
  decodeFromConstraints: (
    constraints: MediaStreamConstraints,
    previewElement: HTMLVideoElement,
    callback: (
      result: ZxingResult | undefined,
      error: unknown,
      controls: ZxingScannerControls,
    ) => void,
  ) => Promise<ZxingScannerControls>;
};

type ZxingBrowserApi = {
  BrowserMultiFormatReader: new () => ZxingReader;
  BarcodeFormat: {
    EAN_13: unknown;
    EAN_8: unknown;
    UPC_A: unknown;
    UPC_E: unknown;
    CODE_128: unknown;
  };
};

type CameraTrackCapabilities =
  MediaTrackCapabilities & {
    torch?: boolean;
  };

let zxingLoaderPromise:
  | Promise<ZxingBrowserApi>
  | null = null;

function loadZxingBrowser(): Promise<ZxingBrowserApi> {
  const browserWindow = window as typeof window & {
    ZXingBrowser?: ZxingBrowserApi;
  };

  if (browserWindow.ZXingBrowser) {
    return Promise.resolve(
      browserWindow.ZXingBrowser,
    );
  }

  if (zxingLoaderPromise) {
    return zxingLoaderPromise;
  }

  zxingLoaderPromise = new Promise(
    (resolve, reject) => {
      const finishLoading = () => {
        if (browserWindow.ZXingBrowser) {
          resolve(browserWindow.ZXingBrowser);
          return;
        }

        zxingLoaderPromise = null;
        reject(
          new Error(
            "Der Safari-kompatible Barcode-Scanner konnte nicht geladen werden.",
          ),
        );
      };

      const failLoading = () => {
        zxingLoaderPromise = null;
        reject(
          new Error(
            "Der Barcode-Scanner konnte nicht geladen werden. Bitte prüfe die Internetverbindung und lade die Seite neu.",
          ),
        );
      };

      const existingScript =
        document.getElementById(
          "philamentix-zxing-browser",
        ) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener(
          "load",
          finishLoading,
          { once: true },
        );
        existingScript.addEventListener(
          "error",
          failLoading,
          { once: true },
        );
        return;
      }

      const script =
        document.createElement("script");

      script.id = "philamentix-zxing-browser";
      script.src =
        "/vendor/zxing-browser.min.js";
      script.async = true;
      script.addEventListener(
        "load",
        finishLoading,
        { once: true },
      );
      script.addEventListener(
        "error",
        failLoading,
        { once: true },
      );

      document.head.appendChild(script);
    },
  );

  return zxingLoaderPromise;
}

export default function StoragePage() {
  const router = useRouter();
  const { filaments, adjustStock, busy } = useHub();
  const [mode, setMode] = useState<StockMode>("in");
  const [barcode, setBarcode] = useState("");
  const [message, setMessage] =
    useState("Scanner bereit.");
  const [unknownBarcode, setUnknownBarcode] =
    useState("");
  const [cameraActive, setCameraActive] =
    useState(false);
  const [cameraMessage, setCameraMessage] =
    useState(
      "Kamera starten und den EAN-Code in den Rahmen halten.",
    );
  const [torchSupported, setTorchSupported] =
    useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef =
    useRef<ZxingScannerControls | null>(null);
  const cameraRunningRef = useRef(false);
  const scanLockedRef = useRef(false);

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
    const mobileCameraLayout = window.matchMedia(
      "(max-width: 900px) and (pointer: coarse)",
    ).matches;

    if (!mobileCameraLayout) {
      inputRef.current?.focus();
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      cameraRunningRef.current = false;
      scanLockedRef.current = false;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  function focusManualInput(shouldFocus: boolean) {
    if (shouldFocus) {
      inputRef.current?.focus();
    }
  }

  function stopCamera() {
    cameraRunningRef.current = false;
    scanLockedRef.current = false;
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setTorchSupported(false);
    setTorchOn(false);
  }

  async function startCamera() {
    setCameraMessage(
      "Safari-kompatibler Scanner wird geladen …",
    );
    setUnknownBarcode("");
    inputRef.current?.blur();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage(
        "Dieser Browser erlaubt hier keinen Kamerazugriff. Nutze bitte die manuelle Eingabe.",
      );
      return;
    }

    stopCamera();

    try {
      const zxing = await loadZxingBrowser();
      const video = videoRef.current;

      if (!video) {
        throw new Error(
          "Die Kameraansicht konnte nicht geladen werden.",
        );
      }

      const reader =
        new zxing.BrowserMultiFormatReader();

      reader.possibleFormats = [
        zxing.BarcodeFormat.EAN_13,
        zxing.BarcodeFormat.EAN_8,
        zxing.BarcodeFormat.UPC_A,
        zxing.BarcodeFormat.UPC_E,
        zxing.BarcodeFormat.CODE_128,
      ];

      cameraRunningRef.current = true;
      scanLockedRef.current = false;

      const controls =
        await reader.decodeFromConstraints(
          {
            video: {
              facingMode: {
                ideal: "environment",
              },
              width: {
                ideal: 1920,
              },
              height: {
                ideal: 1080,
              },
            },
            audio: false,
          },
          video,
          (
            result,
            _error,
            activeControls,
          ) => {
            if (
              !cameraRunningRef.current ||
              scanLockedRef.current ||
              !result
            ) {
              return;
            }

            const cleanedBarcode =
              normalizeBarcode(
                result.getText(),
              );

            if (cleanedBarcode.length < 8) {
              return;
            }

            scanLockedRef.current = true;
            cameraRunningRef.current = false;

            activeControls.stop();
            scannerControlsRef.current = null;

            if (videoRef.current) {
              videoRef.current.srcObject = null;
            }

            setCameraActive(false);
            setTorchSupported(false);
            setTorchOn(false);
            setCameraMessage(
              `Barcode ${cleanedBarcode} erkannt.`,
            );

            void processBarcode(
              cleanedBarcode,
              false,
            );
          },
        );

      if (!cameraRunningRef.current) {
        controls.stop();
        return;
      }

      scannerControlsRef.current = controls;
      setCameraActive(true);
      setCameraMessage(
        "EAN-Code ruhig und gut beleuchtet in den Rahmen halten.",
      );

      const stream =
        video.srcObject instanceof MediaStream
          ? video.srcObject
          : null;
      const videoTrack =
        stream?.getVideoTracks()[0];
      const capabilities =
        videoTrack?.getCapabilities() as
          | CameraTrackCapabilities
          | undefined;

      setTorchSupported(
        Boolean(
          capabilities?.torch &&
            controls.switchTorch,
        ),
      );
    } catch (caughtError) {
      stopCamera();

      const errorName =
        caughtError instanceof DOMException
          ? caughtError.name
          : "";

      if (
        errorName === "NotAllowedError" ||
        errorName === "PermissionDeniedError"
      ) {
        setCameraMessage(
          "Kamerazugriff wurde abgelehnt. Erlaube die Kamera unter Einstellungen → Safari → Kamera und lade die Seite neu.",
        );
        return;
      }

      if (errorName === "NotReadableError") {
        setCameraMessage(
          "Die Kamera wird bereits von einer anderen App verwendet. Schließe die andere App und versuche es erneut.",
        );
        return;
      }

      setCameraMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Die Kamera konnte nicht gestartet werden.",
      );
    }
  }

  async function toggleTorch() {
    const controls =
      scannerControlsRef.current;

    if (
      !controls?.switchTorch ||
      !torchSupported
    ) {
      return;
    }

    const nextTorchState = !torchOn;

    try {
      await controls.switchTorch(
        nextTorchState,
      );
      setTorchOn(nextTorchState);
    } catch {
      setCameraMessage(
        "Die Taschenlampe wird von Safari auf diesem Gerät nicht freigegeben.",
      );
    }
  }

  async function processBarcode(
    barcodeValue = barcode,
    shouldFocusInput = true,
  ) {
    const scannedBarcode =
      normalizeBarcode(barcodeValue);

    if (!scannedBarcode || busy) {
      if (!scannedBarcode) {
        setMessage("Bitte einen Barcode scannen.");
      }
      focusManualInput(shouldFocusInput);
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
      focusManualInput(shouldFocusInput);
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
      focusManualInput(shouldFocusInput);
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
      focusManualInput(shouldFocusInput);
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
          onClick={(event) => {
            const target = event.target as HTMLElement;
            const interactiveTarget = target.closest(
              "button, a, input, video",
            );
            const mobileCameraLayout =
              window.matchMedia(
                "(max-width: 900px) and (pointer: coarse)",
              ).matches;

            if (!interactiveTarget && !mobileCameraLayout) {
              inputRef.current?.focus();
            }
          }}
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

          <div
            className={styles.mobileCameraOnly}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.mobileCameraHeading}>
              <div>
                <span>Nur auf dem Handy</span>
                <h3>Kamera-Scanner</h3>
              </div>

              <span
                className={`${styles.cameraState} ${
                  cameraActive
                    ? styles.cameraStateActive
                    : ""
                }`}
              >
                {cameraActive ? "AKTIV" : "BEREIT"}
              </span>
            </div>

            <div
              className={`${styles.cameraViewport} ${
                cameraActive
                  ? styles.cameraViewportActive
                  : ""
              }`}
            >
              <video
                ref={videoRef}
                className={styles.cameraVideo}
                muted
                playsInline
                aria-label="Kamera für Barcode-Erkennung"
              />

              {!cameraActive && (
                <div className={styles.cameraPlaceholder}>
                  <span>▣</span>
                  <p>
                    Die Rückkamera wird erst nach dem
                    Antippen gestartet.
                  </p>
                </div>
              )}

              {cameraActive && (
                <>
                  <div
                    className={styles.cameraScanFrame}
                    aria-hidden="true"
                  />
                  <div
                    className={styles.cameraScanLine}
                    aria-hidden="true"
                  />
                </>
              )}
            </div>

            <p className={styles.cameraMessage}>
              {cameraMessage}
            </p>

            <div className={styles.cameraActions}>
              {!cameraActive ? (
                <button
                  type="button"
                  className={styles.cameraStartButton}
                  onClick={() => void startCamera()}
                >
                  Kamera starten
                </button>
              ) : (
                <>
                  {torchSupported && (
                    <button
                      type="button"
                      className={styles.cameraSecondaryButton}
                      onClick={() => void toggleTorch()}
                    >
                      {torchOn
                        ? "Licht ausschalten"
                        : "Licht einschalten"}
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.cameraStopButton}
                    onClick={() => {
                      stopCamera();
                      setCameraMessage(
                        "Kamera geschlossen. Du kannst sie erneut starten oder den Barcode manuell eingeben.",
                      );
                    }}
                  >
                    Kamera schließen
                  </button>
                </>
              )}
            </div>

            <div className={styles.manualDivider}>
              <span>oder manuell scannen</span>
            </div>
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
            inputMode="numeric"
            autoComplete="off"
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
