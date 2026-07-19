"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FilamentFormFields } from "@/components/philamentix/filament-form-fields";
import { useHub } from "@/components/philamentix/hub-provider";
import { filamentToForm } from "@/components/philamentix/mappers";
import { emptyFilamentForm } from "@/components/philamentix/types";

export function FilamentDetailClient({
  filamentId,
  wasCreated = false,
}: {
  filamentId: number;
  wasCreated?: boolean;
}) {
  const router = useRouter();
  const {
    filaments,
    loading,
    busy,
    updateFilament,
    deleteFilament,
    adjustStock,
  } = useHub();
  const filament = filaments.find(
    (item) => item.id === filamentId,
  );
  const [form, setForm] = useState(
    filament
      ? filamentToForm(filament)
      : emptyFilamentForm,
  );
  const [message, setMessage] = useState(
    wasCreated
      ? "Filament wurde erfolgreich hinzugefügt."
      : "",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (filament) {
      setForm(filamentToForm(filament));
    }
  }, [filament]);

  async function save(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      await updateFilament(filamentId, form);
      setMessage("Änderungen wurden gespeichert.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Änderungen konnten nicht gespeichert werden.",
      );
    }
  }

  async function changeStock(mode: "in" | "out") {
    setMessage("");
    setError("");

    try {
      const updated = await adjustStock(
        filamentId,
        mode,
        "manual",
      );
      setMessage(`Bestand ist jetzt ${updated.stock}.`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Bestand konnte nicht geändert werden.",
      );
    }
  }

  async function remove() {
    if (!filament) {
      return;
    }

    const confirmed = window.confirm(
      `${filament.material} ${filament.color} wirklich löschen?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteFilament(filament.id);
      router.replace("/filamente");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Filament konnte nicht gelöscht werden.",
      );
    }
  }

  if (loading && !filament) {
    return <div className="route-loading">Lädt …</div>;
  }

  if (!filament) {
    return (
      <div className="route-empty">
        <h1>Filament nicht gefunden</h1>
        <p>
          Diese ID gehört nicht zu deinem Account oder wurde gelöscht.
        </p>
        <Link className="primary-button" href="/filamente">
          Zur Filamentübersicht
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <span className="welcome-label">
            Filament-ID {filament.id}
          </span>
          <h1>
            {filament.material} {filament.color}
          </h1>
          <p>
            {filament.manufacturer} · Barcode {filament.barcode}
          </p>
        </div>

        <Link className="secondary-button" href="/filamente">
          ← Zur Übersicht
        </Link>
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

      <section className="detail-page-grid">
        <article className="panel detail-form-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Filament bearbeiten</h2>
              <p>
                Eigenschaften dieses persönlichen Datensatzes
              </p>
            </div>
            <span className="filament-id-badge">
              ID {filament.id}
            </span>
          </div>

          <form onSubmit={save}>
            <FilamentFormFields
              value={form}
              onChange={setForm}
            />

            <div className="detail-form-actions">
              <button
                className="delete-button"
                type="button"
                disabled={busy}
                onClick={() => void remove()}
              >
                Filament löschen
              </button>

              <button
                className="primary-button"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Wird gespeichert …"
                  : "Änderungen speichern"}
              </button>
            </div>
          </form>
        </article>

        <aside className="panel detail-stock-panel">
          <div
            className={`detail-filament-image ${
              filament.imageUrl
                ? "has-image"
                : ""
            }`}
          >
            {filament.imageUrl ? (
              <img
                src={filament.imageUrl}
                alt={`${filament.manufacturer} ${filament.material} ${filament.color}`}
              />
            ) : (
              <div>
                <span>▤</span>
                <p>Kein Filamentbild hinterlegt</p>
              </div>
            )}
          </div>

          <div className="detail-stock-value">
            <span>Aktueller Bestand</span>
            <strong>{filament.stock}</strong>
            <small>
              Mindestbestand {filament.minimumStock}
            </small>
          </div>

          <div className="detail-stock-actions">
            <button
              className="stock-button remove"
              type="button"
              disabled={busy || filament.stock <= 0}
              onClick={() => void changeStock("out")}
            >
              − Rolle
            </button>
            <button
              className="stock-button add"
              type="button"
              disabled={busy}
              onClick={() => void changeStock("in")}
            >
              + Rolle
            </button>
          </div>

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
              Filament nachbestellen
            </button>
          )}
        </aside>
      </section>
    </>
  );
}
