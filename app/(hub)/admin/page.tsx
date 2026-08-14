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
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  MAINTENANCE_AREAS,
  resolveMaintenance,
  type MaintenanceArea,
  type MaintenanceMode,
  type MaintenanceRule,
} from "@/components/philamentix/maintenance";

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
  isBetaTester: boolean;
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

type RollMessageSpeed =
  | "fast"
  | "normal"
  | "slow"
  | "very_slow";

type AdminReleaseConfig = {
  id: number;
  public_channel: string;
  public_version: string;
  public_message: string;
  public_message_enabled: boolean;
  roll_message_speed?: RollMessageSpeed;
  beta_channel: string;
  beta_version: string;
  beta_message: string;
  beta_message_enabled: boolean;
  beta_release_enabled: boolean;
  updated_at: string;
};

type MaintenanceTarget = "global" | "selected";
type MaintenanceChoice = MaintenanceMode | "inherit";

type ReleaseForm = {
  publicChannel: string;
  publicVersion: string;
  publicMessage: string;
  publicMessageEnabled: boolean;
  rollMessageSpeed: RollMessageSpeed;
  betaChannel: string;
  betaVersion: string;
  betaMessage: string;
  betaMessageEnabled: boolean;
  betaReleaseEnabled: boolean;
};

const EMPTY_RELEASE_FORM: ReleaseForm = {
  publicChannel: "PROD",
  publicVersion: "1.0",
  publicMessage: "",
  publicMessageEnabled: false,
  rollMessageSpeed: "normal",
  betaChannel: "BETA",
  betaVersion: "",
  betaMessage: "",
  betaMessageEnabled: false,
  betaReleaseEnabled: false,
};

type BetaVersionOption = {
  version: string;
  title: string;
  description: string;
};

const BETA_VERSION_OPTIONS: BetaVersionOption[] = [
  {
    version: "18.0",
    title: "Produktionszentrum",
    description: "Produktionsboard, Jobs und Grundworkflow",
  },
  {
    version: "18.1",
    title: "Drucker-Flotte",
    description: "Maschinenpark, Druckstunden und Wartung",
  },
  {
    version: "18.2",
    title: "Material & Smart Queue",
    description: "Reservierungen, Verfügbarkeit und Produktionsplanung",
  },
  {
    version: "18.3",
    title: "Qualitätskontrolle",
    description: "QS-Checklisten, Fehlergründe und Nachdrucke",
  },
  {
    version: "18.4",
    title: "Etiketten & QR",
    description: "Produktionsetiketten, QR-Scan und Druckhistorie",
  },
];

function compareReleaseVersions(left: string, right: string): number {
  const a = left
    .trim()
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const b = right
    .trim()
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  return 0;
}

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
    isBetaTester: boolean;
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

type AdminSection =
  | "users"
  | "release"
  | "maintenance"
  | "system";

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

