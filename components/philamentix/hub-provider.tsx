"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

import {
  filamentFormToRow,
  rowToFilament,
  rowToLog,
} from "./mappers";
import {
  filamentLabel,
  normalizeBarcode,
  type BackupData,
  type Filament,
  type FilamentForm,
  type FilamentRow,
  type LogEntry,
  type LogRow,
  type LogSource,
  type StockMode,
} from "./types";

type HubContextValue = {
  user: User | null;
  authReady: boolean;
  loading: boolean;
  busy: boolean;
  error: string;
  filaments: Filament[];
  logs: LogEntry[];
  displayName: string;
  refresh: () => Promise<void>;
  createFilament: (
    form: FilamentForm,
    source?: LogSource,
  ) => Promise<Filament>;
  updateFilament: (
    id: number,
    form: FilamentForm,
  ) => Promise<Filament>;
  deleteFilament: (id: number) => Promise<void>;
  adjustStock: (
    id: number,
    mode: StockMode,
    source?: LogSource,
  ) => Promise<Filament>;
  clearLogs: () => Promise<void>;
  updateProfileName: (name: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
};

const HubContext = createContext<HubContextValue | null>(
  null,
);

function getDisplayName(user: User | null): string {
  if (!user) {
    return "";
  }

  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;

  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  return user.email?.split("@")[0] ?? "Benutzer";
}

function cleanForm(form: FilamentForm): FilamentForm {
  return {
    ...form,
    barcode: normalizeBarcode(form.barcode),
    manufacturer: form.manufacturer.trim(),
    material: form.material.trim(),
    color: form.color.trim(),
    location: form.location.trim(),
    orderLink: form.orderLink.trim(),
    imageUrl: form.imageUrl.trim(),
    weightPerRoll: Math.max(
      1,
      Number(form.weightPerRoll) || 1000,
    ),
    minimumStock: Math.max(
      0,
      Number(form.minimumStock) || 0,
    ),
    stock: Math.max(0, Number(form.stock) || 0),
  };
}

export function HubProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filaments, setFilaments] = useState<
    Filament[]
  >([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const loadDataForUser = useCallback(
    async (userId: string) => {
      setLoading(true);
      setError("");

      const [filamentResult, logResult] =
        await Promise.all([
          supabase
            .from("filaments")
            .select("*")
            .eq("user_id", userId)
            .order("material")
            .order("color"),
          supabase
            .from("filament_logs")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", {
              ascending: false,
            }),
        ]);

      if (filamentResult.error || logResult.error) {
        const message =
          filamentResult.error?.message ??
          logResult.error?.message ??
          "Daten konnten nicht geladen werden.";

        setError(message);
        setLoading(false);
        throw new Error(message);
      }

      setFilaments(
        (filamentResult.data ?? []).map((row) =>
          rowToFilament(row as FilamentRow),
        ),
      );
      setLogs(
        (logResult.data ?? []).map((row) =>
          rowToLog(row as LogRow),
        ),
      );
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data, error: sessionError } =
        await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
      }

      setUser(data.session?.user ?? null);
      setAuthReady(true);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) {
          return;
        }

        setUser(session?.user ?? null);
        setAuthReady(true);
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!user) {
      setFilaments([]);
      setLogs([]);
      setLoading(false);
      return;
    }

    void loadDataForUser(user.id).catch(() => {
      // Fehler wird im Context angezeigt.
    });
  }, [authReady, user, loadDataForUser]);

  const refresh = useCallback(async () => {
    if (!user) {
      return;
    }

    await loadDataForUser(user.id);
  }, [loadDataForUser, user]);

  const writeLog = useCallback(
    async (
      filament: Filament,
      mode: StockMode,
      source: LogSource,
      stockAfter: number,
    ) => {
      if (!user) {
        throw new Error("Nicht angemeldet.");
      }

      const row = {
        id: crypto.randomUUID(),
        user_id: user.id,
        created_at: new Date().toISOString(),
        action: mode,
        source,
        filament_id: filament.id,
        filament_name: filamentLabel(filament),
        barcode: filament.barcode,
        stock_after: stockAfter,
      };

      const { data, error: logError } = await supabase
        .from("filament_logs")
        .insert(row)
        .select("*")
        .single();

      if (logError) {
        throw new Error(logError.message);
      }

      setLogs((current) => [
        rowToLog(data as LogRow),
        ...current,
      ]);
    },
    [user],
  );

  const createFilament = useCallback(
    async (
      form: FilamentForm,
      source: LogSource = "manual",
    ) => {
      if (!user) {
        throw new Error("Nicht angemeldet.");
      }

      const cleaned = cleanForm(form);

      if (
        !cleaned.barcode ||
        !cleaned.manufacturer ||
        !cleaned.material ||
        !cleaned.color
      ) {
        throw new Error(
          "EAN, Hersteller, Material und Farbe sind Pflichtfelder.",
        );
      }

      const duplicate = filaments.some(
        (item) => item.barcode === cleaned.barcode,
      );

      if (duplicate) {
        throw new Error(
          "Dieser Barcode ist in deinem Account bereits vorhanden.",
        );
      }

      setBusy(true);
      setError("");

      try {
        const { data, error: insertError } =
          await supabase
            .from("filaments")
            .insert(
              filamentFormToRow(cleaned, user.id),
            )
            .select("*")
            .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        const created = rowToFilament(
          data as FilamentRow,
        );

        setFilaments((current) =>
          [...current, created].sort((a, b) =>
            `${a.material} ${a.color}`.localeCompare(
              `${b.material} ${b.color}`,
              "de",
            ),
          ),
        );

        if (created.stock > 0) {
          await writeLog(
            created,
            "in",
            source,
            created.stock,
          );
        }

        return created;
      } finally {
        setBusy(false);
      }
    },
    [filaments, user, writeLog],
  );

  const updateFilament = useCallback(
    async (id: number, form: FilamentForm) => {
      if (!user) {
        throw new Error("Nicht angemeldet.");
      }

      const cleaned = cleanForm(form);
      const duplicate = filaments.some(
        (item) =>
          item.id !== id &&
          item.barcode === cleaned.barcode,
      );

      if (duplicate) {
        throw new Error(
          "Dieser Barcode ist in deinem Account bereits vorhanden.",
        );
      }

      setBusy(true);
      setError("");

      try {
        const { data, error: updateError } =
          await supabase
            .from("filaments")
            .update(
              filamentFormToRow(cleaned, user.id),
            )
            .eq("id", id)
            .eq("user_id", user.id)
            .select("*")
            .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        const updated = rowToFilament(
          data as FilamentRow,
        );

        setFilaments((current) =>
          current.map((item) =>
            item.id === id ? updated : item,
          ),
        );

        return updated;
      } finally {
        setBusy(false);
      }
    },
    [filaments, user],
  );

  const deleteFilament = useCallback(
    async (id: number) => {
      if (!user) {
        throw new Error("Nicht angemeldet.");
      }

      setBusy(true);
      setError("");

      try {
        const { error: deleteError } = await supabase
          .from("filaments")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        setFilaments((current) =>
          current.filter((item) => item.id !== id),
        );
      } finally {
        setBusy(false);
      }
    },
    [user],
  );

  const adjustStock = useCallback(
    async (
      id: number,
      mode: StockMode,
      source: LogSource = "manual",
    ) => {
      if (!user) {
        throw new Error("Nicht angemeldet.");
      }

      const current = filaments.find(
        (item) => item.id === id,
      );

      if (!current) {
        throw new Error("Filament nicht gefunden.");
      }

      if (mode === "out" && current.stock <= 0) {
        throw new Error(
          "Der Bestand ist bereits bei null.",
        );
      }

      const nextStock =
        mode === "in"
          ? current.stock + 1
          : current.stock - 1;

      setBusy(true);
      setError("");

      try {
        const { data, error: updateError } =
          await supabase
            .from("filaments")
            .update({ stock: nextStock })
            .eq("id", id)
            .eq("user_id", user.id)
            .select("*")
            .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        const updated = rowToFilament(
          data as FilamentRow,
        );

        setFilaments((items) =>
          items.map((item) =>
            item.id === id ? updated : item,
          ),
        );

        await writeLog(
          updated,
          mode,
          source,
          nextStock,
        );

        return updated;
      } finally {
        setBusy(false);
      }
    },
    [filaments, user, writeLog],
  );

  const clearLogs = useCallback(async () => {
    if (!user) {
      throw new Error("Nicht angemeldet.");
    }

    setBusy(true);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("filament_logs")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setLogs([]);
    } finally {
      setBusy(false);
    }
  }, [user]);

  const updateProfileName = useCallback(
    async (name: string) => {
      const cleaned = name.trim();

      if (!cleaned) {
        throw new Error("Bitte einen Namen eingeben.");
      }

      const { data, error: updateError } =
        await supabase.auth.updateUser({
          data: {
            full_name: cleaned,
            name: cleaned,
          },
        });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setUser(data.user);
    },
    [],
  );

  const updatePassword = useCallback(
    async (password: string) => {
      if (password.length < 8) {
        throw new Error(
          "Das Passwort muss mindestens 8 Zeichen lang sein.",
        );
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        throw new Error(updateError.message);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    const { error: signOutError } =
      await supabase.auth.signOut();

    if (signOutError) {
      throw new Error(signOutError.message);
    }
  }, []);

  const exportData = useCallback(() => {
    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      filaments: filaments.map(
        ({ id: _id, userId: _userId, ...rest }) =>
          rest,
      ),
      logs: logs.map(
        ({
          id: _id,
          userId: _userId,
          filamentId: _filamentId,
          ...rest
        }) => rest,
      ),
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `philamentix-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filaments, logs]);

  const importData = useCallback(
    async (file: File) => {
      if (!user) {
        throw new Error("Nicht angemeldet.");
      }

      const confirmed = window.confirm(
        "Das Backup ersetzt deine aktuellen Filamente und Protokolle. Fortfahren?",
      );

      if (!confirmed) {
        return;
      }

      const parsed = JSON.parse(
        await file.text(),
      ) as Partial<BackupData>;

      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.filaments) ||
        !Array.isArray(parsed.logs)
      ) {
        throw new Error("Ungültiges Backup-Format.");
      }

      setBusy(true);
      setError("");

      try {
        const { error: deleteLogsError } =
          await supabase
            .from("filament_logs")
            .delete()
            .eq("user_id", user.id);

        if (deleteLogsError) {
          throw new Error(deleteLogsError.message);
        }

        const { error: deleteFilamentsError } =
          await supabase
            .from("filaments")
            .delete()
            .eq("user_id", user.id);

        if (deleteFilamentsError) {
          throw new Error(deleteFilamentsError.message);
        }

        const cleanFilaments = parsed.filaments.map(
          (item) =>
            filamentFormToRow(
              cleanForm({
                barcode: item.barcode ?? "",
                manufacturer: item.manufacturer ?? "",
                material: item.material ?? "",
                color: item.color ?? "",
                weightPerRoll:
                  item.weightPerRoll ?? 1000,
                location: item.location ?? "",
                minimumStock:
                  item.minimumStock ?? 1,
                stock: item.stock ?? 0,
                orderLink: item.orderLink ?? "",
                imageUrl: item.imageUrl ?? "",
              }),
              user.id,
            ),
        );

        const { data: insertedRows, error: insertError } =
          cleanFilaments.length > 0
            ? await supabase
                .from("filaments")
                .insert(cleanFilaments)
                .select("*")
            : { data: [], error: null };

        if (insertError) {
          throw new Error(insertError.message);
        }

        const inserted = (insertedRows ?? []).map(
          (row) => rowToFilament(row as FilamentRow),
        );
        const idByBarcode = new Map(
          inserted.map((item) => [item.barcode, item.id]),
        );

        const logRows = parsed.logs.map((entry) => ({
          id: crypto.randomUUID(),
          user_id: user.id,
          created_at:
            entry.timestamp ?? new Date().toISOString(),
          action: entry.action ?? "in",
          source: entry.source ?? "manual",
          filament_id:
            idByBarcode.get(entry.barcode ?? "") ?? null,
          filament_name:
            entry.filamentName ?? "Unbekanntes Filament",
          barcode: entry.barcode ?? "",
          stock_after: entry.stockAfter ?? 0,
        }));

        if (logRows.length > 0) {
          const { error: logInsertError } = await supabase
            .from("filament_logs")
            .insert(logRows);

          if (logInsertError) {
            throw new Error(logInsertError.message);
          }
        }

        await loadDataForUser(user.id);
      } finally {
        setBusy(false);
      }
    },
    [loadDataForUser, user],
  );

  const value = useMemo<HubContextValue>(
    () => ({
      user,
      authReady,
      loading,
      busy,
      error,
      filaments,
      logs,
      displayName: getDisplayName(user),
      refresh,
      createFilament,
      updateFilament,
      deleteFilament,
      adjustStock,
      clearLogs,
      updateProfileName,
      updatePassword,
      signOut,
      exportData,
      importData,
    }),
    [
      user,
      authReady,
      loading,
      busy,
      error,
      filaments,
      logs,
      refresh,
      createFilament,
      updateFilament,
      deleteFilament,
      adjustStock,
      clearLogs,
      updateProfileName,
      updatePassword,
      signOut,
      exportData,
      importData,
    ],
  );

  return (
    <HubContext.Provider value={value}>
      {children}
    </HubContext.Provider>
  );
}

export function useHub(): HubContextValue {
  const value = useContext(HubContext);

  if (!value) {
    throw new Error(
      "useHub muss innerhalb des HubProvider verwendet werden.",
    );
  }

  return value;
}
