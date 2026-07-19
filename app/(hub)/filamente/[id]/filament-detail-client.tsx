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
import { PageHeader } from "@/components/philamentix/page-header";

import styles from "./page.module.css";

export function FilamentDetailClient({
  filamentId,
}: {
  filamentId: number;
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (filament) {
      setForm(filamentToForm(filament));
    }
  }, [filament]);

  async function handleSave(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await updateFilament(filamentId, form);
      setMessage("Änderungen gespeichert.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Änderungen konnten nicht gespeichert werden.",
      );
    }
  }

  async function handleStock(
    mode: "in" | "out",
  ) {
    setError("");
    setMessage("");

    try {
      const updated = await adjustStock(
        filamentId,
        mode,
        "manual",
      );
      setMessage(
        `Bestand ist jetzt ${updated.stock}.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Bestand konnte nicht geändert werden.",
      );
    }
  }

  async function handleDelete() {
    if (!filament) {
      return;
    }

    const confirmed = window.confirm(
      `${filament.manufacturer} ${filament.material} ${filament.color} wirklich löschen?`,
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
    return <div className={styles.state}>Lädt …</div>;
  }

  if (!filament) {
    return (
      <div className={styles.state}>
        <h1>Filament nicht gefunden</h1>
        <p>
          Die ID gehört nicht zu deinem Account oder
          wurde gelöscht.
        </p>
        <Link href="/filamente">
          Zurück zu Filamente
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={`Filament-ID ${filament.id}`}
        title={`${filament.material} · ${filament.color}`}
        description={`${filament.manufacturer} · EAN ${filament.barcode}`}
        actions={
          <Link
            className={styles.backLink}
            href="/filamente"
          >
            Zur Übersicht
          </Link>
        }
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

      <section className={styles.stockPanel}>
        <div>
          <span>Aktueller Bestand</span>
          <strong>{filament.stock}</strong>
          <small>
            Mindestbestand {filament.minimumStock}
          </small>
        </div>

        <div className={styles.stockActions}>
          <button
            type="button"
            className={styles.outButton}
            disabled={busy || filament.stock <= 0}
            onClick={() => void handleStock("out")}
          >
            − 1 auslagern
          </button>
          <button
            type="button"
            className={styles.inButton}
            disabled={busy}
            onClick={() => void handleStock("in")}
          >
            + 1 einlagern
          </button>
        </div>
      </section>

      <form
        className={styles.formPanel}
        onSubmit={handleSave}
      >
        <h2>Filament bearbeiten</h2>

        <FilamentFormFields
          value={form}
          onChange={setForm}
        />

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.deleteButton}
            disabled={busy}
            onClick={() => void handleDelete()}
          >
            Filament löschen
          </button>

          <button
            type="submit"
            className={styles.saveButton}
            disabled={busy}
          >
            {busy
              ? "Wird gespeichert …"
              : "Änderungen speichern"}
          </button>
        </div>
      </form>
    </>
  );
}
