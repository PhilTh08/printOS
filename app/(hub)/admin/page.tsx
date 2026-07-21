"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  locked: boolean;
  isAdmin: boolean;
  isCurrentAdmin: boolean;
  online: boolean;
  lastSeenAt: string | null;
};

type AdminFilament = {
  id: number;
  user_id: string;
  barcode: string;
  manufacturer: string;
  material: string;
  color: string;
  weight_per_roll: number;
  location: string;
  minimum_stock: number;
  stock: number;
  order_link: string;
  image_url: string | null;
};

type AdminLog = {
  id: string;
  created_at: string;
  action: "in" | "out";
  source: "scan" | "manual";
  filament_name: string;
  barcode: string;
  stock_after: number;
};

type AdminAudit = {
  id: string;
  created_at: string;
  completed_at: string | null;
  adminEmail: string;
  targetEmail: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  reason: string;
  status: "pending" | "success" | "failed";
  error_message: string | null;
};

type UserDetail = {
  user: {
    id: string;
    email: string;
    createdAt: string;
    lastSignInAt: string | null;
    emailConfirmedAt: string | null;
    bannedUntil: string | null;
    locked: boolean;
    isAdmin: boolean;
    isCurrentAdmin: boolean;
    userMetadata: Record<string, unknown>;
  };
  filaments: AdminFilament[];
  logs: AdminLog[];
  orders: Record<string, unknown>[];
  ordersAvailable: boolean;
};

type FilamentEditForm = {
  barcode: string;
  manufacturer: string;
  material: string;
  color: string;
  weightPerRoll: number;
  location: string;
  minimumStock: number;
  stock: number;
  orderLink: string;
  imageUrl: string;
  reason: string;
};

type AdminTab =
  | "filaments"
  | "orders"
  | "logs"
  | "audit";

