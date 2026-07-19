"use client";

import { useMemo, useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import { PageHeader } from "@/components/philamentix/page-header";

import styles from "./page.module.css";

export default function ProtocolPage() {
  const { logs } = useHub();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return logs;
    }

    return logs.filter((entry) =>
      [
        entry.filamentName,
        entry.barcode,
        entry.action,
        entry.source,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [logs, search]);

  return (
    <>
      <PageHeader
        eyebrow="Historie"
        title="Protokoll"
        description="Alle Ein- und Auslagerungen deines Accounts."
      />

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Filament, EAN oder Quelle suchen"
          />
          <span>{filtered.length} Einträge</span>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Zeitpunkt</th>
                <th>Filament</th>
                <th>Aktion</th>
                <th>Quelle</th>
                <th>Bestand danach</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {new Date(
                      entry.timestamp,
                    ).toLocaleString("de-DE")}
                  </td>
                  <td>
                    <strong>
                      {entry.filamentName}
                    </strong>
                    <small>{entry.barcode}</small>
                  </td>
                  <td>
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
                  </td>
                  <td>
                    {entry.source === "scan"
                      ? "Scanner"
                      : "Manuell"}
                  </td>
                  <td>{entry.stockAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className={styles.empty}>
            Keine Protokolleinträge gefunden.
          </div>
        )}
      </section>
    </>
  );
}
