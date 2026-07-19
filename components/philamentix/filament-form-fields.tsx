"use client";

import type { FilamentForm } from "./types";

export function FilamentFormFields({
  value,
  onChange,
}: {
  value: FilamentForm;
  onChange: (next: FilamentForm) => void;
}) {
  function setField<K extends keyof FilamentForm>(
    key: K,
    fieldValue: FilamentForm[K],
  ) {
    onChange({
      ...value,
      [key]: fieldValue,
    });
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

      <label className="full-width">
        Bestelllink
        <input
          type="url"
          value={value.orderLink}
          onChange={(event) =>
            setField("orderLink", event.target.value)
          }
          placeholder="https://..."
        />
      </label>
    </div>
  );
}
