"use client";

import { useMemo, useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import { PageHeader } from "@/components/philamentix/page-header";

import styles from "./page.module.css";

type Range = "7" | "30" | "90" | "all";

export default function StatisticsPage() {
  const { filaments, logs } = useHub();
  const [range, setRange] = useState<Range>("30");

  const filteredLogs = useMemo(() => {
    if (range === "all") {
      return logs;
    }

    const threshold =
      Date.now() -
      Number(range) * 24 * 60 * 60 * 1000;

    return logs.filter(
      (entry) =>
        new Date(entry.timestamp).getTime() >=
        threshold,
    );
  }, [logs, range]);

  const incoming = filteredLogs.filter(
    (entry) => entry.action === "in",
  ).length;
  const outgoing = filteredLogs.filter(
    (entry) => entry.action === "out",
  ).length;
  const currentRolls = filaments.reduce(
    (sum, item) => sum + item.stock,
    0,
  );

  const materialUsage = useMemo(() => {
    const result = new Map<string, number>();

    for (const entry of filteredLogs) {
      if (entry.action !== "out") {
        continue;
      }

      const filament = filaments.find(
        (item) => item.barcode === entry.barcode,
      );
      const material =
        filament?.material ?? "Unbekannt";

      result.set(
        material,
        (result.get(material) ?? 0) + 1,
      );
    }

    return [...result.entries()].sort(
      (a, b) => b[1] - a[1],
    );
  }, [filteredLogs, filaments]);

  const maxUsage = Math.max(
    1,
    ...materialUsage.map(([, count]) => count),
  );

  return (
    <>
      <PageHeader
        eyebrow="Auswertung"
        title="Statistiken"
        description="Die Statistik wird ausschließlich aus deinem persönlichen Protokoll berechnet."
        actions={
          <select
            className={styles.range}
            value={range}
            onChange={(event) =>
              setRange(event.target.value as Range)
            }
          >
            <option value="7">Letzte 7 Tage</option>
            <option value="30">Letzte 30 Tage</option>
            <option value="90">Letzte 90 Tage</option>
            <option value="all">Gesamter Zeitraum</option>
          </select>
        }
      />

      <section className={styles.metrics}>
        <article>
          <span>Eingelagert</span>
          <strong>{incoming}</strong>
        </article>
        <article>
          <span>Ausgelagert</span>
          <strong>{outgoing}</strong>
        </article>
        <article>
          <span>Bilanz</span>
          <strong>{incoming - outgoing}</strong>
        </article>
        <article>
          <span>Aktueller Bestand</span>
          <strong>{currentRolls}</strong>
        </article>
      </section>

      <section className={styles.panel}>
        <h2>Verbrauch nach Material</h2>

        <div className={styles.bars}>
          {materialUsage.length === 0 ? (
            <p>
              Im gewählten Zeitraum wurden noch keine
              Rollen ausgelagert.
            </p>
          ) : (
            materialUsage.map(([material, count]) => (
              <div
                key={material}
                className={styles.barRow}
              >
                <div>
                  <strong>{material}</strong>
                  <span>{count} Auslagerungen</span>
                </div>
                <div className={styles.track}>
                  <span
                    style={{
                      width: `${Math.max(
                        8,
                        (count / maxUsage) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
