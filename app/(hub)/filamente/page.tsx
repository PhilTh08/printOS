"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import { PageHeader } from "@/components/philamentix/page-header";

import styles from "./page.module.css";

export default function FilamentsPage() {
  const { filaments, loading } = useHub();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
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

  return (
    <>
      <PageHeader
        eyebrow="Persönlicher Bestand"
        title="Filamente"
        description="Jedes Filament hat eine eigene URL und kann unabhängig bearbeitet werden."
        actions={
          <Link
            className={styles.primaryLink}
            href="/filamente/neu"
          >
            Filament hinzufügen
          </Link>
        }
      />

      <section className={styles.toolbar}>
        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="EAN, Hersteller, Material, Farbe, Lagerplatz oder ID suchen"
        />
        <span>
          {loading ? "Lädt …" : `${filtered.length} Einträge`}
        </span>
      </section>

      <section className={styles.grid}>
        {filtered.map((filament) => {
          const critical =
            filament.stock <= filament.minimumStock;

          return (
            <Link
              key={filament.id}
              href={`/filamente/${filament.id}`}
              className={styles.card}
            >
              <div className={styles.cardHead}>
                <span>ID {filament.id}</span>
                <b
                  className={
                    critical
                      ? styles.critical
                      : styles.ok
                  }
                >
                  {critical ? "Kritisch" : "OK"}
                </b>
              </div>

              <h2>
                {filament.material} · {filament.color}
              </h2>
              <p>{filament.manufacturer}</p>

              <dl>
                <div>
                  <dt>Bestand</dt>
                  <dd>{filament.stock}</dd>
                </div>
                <div>
                  <dt>Mindestbestand</dt>
                  <dd>{filament.minimumStock}</dd>
                </div>
                <div>
                  <dt>Lagerplatz</dt>
                  <dd>{filament.location || "—"}</dd>
                </div>
              </dl>

              <footer>
                <span>{filament.barcode}</span>
                <strong>Öffnen →</strong>
              </footer>
            </Link>
          );
        })}
      </section>

      {!loading && filtered.length === 0 && (
        <div className={styles.empty}>
          Keine passenden Filamente gefunden.
        </div>
      )}
    </>
  );
}