function formatDate(value: string | null): string {
  if (!value) {
    return "–";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLastSeen(
  value: string | null,
): string {
  if (!value) {
    return "Noch keine Aktivität erfasst";
  }

  const difference = Math.max(
    0,
    Date.now() -
      new Date(value).getTime(),
  );
  const seconds = Math.floor(
    difference / 1000,
  );

  if (seconds < 45) {
    return "Gerade eben aktiv";
  }

  const minutes = Math.floor(
    seconds / 60,
  );

  if (minutes < 60) {
    return `Vor ${minutes} Min. aktiv`;
  }

  const hours = Math.floor(
    minutes / 60,
  );

  if (hours < 24) {
    return `Vor ${hours} Std. aktiv`;
  }

  return `Zuletzt aktiv ${formatDate(
    value,
  )}`;
}

function orderTitle(
  order: Record<string, unknown>,
  index: number,
): string {
  for (const key of [
    "order_number",
    "number",
    "title",
    "name",
    "id",
  ]) {
    const value = order[key];

    if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      return String(value);
    }
  }

  return `Auftrag ${index + 1}`;
}


type AdminOrderStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled";

function adminOrderStatus(
  order: Record<string, unknown>,
): AdminOrderStatus {
  const value = order.status;

  if (
    value === "in_progress" ||
    value === "completed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "open";
}

function adminOrderDueDate(
  order: Record<string, unknown>,
): string | null {
  const value =
    order.due_date ?? order.dueDate;

  return typeof value === "string" &&
    value.trim()
    ? value
    : null;
}

function adminOrderIsOverdue(
  order: Record<string, unknown>,
): boolean {
  const status = adminOrderStatus(order);
  const dueDate = adminOrderDueDate(order);

  if (
    !dueDate ||
    status === "completed" ||
    status === "cancelled"
  ) {
    return false;
  }

  const date = new Date(
    dueDate.includes("T")
      ? dueDate
      : `${dueDate}T23:59:59`,
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.getTime() < Date.now()
  );
}

function adminOrderSummary(
  orders: Record<string, unknown>[],
) {
  return orders.reduce(
    (summary, order) => {
      const status =
        adminOrderStatus(order);

      if (status === "open") {
        summary.open += 1;
      } else if (
        status === "in_progress"
      ) {
        summary.inProgress += 1;
      } else if (
        status === "completed"
      ) {
        summary.completed += 1;
      }

      if (adminOrderIsOverdue(order)) {
        summary.overdue += 1;
      }

      return summary;
    },
    {
      open: 0,
      inProgress: 0,
      overdue: 0,
      completed: 0,
    },
  );
}

export default function AdminPage() {
  const {
    isAdmin,
    adminRoleReady,
    user: currentUser,
  } = useHub();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] =
    useState("");
  const [detail, setDetail] =
    useState<UserDetail | null>(null);
  const [audit, setAudit] = useState<AdminAudit[]>([]);
  const [activeTab, setActiveTab] =
    useState<AdminTab>("filaments");
  const [search, setSearch] = useState("");
  const [loadingUsers, setLoadingUsers] =
    useState(false);
  const [
    presenceAvailable,
    setPresenceAvailable,
  ] = useState<boolean | null>(null);
  const [
    presenceRefreshing,
    setPresenceRefreshing,
  ] = useState(false);
  const [loadingDetail, setLoadingDetail] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingFilament, setEditingFilament] =
    useState<{
      id: number;
      form: FilamentEditForm;
    } | null>(null);

  const adminFetch = useCallback(
    async <T,>(
      path: string,
      options?: RequestInit,
    ): Promise<T> => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error(
          "Die Sitzung ist abgelaufen. Bitte neu anmelden.",
        );
      }

      const response = await fetch(path, {
        ...options,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(options?.headers ?? {}),
        },
      });
      const result: unknown =
        await response.json();

      if (!response.ok) {
        const errorMessage =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Adminanfrage ist fehlgeschlagen.";

        throw new Error(errorMessage);
      }

      return result as T;
    },
    [],
  );

  const loadAudit = useCallback(async () => {
    const result = await adminFetch<{
      audit: AdminAudit[];
    }>("/api/admin/audit");
    setAudit(result.audit);
  }, [adminFetch]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError("");

    try {
      const result = await adminFetch<{
        users: AdminUser[];
        presenceAvailable: boolean;
      }>("/api/admin/users");
      setUsers(result.users);
      setPresenceAvailable(
        result.presenceAvailable,
      );
      setSelectedUserId((current) =>
        current || result.users[0]?.id || "",
      );
    } finally {
      setLoadingUsers(false);
    }
  }, [adminFetch]);

  const loadPresence = useCallback(
    async () => {
      setPresenceRefreshing(true);

      try {
        const result = await adminFetch<{
          presence: Array<{
            userId: string;
            lastSeenAt: string;
            online: boolean;
          }>;
          available: boolean;
        }>("/api/admin/presence");
        const presenceByUserId = new Map(
          result.presence.map(
            (entry) => [
              entry.userId,
              entry,
            ],
          ),
        );

        setUsers((current) =>
          current.map((account) => {
            const presence =
              presenceByUserId.get(
                account.id,
              );

            return {
              ...account,
              online:
                presence?.online ?? false,
              lastSeenAt:
                presence?.lastSeenAt ??
                account.lastSeenAt,
            };
          }),
        );
        setPresenceAvailable(
          result.available,
        );
      } finally {
        setPresenceRefreshing(false);
      }
    },
    [adminFetch],
  );

  const loadUserDetail = useCallback(
    async (userId: string) => {
      if (!userId) {
        setDetail(null);
        return;
      }

      setLoadingDetail(true);
      setError("");

      try {
        const result = await adminFetch<UserDetail>(
          `/api/admin/users/${encodeURIComponent(
            userId,
          )}`,
        );
        setDetail(result);
      } finally {
        setLoadingDetail(false);
      }
    },
    [adminFetch],
  );

  useEffect(() => {
    if (!adminRoleReady || !isAdmin) {
      return;
    }

    void Promise.all([loadUsers(), loadAudit()]).catch(
      (caughtError) => {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Adminbereich konnte nicht geladen werden.",
        );
      },
    );
  }, [
    adminRoleReady,
    isAdmin,
    loadAudit,
    loadUsers,
  ]);

  useEffect(() => {
    if (!adminRoleReady || !isAdmin) {
      return;
    }

    const intervalId =
      window.setInterval(
        () => {
          void loadPresence().catch(
            (caughtError) => {
              console.warn(
                "Online-Status konnte nicht aktualisiert werden:",
                caughtError,
              );
            },
          );
        },
        20_000,
      );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    adminRoleReady,
    isAdmin,
    loadPresence,
  ]);

  useEffect(() => {
    if (!isAdmin || !selectedUserId) {
      return;
    }

    void loadUserDetail(selectedUserId).catch(
      (caughtError) => {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Benutzerdaten konnten nicht geladen werden.",
        );
      },
    );
  }, [
    isAdmin,
    selectedUserId,
    loadUserDetail,
  ]);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matchingUsers = needle
      ? users.filter((user) =>
          `${user.email} ${user.displayName}`
            .toLowerCase()
            .includes(needle),
        )
      : [...users];

    return matchingUsers.sort(
      (first, second) => {
        if (
          first.online !==
          second.online
        ) {
          return first.online ? -1 : 1;
        }

        if (
          first.isAdmin !==
          second.isAdmin
        ) {
          return first.isAdmin ? -1 : 1;
        }

        return first.email.localeCompare(
          second.email,
          "de",
        );
      },
    );
  }, [search, users]);

  const lockedCount = users.filter(
    (user) => user.locked,
  ).length;
  const adminCount = users.filter(
    (user) => user.isAdmin,
  ).length;
  const selectedOrderSummary = useMemo(
    () => adminOrderSummary(
      detail?.orders ?? [],
    ),
    [detail?.orders],
  );
  const onlineCount = users.filter(
    (user) => user.online,
  ).length;
  const selectedAccount =
    users.find(
      (account) =>
        account.id === selectedUserId,
    ) ?? null;

  async function reloadEverything() {
    await Promise.all([
      loadUsers(),
      selectedUserId
        ? loadUserDetail(selectedUserId)
        : Promise.resolve(),
      loadAudit(),
    ]);
  }

  async function toggleAccountLock() {
    if (!detail) {
      return;
    }

    const nextLocked = !detail.user.locked;
    const reason = window.prompt(
      nextLocked
        ? "Warum wird dieses Konto gesperrt?"
        : "Warum wird dieses Konto entsperrt?",
      nextLocked
        ? "Support-Sperrung: "
        : "Support-Entsperrung: ",
    );

    if (!reason) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await adminFetch(
        `/api/admin/users/${encodeURIComponent(
          detail.user.id,
        )}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            locked: nextLocked,
            reason,
          }),
        },
      );
      setMessage(
        nextLocked
          ? "Konto wurde gesperrt."
          : "Konto wurde entsperrt.",
      );
      await reloadEverything();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Kontostatus konnte nicht geändert werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startFilamentEdit(
    filament: AdminFilament,
  ) {
    setEditingFilament({
      id: filament.id,
      form: {
        barcode: filament.barcode,
        manufacturer: filament.manufacturer,
        material: filament.material,
        color: filament.color,
        weightPerRoll:
          filament.weight_per_roll,
        location: filament.location,
        minimumStock: filament.minimum_stock,
        stock: filament.stock,
        orderLink: filament.order_link,
        imageUrl: filament.image_url ?? "",
        reason: "",
      },
    });
  }

  function setEditField<
    K extends keyof FilamentEditForm,
  >(key: K, value: FilamentEditForm[K]) {
    setEditingFilament((current) =>
      current
        ? {
            ...current,
            form: {
              ...current.form,
              [key]: value,
            },
          }
        : current,
    );
  }

  async function saveFilamentCorrection(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!detail || !editingFilament) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await adminFetch(
        `/api/admin/users/${encodeURIComponent(
          detail.user.id,
        )}/filaments/${editingFilament.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(
            editingFilament.form,
          ),
        },
      );
      setEditingFilament(null);
      setMessage(
        "Filamentdaten wurden korrigiert und protokolliert.",
      );
      await Promise.all([
        loadUserDetail(detail.user.id),
        loadAudit(),
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Filament konnte nicht korrigiert werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(log: AdminLog) {
    if (!detail) {
      return;
    }

    const reason = window.prompt(
      "Warum wird dieser fehlerhafte Protokolleintrag entfernt?",
      "Support-Korrektur: ",
    );

    if (!reason) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await adminFetch(
        `/api/admin/users/${encodeURIComponent(
          detail.user.id,
        )}/logs/${encodeURIComponent(log.id)}`,
        {
          method: "DELETE",
          body: JSON.stringify({ reason }),
        },
      );
      setMessage(
        "Protokolleintrag wurde entfernt und im Adminprotokoll gesichert.",
      );
      await Promise.all([
        loadUserDetail(detail.user.id),
        loadAudit(),
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Protokolleintrag konnte nicht entfernt werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!adminRoleReady) {
    return (
      <div className={styles.stateCard}>
        Adminberechtigung wird geprüft …
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.deniedCard}>
        <strong>Kein Adminzugriff</strong>
        <p>
          Dieser Bereich ist ausschließlich für in
          Supabase eingetragene Administratoren
          sichtbar.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <span className="welcome-label">
            Geschützter Bereich
          </span>
          <h1>Administration</h1>
          <p>
            Nutzer-Support, Kontosperren und
            revisionsfähige Adminaktionen
          </p>
        </div>

        <div className={styles.adminIdentity}>
          <span>ADMIN</span>
          <strong>{currentUser?.email}</strong>
        </div>
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

      <section className={styles.statsGrid}>
        <article>
          <span>Konten</span>
          <strong>{users.length}</strong>
          <small>Supabase-Auth-Nutzer</small>
        </article>
        <article>
          <span>Gesperrt</span>
          <strong>{lockedCount}</strong>
          <small>Login blockiert</small>
        </article>
        <article>
          <span>Administratoren</span>
          <strong>{adminCount}</strong>
          <small>Rolle aus user_roles</small>
        </article>
        <article>
          <span>Gerade online</span>
          <strong>{onlineCount}</strong>
          <small>
            Aktivität der letzten 75 Sek.
          </small>
        </article>
        <article>
          <span>Adminaktionen</span>
          <strong>{audit.length}</strong>
          <small>zuletzt geladen</small>
        </article>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.userPanel}>
          <div className={styles.panelHeading}>
            <div>
              <span>Nutzerverwaltung</span>
              <h2>Accounts</h2>
              <small
                className={
                  presenceAvailable === false
                    ? styles.presenceUnavailable
                    : styles.presenceConnected
                }
              >
                {presenceRefreshing
                  ? "Online-Status wird aktualisiert …"
                  : presenceAvailable === false
                    ? "Online-Anzeige noch nicht eingerichtet"
                    : "Online-Status · automatisch alle 20 Sek."}
              </small>
            </div>
            <button
              type="button"
              disabled={
                loadingUsers ||
                presenceRefreshing ||
                saving
              }
              onClick={() =>
                void reloadEverything().catch(
                  (caughtError) =>
                    setError(
                      caughtError instanceof Error
                        ? caughtError.message
                        : "Aktualisierung fehlgeschlagen.",
                    ),
                )
              }
            >
              ↻
            </button>
          </div>

          <input
            className={styles.userSearch}
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Name oder E-Mail suchen"
          />

          <div className={styles.userList}>
            {filteredUsers.map((user) => (
              <button
                className={`${styles.userItem} ${
                  selectedUserId === user.id
                    ? styles.userItemActive
                    : ""
                }`}
                type="button"
                key={user.id}
                onClick={() => {
                  setSelectedUserId(user.id);
                  setActiveTab("filaments");
                  setEditingFilament(null);
                }}
              >
                <span
                  className={`${styles.userStatus} ${
                    user.online
                      ? styles.userStatusOnline
                      : styles.userStatusOffline
                  }`}
                  title={
                    user.online
                      ? "Online"
                      : "Offline"
                  }
                />
                <div>
                  <strong>{user.displayName}</strong>
                  <small>{user.email}</small>
                  <em>
                    {user.isAdmin
                      ? "Administrator · "
                      : user.locked
                        ? "Gesperrt · "
                        : ""}
                    {user.online
                      ? "Online"
                      : "Offline"}
                  </em>
                  <span
                    className={
                      styles.lastSeen
                    }
                  >
                    {formatLastSeen(
                      user.lastSeenAt,
                    )}
                  </span>
                </div>
              </button>
            ))}

            {!loadingUsers &&
              filteredUsers.length === 0 && (
                <p className={styles.emptyState}>
                  Keine passenden Accounts.
                </p>
              )}
          </div>
        </aside>

        <div className={styles.detailPanel}>
          {loadingDetail && (
            <div className={styles.loadingOverlay}>
              Supportdaten werden geladen …
            </div>
          )}

          {!detail ? (
            <div className={styles.emptyDetail}>
              Wähle links einen Account aus.
            </div>
          ) : (
            <>
              <div className={styles.userHeader}>
                <div>
                  <span>Ausgewählter Account</span>
                  <h2>{detail.user.email}</h2>
                  <p>
                    Erstellt {formatDate(
                      detail.user.createdAt,
                    )}
                    {" · "}Letzter Login{" "}
                    {formatDate(
                      detail.user.lastSignInAt,
                    )}
                    {" · "}
                    {formatLastSeen(
                      selectedAccount?.lastSeenAt ??
                        null,
                    )}
                  </p>
                </div>

                <div className={styles.accountActions}>
                  <span
                    className={
                      selectedAccount?.online
                        ? styles.onlineBadge
                        : styles.offlineBadge
                    }
                  >
                    {selectedAccount?.online
                      ? "Online"
                      : "Offline"}
                  </span>

                  <span
                    className={
                      detail.user.locked
                        ? styles.lockedBadge
                        : styles.activeBadge
                    }
                  >
                    {detail.user.locked
                      ? "Gesperrt"
                      : "Aktiv"}
                  </span>

                  <button
                    className={
                      detail.user.locked
                        ? styles.unlockButton
                        : styles.lockButton
                    }
                    type="button"
                    disabled={
                      saving ||
                      detail.user.isCurrentAdmin ||
                      (!detail.user.locked &&
                        detail.user.isAdmin)
                    }
                    onClick={() =>
                      void toggleAccountLock()
                    }
                  >
                    {detail.user.locked
                      ? "Konto entsperren"
                      : "Konto sperren"}
                  </button>
                </div>
              </div>

              {presenceAvailable === false && (
                <div className={styles.presenceWarning}>
                  Die sichere Online-Anzeige ist noch
                  nicht eingerichtet. Führe einmal
                  <code>
                    supabase/admin_online_presence.sql
                  </code>
                  im Supabase SQL Editor aus.
                </div>
              )}

              {detail.user.isAdmin && (
                <div className={styles.adminWarning}>
                  Dieser Account ist als Admin in
                  Supabase eingetragen. Adminaccounts
                  können in der Oberfläche nicht
                  gesperrt werden.
                </div>
              )}

              <div className={styles.tabs}>
                {(
                  [
                    ["filaments", "Filamente", detail.filaments.length],
                    ["orders", "Aufträge", detail.orders.length],
                    ["logs", "Protokoll", detail.logs.length],
                    ["audit", "Adminprotokoll", audit.length],
                  ] as Array<[
                    AdminTab,
                    string,
                    number,
                  ]>
                ).map(([id, label, count]) => (
                  <button
                    className={
                      activeTab === id
                        ? styles.tabActive
                        : ""
                    }
                    type="button"
                    key={id}
                    onClick={() => setActiveTab(id)}
                  >
                    {label}
                    <span>{count}</span>
                  </button>
                ))}
              </div>

              {activeTab === "filaments" && (
                <div className={styles.tabContent}>
                  {detail.filaments.length === 0 ? (
                    <p className={styles.emptyState}>
                      Dieser Nutzer besitzt keine
                      Filamente.
                    </p>
                  ) : (
                    <div className={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>Filament</th>
                            <th>EAN</th>
                            <th>Bestand</th>
                            <th>Lagerort</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {detail.filaments.map(
                            (filament) => (
                              <tr key={filament.id}>
                                <td>
                                  <strong>
                                    {filament.manufacturer}{" "}
                                    {filament.material}
                                  </strong>
                                  <small>
                                    {filament.color} ·{" "}
                                    {filament.weight_per_roll} g
                                  </small>
                                </td>
                                <td>
                                  <code>
                                    {filament.barcode}
                                  </code>
                                </td>
                                <td>
                                  <span
                                    className={
                                      filament.stock <=
                                      filament.minimum_stock
                                        ? styles.lowStock
                                        : styles.goodStock
                                    }
                                  >
                                    {filament.stock} Rollen
                                  </span>
                                </td>
                                <td>
                                  {filament.location || "–"}
                                </td>
                                <td>
                                  <button
                                    className={styles.editButton}
                                    type="button"
                                    onClick={() =>
                                      startFilamentEdit(
                                        filament,
                                      )
                                    }
                                  >
                                    Korrigieren
                                  </button>
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "orders" && (
                <div className={styles.tabContent}>
                  {detail.ordersAvailable && (
                    <section
                      className={
                        styles.orderSummaryGrid
                      }
                      aria-label="Auftragsübersicht des Kunden"
                    >
                      <article>
                        <span>Offen</span>
                        <strong>
                          {selectedOrderSummary.open}
                        </strong>
                        <small>
                          Noch nicht begonnen
                        </small>
                      </article>
                      <article>
                        <span>In Arbeit</span>
                        <strong>
                          {selectedOrderSummary.inProgress}
                        </strong>
                        <small>
                          Aktive Aufträge
                        </small>
                      </article>
                      <article>
                        <span>Überfällig</span>
                        <strong
                          className={
                            selectedOrderSummary.overdue > 0
                              ? styles.orderSummaryDanger
                              : ""
                          }
                        >
                          {selectedOrderSummary.overdue}
                        </strong>
                        <small>
                          Termin überschritten
                        </small>
                      </article>
                      <article>
                        <span>Erledigt</span>
                        <strong>
                          {selectedOrderSummary.completed}
                        </strong>
                        <small>
                          Abgeschlossene Aufträge
                        </small>
                      </article>
                    </section>
                  )}

                  {!detail.ordersAvailable ? (
                    <div className={styles.featurePending}>
                      <strong>
                        Auftragssystem noch nicht
                        installiert
                      </strong>
                      <p>
                        Der Adminbereich ist dafür
                        vorbereitet. Sobald die Tabelle
                        <code> orders </code>
                        mit Benutzerzuordnung existiert,
                        werden die Aufträge hier
                        automatisch angezeigt.
                      </p>
                    </div>
                  ) : detail.orders.length === 0 ? (
                    <p className={styles.emptyState}>
                      Dieser Nutzer besitzt keine
                      Aufträge.
                    </p>
                  ) : (
                    <div className={styles.orderGrid}>
                      {detail.orders.map(
                        (order, index) => (
                          <article key={String(order.id ?? index)}>
                            <strong>
                              {orderTitle(order, index)}
                            </strong>
                            {Object.entries(order)
                              .filter(
                                ([key]) =>
                                  key !== "user_id",
                              )
                              .slice(0, 10)
                              .map(([key, value]) => (
                                <p key={key}>
                                  <span>{key}</span>
                                  <b>
                                    {value === null ||
                                    value === undefined
                                      ? "–"
                                      : typeof value ===
                                            "object"
                                        ? JSON.stringify(
                                            value,
                                          )
                                        : String(value)}
                                  </b>
                                </p>
                              ))}
                          </article>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "logs" && (
                <div className={styles.tabContent}>
                  {detail.logs.length === 0 ? (
                    <p className={styles.emptyState}>
                      Kein Protokoll vorhanden.
                    </p>
                  ) : (
                    <div className={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>Zeitpunkt</th>
                            <th>Aktion</th>
                            <th>Filament</th>
                            <th>Bestand danach</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {detail.logs.map((log) => (
                            <tr key={log.id}>
                              <td>
                                {formatDate(log.created_at)}
                              </td>
                              <td>
                                <span
                                  className={
                                    log.action === "in"
                                      ? styles.logIn
                                      : styles.logOut
                                  }
                                >
                                  {log.action === "in"
                                    ? "Eingelagert"
                                    : "Entnommen"}
                                </span>
                                <small>{log.source}</small>
                              </td>
                              <td>
                                <strong>
                                  {log.filament_name}
                                </strong>
                                <small>{log.barcode}</small>
                              </td>
                              <td>
                                {log.stock_after}
                              </td>
                              <td>
                                <button
                                  className={styles.deleteButton}
                                  type="button"
                                  disabled={saving}
                                  onClick={() =>
                                    void deleteLog(log)
                                  }
                                >
                                  Fehler korrigieren
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "audit" && (
                <div className={styles.tabContent}>
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>Zeitpunkt</th>
                          <th>Admin</th>
                          <th>Aktion</th>
                          <th>Ziel</th>
                          <th>Grund</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.map((entry) => (
                          <tr key={entry.id}>
                            <td>
                              {formatDate(entry.created_at)}
                            </td>
                            <td>{entry.adminEmail}</td>
                            <td>
                              <code>{entry.action}</code>
                            </td>
                            <td>
                              {entry.targetEmail ?? "System"}
                            </td>
                            <td>{entry.reason}</td>
                            <td>
                              <span
                                className={`${styles.auditStatus} ${
                                  entry.status === "success"
                                    ? styles.auditSuccess
                                    : entry.status === "failed"
                                      ? styles.auditFailed
                                      : styles.auditPending
                                }`}
                              >
                                {entry.status}
                              </span>
                              {entry.error_message && (
                                <small>
                                  {entry.error_message}
                                </small>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {editingFilament && (
        <div className={styles.modalBackdrop}>
          <form
            className={styles.editModal}
            onSubmit={(event) =>
              void saveFilamentCorrection(event)
            }
          >
            <div className={styles.modalHeading}>
              <div>
                <span>Supportkorrektur</span>
                <h2>Filament bearbeiten</h2>
              </div>
              <button
                type="button"
                aria-label="Schließen"
                onClick={() =>
                  setEditingFilament(null)
                }
              >
                ×
              </button>
            </div>

            <div className={styles.editGrid}>
              <label>
                EAN
                <input
                  value={
                    editingFilament.form.barcode
                  }
                  onChange={(event) =>
                    setEditField(
                      "barcode",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label>
                Hersteller
                <input
                  value={
                    editingFilament.form.manufacturer
                  }
                  onChange={(event) =>
                    setEditField(
                      "manufacturer",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label>
                Material
                <input
                  value={
                    editingFilament.form.material
                  }
                  onChange={(event) =>
                    setEditField(
                      "material",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label>
                Farbe
                <input
                  value={editingFilament.form.color}
                  onChange={(event) =>
                    setEditField(
                      "color",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label>
                Gewicht pro Rolle
                <input
                  type="number"
                  min="1"
                  value={
                    editingFilament.form.weightPerRoll
                  }
                  onChange={(event) =>
                    setEditField(
                      "weightPerRoll",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label>
                Lagerort
                <input
                  value={
                    editingFilament.form.location
                  }
                  onChange={(event) =>
                    setEditField(
                      "location",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label>
                Mindestbestand
                <input
                  type="number"
                  min="0"
                  value={
                    editingFilament.form.minimumStock
                  }
                  onChange={(event) =>
                    setEditField(
                      "minimumStock",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label>
                Aktueller Bestand
                <input
                  type="number"
                  min="0"
                  value={editingFilament.form.stock}
                  onChange={(event) =>
                    setEditField(
                      "stock",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label className={styles.fullField}>
                Bestelllink
                <input
                  value={
                    editingFilament.form.orderLink
                  }
                  onChange={(event) =>
                    setEditField(
                      "orderLink",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label className={styles.fullField}>
                Bild-URL
                <input
                  value={editingFilament.form.imageUrl}
                  onChange={(event) =>
                    setEditField(
                      "imageUrl",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label className={styles.fullField}>
                Supportgrund · Pflichtfeld
                <textarea
                  required
                  minLength={5}
                  value={editingFilament.form.reason}
                  onChange={(event) =>
                    setEditField(
                      "reason",
                      event.target.value,
                    )
                  }
                  placeholder="Was wird korrigiert und warum?"
                />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() =>
                  setEditingFilament(null)
                }
              >
                Abbrechen
              </button>
              <button
                className={styles.saveButton}
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Wird gespeichert …"
                  : "Korrektur speichern"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
