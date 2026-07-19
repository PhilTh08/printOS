"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";

import styles from "./page.module.css";

export default function FilamentsPage() {
  const {
    filaments,
    adjustStock,
    deleteFilament,
    busy,
  } = useHub();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<
    number | null
  >(null);
  const [deleteError, setDeleteError] = useState("");

  const filteredFilaments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return filaments;
    }

    return filaments.filter((filament) =>
      [
        filament.id,
        filament.barcode,
        filament.manufacturer,
        filament.material,
        filament.color,
        filament.location,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [filaments, search]);

  async function handleDelete(
    filamentId: number,
    filamentName: string,
  ) {
    const confirmed = window.confirm(
      `${filamentName} wirklich löschen? Der persönliche Lagerbestand dieses Filaments wird entfernt.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(filamentId);
    setDeleteError("");

    try {
      await deleteFilament(filamentId);
    } catch (caughtError) {
      setDeleteError(
        caughtError instanceof Error
          ? caughtError.message
          : "Filament konnte nicht gelöscht werden.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <h1>Filamenttypen</h1>
          <p>
            Barcodes und zugehörige Filamente verwalten
          </p>
        </div>

        <Link
          className="primary-button"
          href="/filamente/neu"
        >
          + Filament hinzufügen
        </Link>
      </header>

      <div className="filament-toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Filament, Barcode oder ID suchen …"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />
      </div>

      {deleteError && (
        <div className="error-message">
          {deleteError}
        </div>
      )}

      <section className="filament-grid">
        {filteredFilaments.length === 0 ? (
          <div className="empty-state">
            Keine Filamente gefunden.
          </div>
        ) : (
          filteredFilaments.map((filament) => (
            <article
              className={`filament-card ${
                filament.stock <= filament.minimumStock
                  ? "low-stock"
                  : ""
              }`}
              key={filament.id}
            >
              <div
                className={`filament-card-image ${
                  filament.imageUrl
                    ? "has-image"
                    : ""
                }`}
              >
                {filament.imageUrl ? (
                  <img
                    src={filament.imageUrl}
                    alt={`${filament.manufacturer} ${filament.material} ${filament.color}`}
                    loading="lazy"
                  />
                ) : (
                  <div>
                    <span>▤</span>
                    <small>Kein Bild</small>
                  </div>
                )}
              </div>

              <div className="filament-card-header">
                <div>
                  <span className="filament-id-badge">
                    ID {filament.id}
                  </span>
                  <h2>
                    {filament.material} {filament.color}
                  </h2>
                  <p>{filament.manufacturer}</p>
                </div>
                <strong>{filament.stock}</strong>
              </div>

              <dl className="filament-details">
                <div>
                  <dt>Barcode</dt>
                  <dd>{filament.barcode}</dd>
                </div>
                <div>
                  <dt>Gewicht</dt>
                  <dd>{filament.weightPerRoll} g</dd>
                </div>
                <div>
                  <dt>Lagerort</dt>
                  <dd>{filament.location || "–"}</dd>
                </div>
                <div>
                  <dt>Mindestbestand</dt>
                  <dd>{filament.minimumStock} Rollen</dd>
                </div>
              </dl>

              <div className="filament-actions">
                <button
                  className="stock-button add"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void adjustStock(
                      filament.id,
                      "in",
                      "manual",
                    )
                  }
                >
                  + Rolle
                </button>

                <button
                  className="stock-button remove"
                  type="button"
                  disabled={busy || filament.stock === 0}
                  onClick={() =>
                    void adjustStock(
                      filament.id,
                      "out",
                      "manual",
                    )
                  }
                >
                  − Rolle
                </button>

                {filament.orderLink && (
                  <button
                    className="order-button"
                    type="button"
                    onClick={() =>
                      window.open(
                        filament.orderLink,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    Nachbestellen
                  </button>
                )}

                <Link
                  className="secondary-button"
                  href={`/filamente/${filament.id}`}
                >
                  Details & Bearbeiten
                </Link>

                <button
                  className="delete-button"
                  type="button"
                  disabled={
                    busy || deletingId === filament.id
                  }
                  onClick={() =>
                    void handleDelete(
                      filament.id,
                      `${filament.manufacturer} ${filament.material} ${filament.color}`,
                    )
                  }
                >
                  {deletingId === filament.id
                    ? "Wird gelöscht …"
                    : "Löschen"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
