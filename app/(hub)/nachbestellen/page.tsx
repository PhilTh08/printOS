"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import type { Filament } from "@/components/philamentix/types";

import styles from "./page.module.css";

type ReorderFilter =
  | "all"
  | "empty"
  | "below"
  | "equal";

function recommendedOrderAmount(
  filament: Filament,
): number {
  const missingToMinimum = Math.max(
    0,
    filament.minimumStock - filament.stock,
  );

  return Math.max(1, missingToMinimum);
}

function getStockState(filament: Filament) {
  if (filament.stock === 0) {
    return {
      label: "Leer",
      className: styles.statusEmpty,
    };
  }

  if (filament.stock < filament.minimumStock) {
    return {
      label: "Kritisch",
      className: styles.statusCritical,
    };
  }

  return {
    label: "Mindestbestand erreicht",
    className: styles.statusWarning,
  };
}

export default function ReorderPage() {
  const { filaments } = useHub();
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<ReorderFilter>("all");
  const [openedOrderId, setOpenedOrderId] =
    useState<number | null>(null);
  const [orderQuantities, setOrderQuantities] =
    useState<Record<number, number>>({});

  const reorderFilaments = useMemo(
    () =>
      filaments
        .filter(
          (filament) =>
            filament.stock <=
            filament.minimumStock,
        )
        .sort((first, second) => {
          const firstDifference =
            first.stock - first.minimumStock;
          const secondDifference =
            second.stock - second.minimumStock;

          if (
            firstDifference !== secondDifference
          ) {
            return (
              firstDifference - secondDifference
            );
          }

          return `${first.manufacturer} ${first.material} ${first.color}`.localeCompare(
            `${second.manufacturer} ${second.material} ${second.color}`,
            "de",
          );
        }),
    [filaments],
  );

  const filteredFilaments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reorderFilaments.filter(
      (filament) => {
        const matchesSearch =
          !query ||
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
            .includes(query);

        const matchesFilter =
          filter === "all" ||
          (filter === "empty" &&
            filament.stock === 0) ||
          (filter === "below" &&
            filament.stock <
              filament.minimumStock) ||
          (filter === "equal" &&
            filament.stock ===
              filament.minimumStock);

        return matchesSearch && matchesFilter;
      },
    );
  }, [filter, reorderFilaments, search]);

  const emptyCount = reorderFilaments.filter(
    (filament) => filament.stock === 0,
  ).length;
  const belowMinimumCount =
    reorderFilaments.filter(
      (filament) =>
        filament.stock <
        filament.minimumStock,
    ).length;
  const warningCount =
    reorderFilaments.filter(
      (filament) =>
        filament.stock ===
        filament.minimumStock,
    ).length;
  function selectedOrderAmount(
    filament: Filament,
  ): number {
    return (
      orderQuantities[filament.id] ??
      recommendedOrderAmount(filament)
    );
  }

  function changeOrderAmount(
    filament: Filament,
    change: number,
  ) {
    setOrderQuantities((current) => {
      const currentAmount =
        current[filament.id] ??
        recommendedOrderAmount(filament);
      const nextAmount = Math.min(
        99,
        Math.max(1, currentAmount + change),
      );

      return {
        ...current,
        [filament.id]: nextAmount,
      };
    });
  }

  const suggestedRolls = reorderFilaments.reduce(
    (sum, filament) =>
      sum + selectedOrderAmount(filament),
    0,
  );
  const withOrderLink = reorderFilaments.filter(
    (filament) =>
      filament.orderLink.trim().length > 0,
  ).length;

  function openOrderLink(filament: Filament) {
    setOpenedOrderId(filament.id);

    window.open(
      filament.orderLink,
      "_blank",
      "noopener,noreferrer",
    );

    window.setTimeout(() => {
      setOpenedOrderId((currentId) =>
        currentId === filament.id
          ? null
          : currentId,
      );
    }, 1800);
  }

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <span className={styles.eyebrow}>
            Mindestbestand
          </span>
          <h1>Nachbestellliste</h1>
          <p>
            Filamente mit erreichtem oder
            unterschrittenem Mindestbestand.
          </p>
        </div>

        <Link
          className="primary-button"
          href="/filamente/neu"
        >
          + Filament hinzufügen
        </Link>
      </header>

      <section
        className={styles.summaryGrid}
        aria-label="Zusammenfassung"
      >
        <article
          className={`${styles.summaryCard} ${styles.summaryDanger}`}
        >
          <span>Unter Mindestbestand</span>
          <strong>{belowMinimumCount}</strong>
          <small>
            davon {emptyCount} komplett leer
          </small>
        </article>

        <article
          className={`${styles.summaryCard} ${styles.summaryWarning}`}
        >
          <span>Knapp</span>
          <strong>{warningCount}</strong>
          <small>
            Mindestbestand genau erreicht
          </small>
        </article>

        <article className={styles.summaryCard}>
          <span>Empfohlene Rollen</span>
          <strong>{suggestedRolls}</strong>
          <small>
            zum Auffüllen der kritischen Bestände
          </small>
        </article>

        <article
          className={`${styles.summaryCard} ${styles.summarySuccess}`}
        >
          <span>Mit Bestelllink</span>
          <strong>{withOrderLink}</strong>
          <small>
            direkt aus der Liste bestellbar
          </small>
        </article>
      </section>

      <section className={styles.listPanel}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <span>Suche</span>
            <input
              type="search"
              placeholder="Hersteller, Material, Farbe, Barcode oder Lagerplatz …"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>

          <label className={styles.filterField}>
            <span>Bestandsstatus</span>
            <select
              value={filter}
              onChange={(event) =>
                setFilter(
                  event.target
                    .value as ReorderFilter,
                )
              }
            >
              <option value="all">
                Alle kritischen Filamente
              </option>
              <option value="empty">
                Nur Bestand 0
              </option>
              <option value="below">
                Unter Mindestbestand
              </option>
              <option value="equal">
                Mindestbestand erreicht
              </option>
            </select>
          </label>
        </div>

        {reorderFilaments.length === 0 ? (
          <div className={styles.allGood}>
            <span>✓</span>
            <div>
              <strong>
                Aktuell muss nichts nachbestellt werden
              </strong>
              <p>
                Alle Filamente liegen über ihrem
                Mindestbestand.
              </p>
            </div>
          </div>
        ) : filteredFilaments.length === 0 ? (
          <div className={styles.emptyState}>
            Keine passenden Filamente gefunden.
          </div>
        ) : (
          <div className={styles.reorderList}>
            {filteredFilaments.map(
              (filament) => {
                const stockState =
                  getStockState(filament);
                const orderAmount =
                  selectedOrderAmount(filament);

                return (
                  <article
                    className={styles.reorderCard}
                    key={filament.id}
                  >
                    <div
                      className={
                        styles.productColumn
                      }
                    >
                      <div
                        className={
                          styles.productHeading
                        }
                      >
                        <span
                          className={
                            styles.idBadge
                          }
                        >
                          ID {filament.id}
                        </span>
                        <span
                          className={`${styles.statusBadge} ${stockState.className}`}
                        >
                          {stockState.label}
                        </span>
                      </div>

                      <h2>
                        {filament.material}{" "}
                        {filament.color}
                      </h2>
                      <p>
                        {filament.manufacturer}
                      </p>
                      <code>
                        {filament.barcode ||
                          "Kein Barcode"}
                      </code>
                    </div>

                    <dl
                      className={
                        styles.stockDetails
                      }
                    >
                      <div>
                        <dt>Bestand</dt>
                        <dd
                          className={
                            filament.stock === 0
                              ? styles.stockEmpty
                              : styles.stockLow
                          }
                        >
                          {filament.stock}
                        </dd>
                      </div>

                      <div>
                        <dt>Mindestbestand</dt>
                        <dd>
                          {filament.minimumStock}
                        </dd>
                      </div>

                      <div>
                        <dt>Empfehlung</dt>
                        <dd>
                          +{orderAmount}{" "}
                          {orderAmount === 1
                            ? "Rolle"
                            : "Rollen"}
                        </dd>
                      </div>

                      <div>
                        <dt>Lagerplatz</dt>
                        <dd>
                          {filament.location ||
                            "Nicht angegeben"}
                        </dd>
                      </div>
                    </dl>

                    <div
                      className={styles.actions}
                    >
                      <div
                        className={
                          styles.quantitySection
                        }
                      >
                        <span>Bestellmenge</span>

                        <div
                          className={
                            styles.quantityControl
                          }
                        >
                          <button
                            type="button"
                            aria-label={`Bestellmenge für ${filament.material} ${filament.color} verringern`}
                            disabled={
                              orderAmount <= 1
                            }
                            onClick={() =>
                              changeOrderAmount(
                                filament,
                                -1,
                              )
                            }
                          >
                            −
                          </button>

                          <strong>
                            {orderAmount}
                          </strong>

                          <button
                            type="button"
                            aria-label={`Bestellmenge für ${filament.material} ${filament.color} erhöhen`}
                            disabled={
                              orderAmount >= 99
                            }
                            onClick={() =>
                              changeOrderAmount(
                                filament,
                                1,
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {filament.orderLink ? (
                        <button
                          className={
                            styles.orderButton
                          }
                          type="button"
                          onClick={() =>
                            openOrderLink(
                              filament,
                            )
                          }
                        >
                          {openedOrderId ===
                          filament.id
                            ? "Bestelllink geöffnet"
                            : `${
                                orderAmount === 1
                                  ? "1 Rolle"
                                  : `${orderAmount} Rollen`
                              } bestellen`}
                        </button>
                      ) : (
                        <Link
                          className={
                            styles.addLinkButton
                          }
                          href={`/filamente/${filament.id}`}
                        >
                          Bestelllink eintragen
                        </Link>
                      )}

                      <Link
                        className={
                          styles.detailsButton
                        }
                        href={`/filamente/${filament.id}`}
                      >
                        Details & Bearbeiten
                      </Link>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>
    </div>
  );
}
