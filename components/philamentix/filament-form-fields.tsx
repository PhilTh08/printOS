"use client";

import { useState } from "react";

import type { FilamentForm } from "./types";

const BAMBU_PLA_BASIC_URL =
  "https://eu.store.bambulab.com/de/products/pla-basic-filament";

type ProductImageResponse = {
  imageUrl?: string;
  error?: string;
};

export function FilamentFormFields({
  value,
  onChange,
}: {
  value: FilamentForm;
  onChange: (next: FilamentForm) => void;
}) {
  const [imageLoading, setImageLoading] =
    useState(false);
  const [imageMessage, setImageMessage] =
    useState("");
  const [imageError, setImageError] =
    useState("");

  function setField<K extends keyof FilamentForm>(
    key: K,
    fieldValue: FilamentForm[K],
  ) {
    onChange({
      ...value,
      [key]: fieldValue,
    });
  }

  async function loadProductImage(
    productUrl = value.orderLink,
  ) {
    const cleanedUrl = productUrl.trim();

    setImageMessage("");
    setImageError("");

    if (!cleanedUrl) {
      setImageError(
        "Trage zuerst einen Bestell- oder Produktlink ein.",
      );
      return;
    }

    setImageLoading(true);

    try {
      const response = await fetch(
        `/api/product-image?url=${encodeURIComponent(
          cleanedUrl,
        )}`,
      );
      const result =
        (await response.json()) as ProductImageResponse;

      if (!response.ok || !result.imageUrl) {
        throw new Error(
          result.error ??
            "Auf der Produktseite wurde kein Bild gefunden.",
        );
      }

      onChange({
        ...value,
        orderLink: cleanedUrl,
        imageUrl: result.imageUrl,
      });
      setImageMessage(
        "Produktbild wurde übernommen.",
      );
    } catch (caughtError) {
      setImageError(
        caughtError instanceof Error
          ? caughtError.message
          : "Produktbild konnte nicht geladen werden.",
      );
    } finally {
      setImageLoading(false);
    }
  }

  async function useBambuPlaBasic() {
    onChange({
      ...value,
      manufacturer:
        value.manufacturer || "Bambu Lab",
      material: value.material || "PLA Basic",
      orderLink: BAMBU_PLA_BASIC_URL,
    });

    await loadProductImage(
      BAMBU_PLA_BASIC_URL,
    );
  }

  return (
    <div className="detail-form-grid">
      <label>
        Barcode *
        <input
          value={value.barcode}
          inputMode="numeric"
          onChange={(event) =>
            setField("barcode", event.target.value)
          }
          placeholder="6975337038207"
        />
      </label>

      <label>
        Hersteller *
        <input
          value={value.manufacturer}
          onChange={(event) =>
            setField(
              "manufacturer",
              event.target.value,
            )
          }
          placeholder="Bambu Lab"
        />
      </label>

      <label>
        Material *
        <input
          value={value.material}
          onChange={(event) =>
            setField("material", event.target.value)
          }
          placeholder="PLA, PETG, ASA …"
        />
      </label>

      <label>
        Farbe *
        <input
          value={value.color}
          onChange={(event) =>
            setField("color", event.target.value)
          }
          placeholder="Schwarz"
        />
      </label>

      <label>
        Gewicht pro Rolle (g)
        <input
          type="number"
          min="1"
          value={value.weightPerRoll}
          onChange={(event) =>
            setField(
              "weightPerRoll",
              Number(event.target.value) || 1,
            )
          }
        />
      </label>

      <label>
        Lagerort
        <input
          value={value.location}
          onChange={(event) =>
            setField("location", event.target.value)
          }
          placeholder="Regal A2"
        />
      </label>

      <label>
        Mindestbestand
        <input
          type="number"
          min="0"
          value={value.minimumStock}
          onChange={(event) =>
            setField(
              "minimumStock",
              Number(event.target.value) || 0,
            )
          }
        />
      </label>

      <label>
        Aktueller Bestand
        <input
          type="number"
          min="0"
          value={value.stock}
          onChange={(event) =>
            setField(
              "stock",
              Number(event.target.value) || 0,
            )
          }
        />
      </label>

      <div className="full-width filament-image-editor">
        <div className="filament-image-editor-heading">
          <div>
            <strong>Filamentbild</strong>
            <span>
              Bild-URL eintragen oder automatisch aus
              dem Produktlink übernehmen.
            </span>
          </div>

          <button
            className="bambu-image-button"
            type="button"
            disabled={imageLoading}
            onClick={() =>
              void useBambuPlaBasic()
            }
          >
            Bambu PLA Basic verwenden
          </button>
        </div>

        <div className="filament-image-editor-grid">
          <div className="filament-image-preview">
            {value.imageUrl ? (
              <img
                src={value.imageUrl}
                alt={`${value.manufacturer || "Filament"} ${
                  value.material
                } ${value.color}`}
              />
            ) : (
              <div>
                <span>▤</span>
                <p>Noch kein Bild hinterlegt</p>
              </div>
            )}
          </div>

          <div className="filament-image-fields">
            <label>
              Bestell- oder Produktlink
              <input
                type="url"
                value={value.orderLink}
                onChange={(event) =>
                  setField(
                    "orderLink",
                    event.target.value,
                  )
                }
                placeholder="https://eu.store.bambulab.com/..."
              />
            </label>

            <button
              className="product-image-fetch-button"
              type="button"
              disabled={
                imageLoading ||
                !value.orderLink.trim()
              }
              onClick={() =>
                void loadProductImage()
              }
            >
              {imageLoading
                ? "Bild wird gesucht …"
                : "Bild aus Produktlink übernehmen"}
            </button>

            <label>
              Direkte Bild-URL
              <input
                type="url"
                value={value.imageUrl}
                onChange={(event) =>
                  setField(
                    "imageUrl",
                    event.target.value,
                  )
                }
                placeholder="https://.../filament.webp"
              />
            </label>

            {(imageMessage || imageError) && (
              <p
                className={
                  imageError
                    ? "filament-image-message error"
                    : "filament-image-message success"
                }
              >
                {imageError || imageMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
