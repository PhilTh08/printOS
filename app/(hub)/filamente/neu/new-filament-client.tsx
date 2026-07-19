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
import { PageHeader } from "@/components/philamentix/page-header";

import styles from "./page.module.css";

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

  async function handleSubmit(
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
      <PageHeader
        eyebrow="Neuer Datensatz"
        title="Filament hinzufügen"
        description={
          fromScanner
            ? "Die gescannte EAN ist bereits eingetragen. Ergänze nur noch die Filamentdaten."
            : "Dieses Filament wird ausschließlich deinem Account zugeordnet."
        }
      />

      <form
        className={styles.panel}
        onSubmit={handleSubmit}
      >
        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <FilamentFormFields
          value={form}
          onChange={setForm}
        />

        <div className={styles.actions}>
          <Link href="/filamente">Abbrechen</Link>
          <button type="submit" disabled={busy}>
            {busy
              ? "Wird gespeichert …"
              : "Filament speichern"}
          </button>
        </div>
      </form>
    </>
  );
}
