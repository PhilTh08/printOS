"use client";

import {
  FormEvent,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FilamentFormFields } from "@/components/philamentix/filament-form-fields";
import { useHub } from "@/components/philamentix/hub-provider";
import {
  emptyFilamentForm,
  normalizeBarcode,
} from "@/components/philamentix/types";

export function NewFilamentClient({
  initialBarcode,
  initialStock,
  fromScanner,
}: {
  initialBarcode: string;
  initialStock: number;
  fromScanner: boolean;
}) {
  const router = useRouter();
  const { createFilament, busy } = useHub();
  const [form, setForm] = useState({
    ...emptyFilamentForm,
    barcode: normalizeBarcode(initialBarcode),
    stock: initialStock,
  });
  const [error, setError] = useState("");

  async function save(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    try {
      const created = await createFilament(
        form,
        fromScanner ? "scan" : "manual",
      );
      router.replace(`/filamente/${created.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Filament konnte nicht gespeichert werden.",
      );
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <span className="welcome-label">
            Persönlicher Datensatz
          </span>
          <h1>Filament hinzufügen</h1>
          <p>
            {fromScanner
              ? "Die gescannte EAN ist bereits eingetragen. Ergänze die Filamentdaten."
              : "Dieses Filament wird ausschließlich deinem Account zugeordnet."}
          </p>
        </div>

        <Link className="secondary-button" href="/filamente">
          ← Abbrechen
        </Link>
      </header>

      {error && (
        <div className="page-feedback error">{error}</div>
      )}

      <article className="panel detail-form-panel">
        <form onSubmit={save}>
          <FilamentFormFields
            value={form}
            onChange={setForm}
          />

          <div className="detail-form-actions">
            <Link
              className="secondary-button"
              href="/filamente"
            >
              Abbrechen
            </Link>
            <button
              className="primary-button"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Wird gespeichert …"
                : "Filament speichern"}
            </button>
          </div>
        </form>
      </article>
    </>
  );
}