export default function AdminPage() {
  const {
    isAdmin,
    adminRoleReady,
    user: currentUser,
    refreshReleaseInfo,
  } = useHub();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] =
    useState("");
  const [detail, setDetail] =
    useState<UserDetail | null>(null);
  const [audit, setAudit] = useState<AdminAudit[]>([]);
  const [releaseForm, setReleaseForm] =
    useState<ReleaseForm>(EMPTY_RELEASE_FORM);
  const [savedBetaVersion, setSavedBetaVersion] =
    useState("");
  const [releaseLoaded, setReleaseLoaded] =
    useState(false);
  const [releaseLoading, setReleaseLoading] =
    useState(false);
  const [maintenanceRules, setMaintenanceRules] =
    useState<MaintenanceRule[]>([]);
  const [maintenanceLoaded, setMaintenanceLoaded] =
    useState(false);
  const [maintenanceLoading, setMaintenanceLoading] =
    useState(false);
  const [maintenanceTarget, setMaintenanceTarget] =
    useState<MaintenanceTarget>("global");
  const [maintenanceMessage, setMaintenanceMessage] =
    useState(DEFAULT_MAINTENANCE_MESSAGE);
  const [adminSection, setAdminSection] =
    useState<AdminSection>("users");
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

  const loadRelease = useCallback(async () => {
    setReleaseLoading(true);

    try {
      const result = await adminFetch<{
        release: AdminReleaseConfig;
      }>("/api/admin/releases");
      const release = result.release;

      setReleaseForm({
        publicChannel: release.public_channel,
        publicVersion: release.public_version,
        publicMessage: release.public_message,
        publicMessageEnabled:
          release.public_message_enabled,
        rollMessageSpeed:
          release.roll_message_speed ?? "normal",
        betaChannel: release.beta_channel,
        betaVersion: release.beta_version,
        betaMessage: release.beta_message,
        betaMessageEnabled:
          release.beta_message_enabled,
        betaReleaseEnabled:
          release.beta_release_enabled,
      });
      setSavedBetaVersion(release.beta_version);
      setReleaseLoaded(true);
    } finally {
      setReleaseLoading(false);
    }
  }, [adminFetch]);

  const loadMaintenance = useCallback(async () => {
    setMaintenanceLoading(true);

    try {
      const result = await adminFetch<{
        rules: MaintenanceRule[];
      }>("/api/admin/maintenance");
      setMaintenanceRules(result.rules ?? []);
      setMaintenanceLoaded(true);
    } finally {
      setMaintenanceLoading(false);
    }
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
    const savedSection = window.localStorage.getItem(
      "philamentix-admin-section",
    );

    if (
      savedSection === "users" ||
      savedSection === "release" ||
      savedSection === "maintenance" ||
      savedSection === "system"
    ) {
      setAdminSection(savedSection);
    }
  }, []);

  function changeAdminSection(section: AdminSection) {
    setAdminSection(section);
    window.localStorage.setItem(
      "philamentix-admin-section",
      section,
    );
  }

  useEffect(() => {
    if (!adminRoleReady || !isAdmin) {
      return;
    }

    void Promise.all([
      loadUsers(),
      loadAudit(),
      loadRelease(),
      loadMaintenance(),
    ]).catch(
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
    loadRelease,
    loadMaintenance,
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

  useEffect(() => {
    const targetRule = maintenanceRules.find((rule) => {
      if (rule.mode !== "maintenance") {
        return false;
      }

      if (maintenanceTarget === "global") {
        return rule.scope === "global" && rule.user_id === null;
      }

      return (
        rule.scope === "user" &&
        rule.user_id === selectedUserId
      );
    });

    setMaintenanceMessage(
      targetRule?.message?.trim() ||
        DEFAULT_MAINTENANCE_MESSAGE,
    );
  }, [
    maintenanceRules,
    maintenanceTarget,
    selectedUserId,
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
  const onlineCount = users.filter(
    (user) => user.online,
  ).length;
  const betaCount = users.filter(
    (user) => user.isBetaTester,
  ).length;
  const selectedAccount =
    users.find(
      (account) =>
        account.id === selectedUserId,
    ) ?? null;
  const maintenanceTargetUserId =
    maintenanceTarget === "selected"
      ? selectedUserId
      : "";
  const maintenanceTargetLabel =
    maintenanceTarget === "global"
      ? "Alle Accounts"
      : selectedAccount?.displayName ||
        selectedAccount?.email ||
        "Kein Account ausgewählt";
  const maintenanceTargetIsAdmin = Boolean(
    maintenanceTarget === "selected" &&
      selectedAccount?.isAdmin,
  );
  const maintenanceActiveCount = maintenanceRules.filter(
    (rule) => rule.enabled && rule.mode === "maintenance",
  ).length;
  const hiddenActiveCount = maintenanceRules.filter(
    (rule) => rule.enabled && rule.mode === "hidden",
  ).length;
  const restrictedAreaCount =
    maintenanceActiveCount + hiddenActiveCount;
  const maintenanceTargetRuleCount = maintenanceRules.filter(
    (rule) =>
      rule.enabled &&
      rule.mode === "maintenance" &&
      (maintenanceTarget === "global"
        ? rule.scope === "global" && rule.user_id === null
        : rule.scope === "user" &&
          rule.user_id === maintenanceTargetUserId),
  ).length;

  function directMaintenanceRule(
    area: MaintenanceArea,
  ): MaintenanceRule | null {
    return (
      maintenanceRules.find((rule) => {
        if (rule.area !== area) {
          return false;
        }

        if (maintenanceTarget === "global") {
          return (
            rule.scope === "global" &&
            rule.user_id === null
          );
        }

        return (
          rule.scope === "user" &&
          rule.user_id === maintenanceTargetUserId
        );
      }) ?? null
    );
  }

  function directMaintenanceChoice(
    area: MaintenanceArea,
  ): MaintenanceChoice {
    return directMaintenanceRule(area)?.mode ?? "inherit";
  }

  function effectiveMaintenanceForTarget(
    area: MaintenanceArea,
  ) {
    return resolveMaintenance(
      maintenanceRules,
      maintenanceTarget === "selected"
        ? maintenanceTargetUserId
        : "__global_preview__",
      area,
    );
  }

  async function reloadEverything() {
    await Promise.all([
      loadUsers(),
      selectedUserId
        ? loadUserDetail(selectedUserId)
        : Promise.resolve(),
      loadAudit(),
      loadRelease(),
      loadMaintenance(),
    ]);
  }

  function setReleaseField<K extends keyof ReleaseForm>(
    key: K,
    value: ReleaseForm[K],
  ) {
    setReleaseForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function switchBetaVersion(nextVersion: string) {
    const currentVersion = savedBetaVersion.trim();
    const targetVersion = nextVersion.trim();

    if (!targetVersion || targetVersion === currentVersion) {
      return;
    }

    const isDowngrade =
      currentVersion &&
      compareReleaseVersions(
        targetVersion,
        currentVersion,
      ) < 0;

    if (
      isDowngrade &&
      !window.confirm(
        `Beta von ${currentVersion} auf ${targetVersion} downgraden?\n\nNeuere Beta-Module werden nur ausgeblendet. Bereits gespeicherte Daten bleiben vollständig erhalten.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await adminFetch("/api/admin/releases", {
        method: "PATCH",
        body: JSON.stringify({
          action: "setBetaVersion",
          betaVersion: targetVersion,
        }),
      });

      setMessage(
        `Beta ${targetVersion} ist jetzt aktiv. Beta-Tester erhalten die Modulfreigabe automatisch.`,
      );

      await Promise.all([
        loadRelease(),
        loadAudit(),
        refreshReleaseInfo(),
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Beta-Version konnte nicht gewechselt werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveReleaseSettings(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const nextBetaVersion = releaseForm.betaVersion.trim();
    const previousBetaVersion = savedBetaVersion.trim();
    const isDowngrade =
      nextBetaVersion &&
      previousBetaVersion &&
      compareReleaseVersions(
        nextBetaVersion,
        previousBetaVersion,
      ) < 0;

    if (
      isDowngrade &&
      !window.confirm(
        `Beta von ${previousBetaVersion} auf ${nextBetaVersion} downgraden?\n\nNeuere Beta-Module werden nur ausgeblendet. Bereits gespeicherte Daten bleiben erhalten und erscheinen wieder, sobald du auf eine höhere Beta-Version wechselst.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await adminFetch("/api/admin/releases", {
        method: "PATCH",
        body: JSON.stringify({
          action: "save",
          ...releaseForm,
        }),
      });
      setMessage(
        "Release-Einstellungen wurden gespeichert. Die Sidebar aktualisiert sich automatisch.",
      );
      await Promise.all([
        loadRelease(),
        loadAudit(),
        refreshReleaseInfo(),
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Release-Einstellungen konnten nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function publishBetaRelease() {
    const selectedBetaVersion = releaseForm.betaVersion.trim();
    const activeBetaVersion = savedBetaVersion.trim();

    if (!selectedBetaVersion) {
      setError(
        "Wähle zuerst eine Beta-Version aus.",
      );
      return;
    }

    if (selectedBetaVersion !== activeBetaVersion) {
      setError(
        "Speichere die gewählte Beta-Version zuerst, bevor du sie als Public veröffentlichst.",
      );
      return;
    }

    if (
      !window.confirm(
        `Beta ${activeBetaVersion} wirklich für alle Nutzer veröffentlichen?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await adminFetch("/api/admin/releases", {
        method: "PATCH",
        body: JSON.stringify({
          action: "publishBeta",
        }),
      });
      setMessage(
        `Beta ${activeBetaVersion} wurde als Public-Version veröffentlicht.`,
      );
      await Promise.all([
        loadRelease(),
        loadAudit(),
        refreshReleaseInfo(),
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Beta-Version konnte nicht veröffentlicht werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateMaintenance(
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    if (
      maintenanceTarget === "selected" &&
      !maintenanceTargetUserId
    ) {
      setError("Wähle zuerst einen Account aus.");
      return;
    }

    if (maintenanceTargetIsAdmin) {
      setError(
        "Adminaccounts besitzen absichtlich einen Wartungs-Bypass, damit du dich nicht aussperren kannst.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await adminFetch<{
        rules: MaintenanceRule[];
      }>("/api/admin/maintenance", {
        method: "PATCH",
        body: JSON.stringify({
          targetType:
            maintenanceTarget === "global"
              ? "global"
              : "user",
          userId:
            maintenanceTarget === "selected"
              ? maintenanceTargetUserId
              : undefined,
          message: maintenanceMessage,
          ...payload,
        }),
      });

      setMaintenanceRules(result.rules ?? []);
      setMaintenanceLoaded(true);
      setMessage(successMessage);
      await loadAudit();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Wartungsmodus konnte nicht geändert werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveMaintenanceMessage() {
    await updateMaintenance(
      { action: "updateMessage" },
      `Wartungshinweis für ${maintenanceTargetLabel} wurde aktualisiert.`,
    );
  }

  async function setMaintenanceArea(
    area: MaintenanceArea,
    mode: MaintenanceChoice,
  ) {
    await updateMaintenance(
      {
        action: "setArea",
        area,
        mode,
      },
      `${
        MAINTENANCE_AREAS.find((entry) => entry.id === area)?.label ?? area
      } wurde für ${maintenanceTargetLabel} aktualisiert.`,
    );
  }

  async function setEntireHubMaintenance(
    mode: MaintenanceMode,
  ) {
    const isGlobal = maintenanceTarget === "global";
    const actionText =
      mode === "maintenance"
        ? "in Wartung setzen"
        : mode === "hidden"
          ? "vollständig ausblenden"
          : "vollständig freigeben";

    if (
      !window.confirm(
        `${maintenanceTargetLabel} wirklich ${actionText}?${
          isGlobal && mode !== "available"
            ? " Adminaccounts bleiben erreichbar."
            : ""
        }`,
      )
    ) {
      return;
    }

    await updateMaintenance(
      {
        action: "setAll",
        mode,
      },
      mode === "maintenance"
        ? `${maintenanceTargetLabel}: gesamter Hub ist jetzt im Wartungsmodus.`
        : mode === "hidden"
          ? `${maintenanceTargetLabel}: gesamter Hub ist jetzt ausgeblendet.`
          : `${maintenanceTargetLabel}: gesamter Hub ist jetzt freigegeben.`,
    );
  }

  async function clearMaintenanceOverrides() {
    if (
      !window.confirm(
        maintenanceTarget === "global"
          ? "Alle globalen Wartungsregeln entfernen? Ohne globale Regeln sind Bereiche standardmäßig offen."
          : `Alle accountbezogenen Wartungsregeln für ${maintenanceTargetLabel} entfernen? Danach gelten wieder die globalen Regeln.`,
      )
    ) {
      return;
    }

    await updateMaintenance(
      { action: "clearTarget" },
      maintenanceTarget === "global"
        ? "Alle globalen Wartungsregeln wurden entfernt."
        : `${maintenanceTargetLabel} erbt wieder vollständig die globalen Wartungsregeln.`,
    );
  }

  async function toggleBetaTester() {
    if (!detail) {
      return;
    }

    const enabled = !detail.user.isBetaTester;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await adminFetch(
        `/api/admin/users/${encodeURIComponent(
          detail.user.id,
        )}/beta`,
        {
          method: "PATCH",
          body: JSON.stringify({ enabled }),
        },
      );
      setMessage(
        enabled
          ? "Beta-Testzugang wurde freigeschaltet."
          : "Beta-Testzugang wurde entfernt.",
      );
      await reloadEverything();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Beta-Testzugang konnte nicht geändert werden.",
      );
    } finally {
      setSaving(false);
    }
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

      <nav
        className={styles.adminSectionNav}
        aria-label="Adminbereiche"
      >
        {([
          ["users", "Benutzer"],
          ["release", "Release"],
          ["maintenance", "Wartung"],
          ["system", "System"],
        ] as Array<[AdminSection, string]>).map(
          ([section, label]) => (
            <button
              type="button"
              key={section}
              className={
                adminSection === section
                  ? styles.adminSectionActive
                  : ""
              }
              aria-pressed={adminSection === section}
              onClick={() => changeAdminSection(section)}
            >
              {label}
              {section === "maintenance" &&
                restrictedAreaCount > 0 && (
                  <span>{restrictedAreaCount}</span>
                )}
            </button>
          ),
        )}
      </nav>

      {adminSection === "release" && (
      <section className={styles.releaseManager}>
        <div className={styles.releaseManagerHeading}>
          <div>
            <span>Release Control</span>
            <h2>Versionen & Roll-Message</h2>
            <p>
              Public gilt für alle Nutzer. Beta wird nur
              freigeschalteten Testern angezeigt und kann
              später mit einem Klick veröffentlicht werden.
            </p>
          </div>
          <div className={styles.releaseStatusSummary}>
            <span>PUBLIC</span>
            <strong>
              {releaseForm.publicChannel} // {releaseForm.publicVersion}
            </strong>
            {releaseForm.betaReleaseEnabled &&
              releaseForm.betaVersion.trim() && (
                <small>
                  Beta aktiv: {releaseForm.betaChannel} // {releaseForm.betaVersion}
                </small>
              )}
          </div>
        </div>

        {!releaseLoaded && !releaseLoading ? (
          <div className={styles.releaseSetupWarning}>
            Release-System noch nicht eingerichtet. Führe
            <code>supabase/release_channels_v17_2_2.sql</code>
            einmal im Supabase SQL Editor aus.
          </div>
        ) : (
          <form
            className={styles.releaseForm}
            onSubmit={(event) =>
              void saveReleaseSettings(event)
            }
          >
            <article className={styles.releaseCard}>
              <div className={styles.releaseCardTitle}>
                <div>
                  <span className={styles.publicDot} />
                  <div>
                    <strong>Public / Production</strong>
                    <small>Für alle normalen Nutzer</small>
                  </div>
                </div>
                <label className={styles.releaseToggle}>
                  <input
                    type="checkbox"
                    checked={
                      releaseForm.publicMessageEnabled
                    }
                    onChange={(event) =>
                      setReleaseField(
                        "publicMessageEnabled",
                        event.target.checked,
                      )
                    }
                  />
                  Roll-Message
                </label>
              </div>

              <div className={styles.releaseFields}>
                <label>
                  Kanal / Name
                  <input
                    value={releaseForm.publicChannel}
                    maxLength={24}
                    onChange={(event) =>
                      setReleaseField(
                        "publicChannel",
                        event.target.value,
                      )
                    }
                    placeholder="PROD"
                  />
                </label>
                <label>
                  Version
                  <input
                    value={releaseForm.publicVersion}
                    maxLength={40}
                    onChange={(event) =>
                      setReleaseField(
                        "publicVersion",
                        event.target.value,
                      )
                    }
                    placeholder="1.1"
                  />
                </label>
                <label className={styles.releaseMessageField}>
                  Roll-Message für alle
                  <textarea
                    value={releaseForm.publicMessage}
                    maxLength={500}
                    onChange={(event) =>
                      setReleaseField(
                        "publicMessage",
                        event.target.value,
                      )
                    }
                    placeholder="z. B. Neue Druckbibliothek ist jetzt verfügbar!"
                  />
                </label>
                <label className={styles.releaseSpeedField}>
                  Geschwindigkeit · Public & Beta
                  <select
                    value={releaseForm.rollMessageSpeed}
                    onChange={(event) =>
                      setReleaseField(
                        "rollMessageSpeed",
                        event.target.value as RollMessageSpeed,
                      )
                    }
                    title="Gilt für Public- und Beta-Roll-Messages"
                  >
                    <option value="fast">Schnell · 18 s</option>
                    <option value="normal">Normal · 26 s</option>
                    <option value="slow">Langsam · 34 s</option>
                    <option value="very_slow">Sehr langsam · 45 s</option>
                  </select>
                </label>
              </div>
            </article>

            <article
              className={`${styles.releaseCard} ${styles.betaReleaseCard}`}
            >
              <div className={styles.releaseCardTitle}>
                <div>
                  <span className={styles.betaDot} />
                  <div>
                    <strong>Beta Release</strong>
                    <small>Nur für freigeschaltete Beta-Tester</small>
                  </div>
                </div>
                <label className={styles.releaseToggle}>
                  <input
                    type="checkbox"
                    checked={
                      releaseForm.betaReleaseEnabled
                    }
                    onChange={(event) =>
                      setReleaseField(
                        "betaReleaseEnabled",
                        event.target.checked,
                      )
                    }
                  />
                  Beta aktiv
                </label>
              </div>

              <div className={styles.releaseFields}>
                <label>
                  Kanal / Name
                  <input
                    value={releaseForm.betaChannel}
                    maxLength={24}
                    onChange={(event) =>
                      setReleaseField(
                        "betaChannel",
                        event.target.value,
                      )
                    }
                    placeholder="BETA"
                  />
                </label>
                <div className={styles.betaVersionControl}>
                  <div className={styles.betaVersionControlHeading}>
                    <div>
                      <span>Beta-Version auswählen</span>
                      <small>
                        Klick auf eine Version aktiviert sie sofort.
                        Ein Downgrade blendet neuere Funktionen nur
                        aus; gespeicherte Daten bleiben erhalten.
                      </small>
                    </div>
                    <div className={styles.betaVersionState}>
                      <span>Aktiv</span>
                      <strong>
                        {savedBetaVersion.trim() || "—"}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.betaVersionGrid}>
                    {BETA_VERSION_OPTIONS.map((option) => {
                      const selected =
                        releaseForm.betaVersion === option.version;
                      const active =
                        savedBetaVersion === option.version;
                      const direction = savedBetaVersion.trim()
                        ? compareReleaseVersions(
                            option.version,
                            savedBetaVersion,
                          )
                        : 0;

                      return (
                        <button
                          key={option.version}
                          type="button"
                          className={`${styles.betaVersionOption} ${
                            selected
                              ? styles.betaVersionOptionSelected
                              : ""
                          }`}
                          disabled={saving || releaseLoading || active}
                          onClick={() =>
                            void switchBetaVersion(option.version)
                          }
                        >
                          <div>
                            <strong>{option.version}</strong>
                            {active && (
                              <span
                                className={styles.betaVersionActiveBadge}
                              >
                                AKTIV
                              </span>
                            )}
                          </div>
                          <span>{option.title}</span>
                          <small>{option.description}</small>
                          {!active && savedBetaVersion.trim() && (
                            <em>
                              {direction < 0
                                ? "↩ Downgrade"
                                : direction > 0
                                  ? "↑ Upgrade"
                                  : "Auswählen"}
                            </em>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.betaDataSafetyNotice}>
                    <strong>Datensicherer Versionswechsel</strong>
                    <span>
                      Beim Downgrade werden keine Produktions-,
                      Drucker-, QS-, Material- oder Etikettendaten
                      gelöscht. Die höheren Module werden nur über
                      das Release-Gating ausgeblendet.
                    </span>
                  </div>
                  {!releaseForm.betaReleaseEnabled && (
                    <div className={styles.betaReleaseOffNotice}>
                      <strong>Beta-Release ist deaktiviert</strong>
                      <span>
                        Die gewählte Version wird gespeichert, aber Beta-Tester
                        sehen die Module erst, wenn „Beta-Release aktiv“ eingeschaltet ist.
                      </span>
                    </div>
                  )}
                </div>
                <label className={styles.releaseMessageField}>
                  Beta Roll-Message
                  <textarea
                    value={releaseForm.betaMessage}
                    maxLength={500}
                    onChange={(event) =>
                      setReleaseField(
                        "betaMessage",
                        event.target.value,
                      )
                    }
                    placeholder="z. B. Beta 3.4: Bitte neuen Auftragsworkflow testen."
                  />
                </label>
                <label
                  className={`${styles.releaseToggle} ${styles.betaMessageToggle}`}
                >
                  <input
                    type="checkbox"
                    checked={
                      releaseForm.betaMessageEnabled
                    }
                    onChange={(event) =>
                      setReleaseField(
                        "betaMessageEnabled",
                        event.target.checked,
                      )
                    }
                  />
                  Eigene Roll-Message für Beta-Tester
                </label>
              </div>
            </article>

            <div className={styles.releaseActions}>
              <button
                type="submit"
                disabled={saving || releaseLoading}
              >
                {saving ? "Speichert …" : "Release-Einstellungen speichern"}
              </button>
              <button
                className={styles.publishButton}
                type="button"
                disabled={
                  saving ||
                  releaseLoading ||
                  !releaseForm.betaVersion.trim() ||
                  releaseForm.betaVersion.trim() !==
                    savedBetaVersion.trim()
                }
                onClick={() =>
                  void publishBetaRelease()
                }
              >
                Beta → Public veröffentlichen
              </button>
            </div>
          </form>
        )}
      </section>
      )}

      {adminSection === "maintenance" && (
      <section className={styles.maintenanceManager}>
        <div className={styles.maintenanceHeading}>
          <div>
            <span>Maintenance Control</span>
            <h2>Wartungsmodus</h2>
            <p>
              Bereiche global oder nur für einzelne Accounts öffnen,
              warten oder vollständig ausblenden. Account-Regeln haben
              Vorrang vor globalen Regeln.
            </p>
          </div>
          <div className={styles.maintenanceSummary}>
            <span>AKTIVE EINSCHRÄNKUNGEN</span>
            <strong>{restrictedAreaCount}</strong>
            <small>Wartung {maintenanceActiveCount} · Ausgeblendet {hiddenActiveCount}</small>
          </div>
        </div>

        {!maintenanceLoaded && !maintenanceLoading ? (
          <div className={styles.releaseSetupWarning}>
            Wartungs-Control-Center noch nicht eingerichtet. Führe
            <code>supabase/maintenance_control_v17_2_6.sql</code>
            einmal im Supabase SQL Editor aus.
          </div>
        ) : (
          <>
            <div className={styles.maintenanceTargetBar}>
              <div className={styles.maintenanceTargetSwitch}>
                <button
                  type="button"
                  className={
                    maintenanceTarget === "global"
                      ? styles.maintenanceTargetActive
                      : ""
                  }
                  onClick={() => setMaintenanceTarget("global")}
                >
                  Alle Accounts
                </button>
                <button
                  type="button"
                  className={
                    maintenanceTarget === "selected"
                      ? styles.maintenanceTargetActive
                      : ""
                  }
                  disabled={users.length === 0}
                  onClick={() => setMaintenanceTarget("selected")}
                >
                  Einzelner Account
                </button>
              </div>

              <div className={styles.maintenanceTargetName}>
                <span>Ziel</span>
                {maintenanceTarget === "selected" ? (
                  <select
                    className={styles.maintenanceAccountSelect}
                    value={selectedUserId}
                    onChange={(event) => {
                      setSelectedUserId(event.target.value);
                      setEditingFilament(null);
                    }}
                  >
                    {users.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.displayName || account.email}
                        {account.isAdmin ? " · Admin" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <strong>{maintenanceTargetLabel}</strong>
                )}
                {maintenanceTarget === "selected" && selectedAccount && (
                  <small>{selectedAccount.email}</small>
                )}
              </div>
            </div>

            {maintenanceTargetIsAdmin && (
              <div className={styles.maintenanceAdminBypass}>
                <strong>Admin-Bypass aktiv</strong>
                Dieser Account kann absichtlich nicht in Wartung
                gesperrt werden. So bleibt das Control-Center immer
                erreichbar.
              </div>
            )}

            <div className={styles.maintenanceControls}>
              <div className={styles.maintenanceMessageGroup}>
                <label className={styles.maintenanceMessage}>
                  Wartungshinweis
                  <input
                    value={maintenanceMessage}
                    maxLength={500}
                    disabled={maintenanceTargetIsAdmin}
                    onChange={(event) =>
                      setMaintenanceMessage(event.target.value)
                    }
                    placeholder={DEFAULT_MAINTENANCE_MESSAGE}
                  />
                </label>
                <button
                  type="button"
                  className={styles.maintenanceMessageSave}
                  disabled={
                    saving ||
                    maintenanceTargetIsAdmin ||
                    maintenanceTargetRuleCount === 0
                  }
                  onClick={() => void saveMaintenanceMessage()}
                >
                  Hinweis übernehmen
                </button>
              </div>

              <div className={styles.maintenanceBulkActions}>
                <button
                  type="button"
                  className={styles.maintenanceDangerButton}
                  disabled={saving || maintenanceTargetIsAdmin}
                  onClick={() =>
                    void setEntireHubMaintenance("maintenance")
                  }
                >
                  Gesamten Hub · Wartung
                </button>
                <button
                  type="button"
                  className={styles.maintenanceOpenButton}
                  disabled={saving || maintenanceTargetIsAdmin}
                  onClick={() =>
                    void setEntireHubMaintenance("available")
                  }
                >
                  Gesamten Hub · Offen
                </button>
                <button
                  type="button"
                  className={styles.maintenanceHiddenButton}
                  disabled={saving || maintenanceTargetIsAdmin}
                  onClick={() =>
                    void setEntireHubMaintenance("hidden")
                  }
                >
                  Gesamten Hub · Ausblenden
                </button>
                <button
                  type="button"
                  disabled={saving || maintenanceTargetIsAdmin}
                  onClick={() =>
                    void clearMaintenanceOverrides()
                  }
                >
                  Overrides entfernen
                </button>
              </div>
            </div>

            <div className={styles.maintenanceAreaList}>
              {MAINTENANCE_AREAS.filter(
                (area) => area.id !== "all",
              ).map((area) => {
                const directChoice = directMaintenanceChoice(area.id);
                const effective = effectiveMaintenanceForTarget(area.id);

                return (
                  <article
                    className={styles.maintenanceAreaRow}
                    key={area.id}
                  >
                    <div className={styles.maintenanceAreaInfo}>
                      <div>
                        <strong>{area.label}</strong>
                        <small>{area.description}</small>
                      </div>
                      <span
                        className={
                          effective.hidden
                            ? styles.maintenanceEffectiveHidden
                            : effective.blocked
                              ? styles.maintenanceEffectiveClosed
                              : styles.maintenanceEffectiveOpen
                        }
                      >
                        {effective.hidden
                          ? "Effektiv: Ausgeblendet"
                          : effective.blocked
                            ? "Effektiv: Wartung"
                            : "Effektiv: Offen"}
                      </span>
                    </div>

                    <div className={styles.maintenanceChoices}>
                      {([
                        ["inherit", "Erben"],
                        ["available", "Offen"],
                        ["maintenance", "Wartung"],
                        ["hidden", "Ausblenden"],
                      ] as Array<[MaintenanceChoice, string]>).map(
                        ([choice, label]) => (
                          <button
                            type="button"
                            key={choice}
                            className={`${
                              directChoice === choice
                                ? styles.maintenanceChoiceActive
                                : ""
                            } ${
                              choice === "maintenance" &&
                              directChoice === choice
                                ? styles.maintenanceChoiceDanger
                                : choice === "hidden" &&
                                    directChoice === choice
                                  ? styles.maintenanceChoiceHidden
                                  : ""
                            }`}
                            disabled={
                              saving ||
                              maintenanceTargetIsAdmin ||
                              directChoice === choice
                            }
                            onClick={() =>
                              void setMaintenanceArea(
                                area.id,
                                choice,
                              )
                            }
                          >
                            {label}
                          </button>
                        ),
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <p className={styles.maintenanceHint}>
              <strong>Erben</strong> = keine eigene Regel. Bei einem
              Account greifen dann die globalen Regeln. <strong>Offen</strong>
              überschreibt Wartung oder Ausblenden. <strong>Ausgeblendet</strong>
              entfernt den Bereich aus der Sidebar und sperrt auch direkten
              Zugriff auf die Seite.
            </p>
          </>
        )}
      </section>
      )}

      {adminSection === "system" && (
        <>
          <section className={styles.systemOverview}>
            <div>
              <span>Systemübersicht</span>
              <h2>Hub-Status</h2>
              <p>
                Schneller Überblick über Nutzer, Release, Wartung und
                Online-Status.
              </p>
            </div>
            <div className={styles.systemStatusPills}>
              <span data-ok={releaseLoaded}>
                Release {releaseLoading ? "lädt" : releaseLoaded ? "bereit" : "Setup"}
              </span>
              <span data-ok={maintenanceLoaded}>
                Wartung {maintenanceLoading ? "lädt" : maintenanceLoaded ? "bereit" : "Setup"}
              </span>
              <span data-ok={presenceAvailable === true}>
                Presence {presenceAvailable === null ? "lädt" : presenceAvailable ? "bereit" : "Setup"}
              </span>
            </div>
          </section>

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
          <span>Beta-Tester</span>
          <strong>{betaCount}</strong>
          <small>früher Zugriff</small>
        </article>
        <article>
          <span>Adminaktionen</span>
          <strong>{audit.length}</strong>
          <small>zuletzt geladen</small>
        </article>
      </section>
        </>
      )}

      {adminSection === "users" && (
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
                    {user.isBetaTester
                      ? "Beta · "
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

                  <span
                    className={
                      detail.user.isBetaTester
                        ? styles.betaBadge
                        : styles.standardBadge
                    }
                  >
                    {detail.user.isBetaTester
                      ? "Beta-Tester"
                      : "Standard"}
                  </span>

                  <button
                    className={styles.betaAccessButton}
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void toggleBetaTester()
                    }
                  >
                    {detail.user.isBetaTester
                      ? "Beta entfernen"
                      : "Beta freischalten"}
                  </button>

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
      )}

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
