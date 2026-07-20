"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import {
  orderFormToRow,
  orderToForm,
  rowToOrder,
} from "@/components/philamentix/mappers";
import {
  emptyOrderForm,
  type Order,
  type OrderForm,
  type OrderRow,
  type OrderStatus,
} from "@/components/philamentix/types";
import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

const STATUS_OPTIONS: Array<{
  value: OrderStatus;
  label: string;
}> = [
  {
    value: "open",
    label: "Offen",
  },
  {
    value: "in_progress",
    label: "In Arbeit",
  },
  {
    value: "completed",
    label: "Erledigt",
  },
  {
    value: "cancelled",
    label: "Storniert",
  },
];

const STATUS_ORDER: Record<
  OrderStatus,
  number
> = {
  open: 0,
  in_progress: 1,
  completed: 2,
  cancelled: 3,
};

function statusLabel(
  status: OrderStatus,
): string {
  return (
    STATUS_OPTIONS.find(
      (option) =>
        option.value === status,
    )?.label ?? status
  );
}

function statusClass(
  status: OrderStatus,
): string {
  if (status === "in_progress") {
    return styles.statusProgress;
  }

  if (status === "completed") {
    return styles.statusCompleted;
  }

  if (status === "cancelled") {
    return styles.statusCancelled;
  }

  return styles.statusOpen;
}

function isMissingOrdersTable(
  error: unknown,
): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  const code =
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  return (
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205"
  );
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Kein Termin";
  }

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "de-DE",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(date);
}

function isOrderOverdue(
  order: Order,
): boolean {
  if (
    !order.dueDate ||
    order.status === "completed" ||
    order.status === "cancelled"
  ) {
    return false;
  }

  const dueDate = new Date(
    `${order.dueDate}T23:59:59`,
  );
  return dueDate.getTime() < Date.now();
}

function orderCode(
  orderId: string,
): string {
  return `#${orderId
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase()}`;
}

function normalizeForm(
  form: OrderForm,
): OrderForm {
  return {
    title: form.title.trim(),
    customerName:
      form.customerName.trim(),
    status: form.status,
    dueDate: form.dueDate,
    notes: form.notes.trim(),
  };
}

export default function OrdersPage() {
  const { user } = useHub();
  const [orders, setOrders] =
    useState<Order[]>([]);
  const [form, setForm] =
    useState<OrderForm>(
      emptyOrderForm,
    );
  const [editingId, setEditingId] =
    useState<string | null>(null);
  const [formOpen, setFormOpen] =
    useState(false);
  const [search, setSearch] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | OrderStatus>(
      "all",
    );
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [error, setError] =
    useState("");
  const [
    setupMissing,
    setSetupMissing,
  ] = useState(false);

  const loadOrders = useCallback(
    async () => {
      if (!user) {
        setOrders([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const result = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (result.error) {
        if (
          isMissingOrdersTable(
            result.error,
          )
        ) {
          setSetupMissing(true);
          setOrders([]);
          setError(
            "Das Auftragssystem ist noch nicht in Supabase eingerichtet. Bitte einmal supabase/orders.sql ausführen.",
          );
          setLoading(false);
          return;
        }

        setError(result.error.message);
        setLoading(false);
        return;
      }

      setSetupMissing(false);
      setOrders(
        (result.data ?? []).map(
          (row) =>
            rowToOrder(
              row as OrderRow,
            ),
        ),
      );
      setLoading(false);
    },
    [user],
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(
    () => {
      const needle =
        search.trim().toLowerCase();

      return [...orders]
        .filter((order) => {
          if (
            statusFilter !== "all" &&
            order.status !==
              statusFilter
          ) {
            return false;
          }

          if (!needle) {
            return true;
          }

          return [
            order.id,
            order.title,
            order.customerName,
            order.notes,
            statusLabel(
              order.status,
            ),
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle);
        })
        .sort((first, second) => {
          const firstOverdue =
            isOrderOverdue(first);
          const secondOverdue =
            isOrderOverdue(second);

          if (
            firstOverdue !==
            secondOverdue
          ) {
            return firstOverdue
              ? -1
              : 1;
          }

          const statusDifference =
            STATUS_ORDER[first.status] -
            STATUS_ORDER[
              second.status
            ];

          if (statusDifference !== 0) {
            return statusDifference;
          }

          return (
            new Date(
              second.createdAt,
            ).getTime() -
            new Date(
              first.createdAt,
            ).getTime()
          );
        });
    },
    [
      orders,
      search,
      statusFilter,
    ],
  );

  const openCount = orders.filter(
    (order) =>
      order.status === "open",
  ).length;
  const progressCount = orders.filter(
    (order) =>
      order.status ===
      "in_progress",
  ).length;
  const completedCount = orders.filter(
    (order) =>
      order.status ===
      "completed",
  ).length;
  const overdueCount = orders.filter(
    isOrderOverdue,
  ).length;

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function setField<
    K extends keyof OrderForm,
  >(
    key: K,
    value: OrderForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function startCreate() {
    clearFeedback();
    setEditingId(null);
    setForm(emptyOrderForm);
    setFormOpen(true);
  }

  function startEdit(
    order: Order,
  ) {
    clearFeedback();
    setEditingId(order.id);
    setForm(orderToForm(order));
    setFormOpen(true);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyOrderForm);
  }

  async function saveOrder(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    clearFeedback();

    if (!user) {
      setError(
        "Deine Sitzung ist nicht verfügbar.",
      );
      return;
    }

    const cleaned =
      normalizeForm(form);

    if (!cleaned.title) {
      setError(
        "Bitte einen Auftragstitel angeben.",
      );
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const result = await supabase
          .from("orders")
          .update(
            orderFormToRow(
              cleaned,
              user.id,
            ),
          )
          .eq("id", editingId)
          .eq("user_id", user.id)
          .select("*")
          .single();

        if (result.error) {
          throw result.error;
        }

        const updatedOrder =
          rowToOrder(
            result.data as OrderRow,
          );

        setOrders((current) =>
          current.map((order) =>
            order.id === editingId
              ? updatedOrder
              : order,
          ),
        );
        setMessage(
          "Auftrag wurde aktualisiert.",
        );
      } else {
        const result = await supabase
          .from("orders")
          .insert(
            orderFormToRow(
              cleaned,
              user.id,
            ),
          )
          .select("*")
          .single();

        if (result.error) {
          throw result.error;
        }

        const createdOrder =
          rowToOrder(
            result.data as OrderRow,
          );

        setOrders((current) => [
          createdOrder,
          ...current,
        ]);
        setMessage(
          "Auftrag wurde angelegt.",
        );
      }

      closeForm();
    } catch (caughtError) {
      if (
        isMissingOrdersTable(
          caughtError,
        )
      ) {
        setSetupMissing(true);
        setError(
          "Bitte zuerst supabase/orders.sql in Supabase ausführen.",
        );
      } else {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Auftrag konnte nicht gespeichert werden.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    order: Order,
    status: OrderStatus,
  ) {
    if (
      !user ||
      order.status === status
    ) {
      return;
    }

    clearFeedback();
    setSaving(true);

    try {
      const result = await supabase
        .from("orders")
        .update({
          status,
        })
        .eq("id", order.id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (result.error) {
        throw result.error;
      }

      const updatedOrder =
        rowToOrder(
          result.data as OrderRow,
        );

      setOrders((current) =>
        current.map((entry) =>
          entry.id === order.id
            ? updatedOrder
            : entry,
        ),
      );
      setMessage(
        `Status wurde auf „${statusLabel(
          status,
        )}“ gesetzt.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Status konnte nicht geändert werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(
    order: Order,
  ) {
    if (!user) {
      return;
    }

    const confirmed =
      window.confirm(
        `Auftrag „${order.title}“ wirklich löschen?`,
      );

    if (!confirmed) {
      return;
    }

    clearFeedback();
    setSaving(true);

    try {
      const result = await supabase
        .from("orders")
        .delete()
        .eq("id", order.id)
        .eq("user_id", user.id);

      if (result.error) {
        throw result.error;
      }

      setOrders((current) =>
        current.filter(
          (entry) =>
            entry.id !== order.id,
        ),
      );
      setMessage(
        "Auftrag wurde gelöscht.",
      );

      if (
        editingId === order.id
      ) {
        closeForm();
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Auftrag konnte nicht gelöscht werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <span className="welcome-label">
            Produktion
          </span>
          <h1>Aufträge</h1>
          <p>
            Aufträge anlegen, Termine
            überblicken und den Status
            pflegen
          </p>
        </div>

        <div
          className={
            styles.headerActions
          }
        >
          <button
            className="secondary-button"
            type="button"
            disabled={loading || saving}
            onClick={() =>
              void loadOrders()
            }
          >
            Aktualisieren
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={
              setupMissing || saving
            }
            onClick={startCreate}
          >
            + Auftrag anlegen
          </button>
        </div>
      </header>

      {(message || error) && (
        <div
          className={`${styles.feedback} ${
            error
              ? styles.feedbackError
              : styles.feedbackSuccess
          }`}
        >
          {error || message}
        </div>
      )}

      {formOpen && (
        <section
          className={
            styles.formPanel
          }
        >
          <div
            className={
              styles.formHeader
            }
          >
            <div>
              <span>
                {editingId
                  ? "Auftrag bearbeiten"
                  : "Neuer Auftrag"}
              </span>
              <h2>
                {editingId
                  ? form.title ||
                    "Auftrag"
                  : "Auftragsdaten"}
              </h2>
              <p>
                Für den Start reichen
                Titel und Status. Kunde,
                Termin und Notiz sind
                optional.
              </p>
            </div>

            <button
              className={
                styles.closeButton
              }
              type="button"
              onClick={closeForm}
            >
              Schließen
            </button>
          </div>

          <form
            className={styles.form}
            onSubmit={(event) =>
              void saveOrder(event)
            }
          >
            <label
              className={
                styles.fieldWide
              }
            >
              <span>
                Auftragstitel *
              </span>
              <input
                type="text"
                maxLength={200}
                required
                placeholder="z. B. Gehäuse für Steuerung drucken"
                value={form.title}
                onChange={(event) =>
                  setField(
                    "title",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Kunde / Projekt
              </span>
              <input
                type="text"
                maxLength={200}
                placeholder="Optional"
                value={
                  form.customerName
                }
                onChange={(event) =>
                  setField(
                    "customerName",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setField(
                    "status",
                    event.target
                      .value as OrderStatus,
                  )
                }
              >
                {STATUS_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>
                Fällig am
              </span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  setField(
                    "dueDate",
                    event.target.value,
                  )
                }
              />
            </label>

            <label
              className={
                styles.fieldFull
              }
            >
              <span>Notizen</span>
              <textarea
                rows={4}
                maxLength={5000}
                placeholder="Optionale Hinweise zum Auftrag"
                value={form.notes}
                onChange={(event) =>
                  setField(
                    "notes",
                    event.target.value,
                  )
                }
              />
            </label>

            <div
              className={
                styles.formActions
              }
            >
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={closeForm}
              >
                Abbrechen
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Wird gespeichert …"
                  : editingId
                    ? "Änderungen speichern"
                    : "Auftrag anlegen"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section
        className={styles.summaryGrid}
      >
        <article>
          <span>Offen</span>
          <strong>{openCount}</strong>
          <small>
            Noch nicht begonnen
          </small>
        </article>
        <article>
          <span>In Arbeit</span>
          <strong>{progressCount}</strong>
          <small>
            Aktive Aufträge
          </small>
        </article>
        <article>
          <span>Überfällig</span>
          <strong
            className={
              overdueCount > 0
                ? styles.dangerValue
                : ""
            }
          >
            {overdueCount}
          </strong>
          <small>
            Termin überschritten
          </small>
        </article>
        <article>
          <span>Erledigt</span>
          <strong>{completedCount}</strong>
          <small>
            Abgeschlossene Aufträge
          </small>
        </article>
      </section>

      <section
        className={styles.toolbar}
      >
        <input
          className={
            styles.searchInput
          }
          type="search"
          placeholder="Titel, Kunde oder Notiz suchen …"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value,
            )
          }
        />

        <select
          className={
            styles.filterSelect
          }
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value as
                | "all"
                | OrderStatus,
            )
          }
        >
          <option value="all">
            Alle Status
          </option>
          {STATUS_OPTIONS.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ),
          )}
        </select>
      </section>

      {loading ? (
        <div
          className={styles.emptyState}
        >
          Aufträge werden geladen …
        </div>
      ) : setupMissing ? (
        <div
          className={
            styles.setupState
          }
        >
          <strong>
            Einmalige Einrichtung
          </strong>
          <p>
            Öffne in diesem Paket
            <code>
              supabase/orders.sql
            </code>
            , kopiere den gesamten Inhalt
            in den Supabase SQL Editor und
            klicke auf Run.
          </p>
        </div>
      ) : filteredOrders.length ===
        0 ? (
        <div
          className={styles.emptyState}
        >
          {orders.length === 0
            ? "Noch keine Aufträge vorhanden."
            : "Keine passenden Aufträge gefunden."}
        </div>
      ) : (
        <section
          className={styles.orderList}
        >
          {filteredOrders.map(
            (order) => {
              const overdue =
                isOrderOverdue(
                  order,
                );

              return (
                <article
                  className={`${styles.orderCard} ${
                    order.status ===
                      "completed" ||
                    order.status ===
                      "cancelled"
                      ? styles.orderCardMuted
                      : ""
                  }`}
                  key={order.id}
                >
                  <div
                    className={`${styles.statusRail} ${statusClass(
                      order.status,
                    )}`}
                  />

                  <div
                    className={
                      styles.orderMain
                    }
                  >
                    <div
                      className={
                        styles.orderHeader
                      }
                    >
                      <div>
                        <div
                          className={
                            styles.orderLabels
                          }
                        >
                          <span
                            className={
                              styles.orderCode
                            }
                          >
                            {orderCode(
                              order.id,
                            )}
                          </span>
                          <span
                            className={`${styles.statusBadge} ${statusClass(
                              order.status,
                            )}`}
                          >
                            {statusLabel(
                              order.status,
                            )}
                          </span>
                          {overdue && (
                            <span
                              className={
                                styles.overdueBadge
                              }
                            >
                              Überfällig
                            </span>
                          )}
                        </div>

                        <h2>
                          {order.title}
                        </h2>
                        <p>
                          {order.customerName ||
                            "Kein Kunde oder Projekt angegeben"}
                        </p>
                      </div>

                      <label
                        className={
                          styles.quickStatus
                        }
                      >
                        <span>
                          Status ändern
                        </span>
                        <select
                          disabled={saving}
                          value={
                            order.status
                          }
                          onChange={(
                            event,
                          ) =>
                            void changeStatus(
                              order,
                              event.target
                                .value as OrderStatus,
                            )
                          }
                        >
                          {STATUS_OPTIONS.map(
                            (option) => (
                              <option
                                key={
                                  option.value
                                }
                                value={
                                  option.value
                                }
                              >
                                {
                                  option.label
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>

                    <dl
                      className={
                        styles.orderMeta
                      }
                    >
                      <div>
                        <dt>Fällig</dt>
                        <dd
                          className={
                            overdue
                              ? styles.dangerText
                              : ""
                          }
                        >
                          {formatDate(
                            order.dueDate,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Angelegt</dt>
                        <dd>
                          {formatDate(
                            order.createdAt,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          Aktualisiert
                        </dt>
                        <dd>
                          {formatDate(
                            order.updatedAt,
                          )}
                        </dd>
                      </div>
                    </dl>

                    {order.notes && (
                      <p
                        className={
                          styles.notes
                        }
                      >
                        {order.notes}
                      </p>
                    )}

                    <div
                      className={
                        styles.orderActions
                      }
                    >
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          startEdit(
                            order,
                          )
                        }
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="delete-button"
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void deleteOrder(
                            order,
                          )
                        }
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </section>
      )}
    </div>
  );
}
