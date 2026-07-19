"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { supabase } from "@/lib/supabase";

function normalizeFilamentEan(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

type Mode = "in" | "out";
type StatisticsRange = "7" | "30" | "90" | "all";
type AuthMode = "login" | "signup" | "forgot";
type Page = "dashboard" | "statistics" | "storage" | "filaments" | "log" | "profile" | "settings";

type Filament = {
  id: number;
  barcode: string;
  manufacturer: string;
  material: string;
  color: string;
  weightPerRoll: number;
  location: string;
  minimumStock: number;
  stock: number;
  orderLink: string;
};

type FilamentForm = Omit<Filament, "id">;

type LogEntry = {
  id: string;
  timestamp: string;
  action: "in" | "out";
  source: "scan" | "manual";
  filamentName: string;
  barcode: string;
  stockAfter: number;
};

type BackupData = {
  version: 1;
  exportedAt: string;
  filaments: Filament[];
  logs: LogEntry[];
};

const STORAGE_KEY = "printos-filaments";
const LOG_STORAGE_KEY = "printos-filament-log";

const emptyForm: FilamentForm = {
  barcode: "",
  manufacturer: "",
  material: "PLA",
  color: "",
  weightPerRoll: 1000,
  location: "",
  minimumStock: 1,
  stock: 0,
  orderLink: "",
};

const exampleFilaments: Filament[] = [
  {
    id: 1,
    barcode: "4061234567890",
    manufacturer: "Bambu Lab",
    material: "PETG",
    color: "Schwarz",
    weightPerRoll: 1000,
    location: "Regal A2",
    minimumStock: 2,
    stock: 3,
    orderLink: "",
  },
];

type FilamentRow = {
  id: number;
  barcode: string;
  manufacturer: string;
  material: string;
  color: string;
  weight_per_roll: number;
  location: string;
  minimum_stock: number;
  stock: number;
  order_link: string;
};

type FilamentCatalogRow = {
  barcode: string;
  manufacturer: string;
  material: string;
  color: string;
  weight_per_roll: number;
  price: number | null;
  variant: string | null;
};

type LogRow = {
  id: string;
  created_at: string;
  action: "in" | "out";
  source: "scan" | "manual";
  filament_name: string;
  barcode: string;
  stock_after: number;
};

function rowToFilament(row: FilamentRow): Filament {
  return {
    id: row.id,
    barcode: row.barcode,
    manufacturer: row.manufacturer,
    material: row.material,
    color: row.color,
    weightPerRoll: row.weight_per_roll,
    location: row.location,
    minimumStock: row.minimum_stock,
    stock: row.stock,
    orderLink: row.order_link,
  };
}

function rowToLog(row: LogRow): LogEntry {
  return {
    id: row.id,
    timestamp: row.created_at,
    action: row.action,
    source: row.source,
    filamentName: row.filament_name,
    barcode: row.barcode,
    stockAfter: row.stock_after,
  };
}

function filamentToInsert(filament: FilamentForm) {
  return {
    barcode: filament.barcode,
    manufacturer: filament.manufacturer,
    material: filament.material,
    color: filament.color,
    weight_per_roll: filament.weightPerRoll,
    location: filament.location,
    minimum_stock: filament.minimumStock,
    stock: filament.stock,
    order_link: filament.orderLink,
  };
}

const STATISTICS_REFERENCE_TIME = Date.now();

function createLogEntry(
  action: "in" | "out",
  filament: Filament,
  stockAfter: number,
  source: "scan" | "manual",
): LogEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    source,
    filamentName: `${filament.manufacturer} ${filament.material} ${filament.color}`,
    barcode: filament.barcode,
    stockAfter,
  };
}

function subscribeToHydration() {
  return () => {};
}

function getClientHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

function getDisplayName(
  user:
    | {
        email?: string;
        user_metadata?: Record<string, unknown>;
      }
    | null
    | undefined,
) {
  if (!user) {
    return "";
  }

  const metadata = user.user_metadata ?? {};

  const metadataName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : "";

  if (metadataName.trim()) {
    return metadataName.trim();
  }

  return user.email?.split("@")[0] ?? "Benutzer";
}

export default function Home() {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const [activePage, setActivePage] =
    useState<Page>("dashboard");

  const [mode, setMode] = useState<Mode>("in");
  const [barcode, setBarcode] = useState("");
  const [message, setMessage] =
    useState("Scanner bereit.");

  const [filaments, setFilaments] =
    useState<Filament[]>([]);

  const [logs, setLogs] =
    useState<LogEntry[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [databaseError, setDatabaseError] =
    useState("");

  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] =
    useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [signupName, setSignupName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] =
    useState("");
  const [loginError, setLoginError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authMode, setAuthMode] =
    useState<AuthMode>("login");
  const [isLoggingIn, setIsLoggingIn] =
    useState(false);
  const [isGoogleLoading, setIsGoogleLoading] =
    useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] =
    useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] =
    useState("");
  const [passwordUpdateMessage, setPasswordUpdateMessage] =
    useState("");

  const [profileName, setProfileName] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profilePasswordConfirm, setProfilePasswordConfirm] =
    useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isProfileSaving, setIsProfileSaving] =
    useState(false);

  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [form, setForm] =
    useState<FilamentForm>(emptyForm);

  const [search, setSearch] = useState("");
  const [unknownBarcode, setUnknownBarcode] = useState("");
  const [selectedMaterial, setSelectedMaterial] =
    useState<string | null>(null);

  const [statisticsRange, setStatisticsRange] =
    useState<StatisticsRange>("30");

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef({
    barcode: "",
    timestamp: 0,
  });

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data, error } =
        await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        setLoginError(error.message);
      }

      const sessionName =
        getDisplayName(data.session?.user);

      setUserEmail(
        data.session?.user.email ?? null,
      );
      setUserName(sessionName);
      setProfileName(sessionName);
      setAuthReady(true);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) {
          return;
        }

        if (event === "PASSWORD_RECOVERY") {
          setIsPasswordRecovery(true);
          setPasswordUpdateMessage("");
          setLoginError("");
        }

        const sessionName =
          getDisplayName(session?.user);

        setUserEmail(
          session?.user.email ?? null,
        );
        setUserName(sessionName);
        setProfileName(sessionName);
        setAuthReady(true);

        if (!session) {
          setUserName("");
          setProfileName("");
          setFilaments([]);
          setLogs([]);
          setIsLoading(false);
        }
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !userEmail) {
      return;
    }

    let cancelled = false;

    async function loadDatabase() {
      setIsLoading(true);
      setDatabaseError("");

      const [
        filamentResponse,
        logResponse,
      ] = await Promise.all([
        supabase
          .from("filaments")
          .select("*")
          .order("material")
          .order("color"),
        supabase
          .from("filament_logs")
          .select("*")
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (
        filamentResponse.error ||
        logResponse.error
      ) {
        if (!cancelled) {
          setDatabaseError(
            filamentResponse.error?.message ??
              logResponse.error?.message ??
              "Datenbank konnte nicht geladen werden.",
          );
          setIsLoading(false);
        }

        return;
      }

      let loadedFilaments = (
        filamentResponse.data ?? []
      ).map((row) =>
        rowToFilament(row as FilamentRow),
      );

      let loadedLogs = (
        logResponse.data ?? []
      ).map((row) => rowToLog(row as LogRow));

      if (loadedFilaments.length === 0) {
        let localFilaments = exampleFilaments;
        let localLogs: LogEntry[] = [];

        const savedFilaments =
          window.localStorage.getItem(STORAGE_KEY);

        const savedLogs =
          window.localStorage.getItem(LOG_STORAGE_KEY);

        try {
          if (savedFilaments) {
            localFilaments = JSON.parse(
              savedFilaments,
            ) as Filament[];
          }

          if (savedLogs) {
            localLogs = JSON.parse(
              savedLogs,
            ) as LogEntry[];
          }
        } catch {
          localFilaments = exampleFilaments;
          localLogs = [];
        }

        const insertResponse = await supabase
          .from("filaments")
          .insert(
            localFilaments.map((filament) =>
              filamentToInsert(filament),
            ),
          )
          .select("*");

        if (insertResponse.error) {
          if (!cancelled) {
            setDatabaseError(
              `Lokale Daten konnten nicht übernommen werden: ${insertResponse.error.message}`,
            );
            setIsLoading(false);
          }

          return;
        }

        loadedFilaments = (
          insertResponse.data ?? []
        ).map((row) =>
          rowToFilament(row as FilamentRow),
        );

        if (localLogs.length > 0) {
          const idByBarcode = new Map(
            loadedFilaments.map((filament) => [
              filament.barcode,
              filament.id,
            ]),
          );

          const logInsertResponse = await supabase
            .from("filament_logs")
            .insert(
              localLogs.map((entry) => ({
                id: entry.id,
                created_at: entry.timestamp,
                action: entry.action,
                source: entry.source,
                filament_id:
                  idByBarcode.get(entry.barcode) ??
                  null,
                filament_name:
                  entry.filamentName,
                barcode: entry.barcode,
                stock_after: entry.stockAfter,
              })),
            )
            .select("*");

          if (!logInsertResponse.error) {
            loadedLogs = (
              logInsertResponse.data ?? []
            )
              .map((row) =>
                rowToLog(row as LogRow),
              )
              .sort(
                (a, b) =>
                  new Date(
                    b.timestamp,
                  ).getTime() -
                  new Date(
                    a.timestamp,
                  ).getTime(),
              );
          }
        }
      }

      if (!cancelled) {
        setFilaments(loadedFilaments);
        setLogs(loadedLogs);
        setIsLoading(false);
      }
    }

    void loadDatabase();

    return () => {
      cancelled = true;
    };
  }, [authReady, userEmail]);

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    if (activePage === "storage") {
      inputRef.current?.focus();
    }
  }, [activePage, mode]);

  function getAuthRedirectUrl() {
    return window.location.origin;
  }

  async function handleEmailAuth(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isLoggingIn) {
      return;
    }

    const email = loginEmail.trim();
    const name = signupName.trim();

    if (!email || !loginPassword) {
      setLoginError(
        "Bitte E-Mail-Adresse und Passwort eingeben.",
      );
      return;
    }

    if (authMode === "signup" && !name) {
      setLoginError(
        "Bitte gib deinen Namen ein.",
      );
      return;
    }

    if (
      authMode === "signup" &&
      loginPassword.length < 8
    ) {
      setLoginError(
        "Das Passwort muss mindestens 8 Zeichen lang sein.",
      );
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");
    setAuthMessage("");

    if (authMode === "login") {
      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password: loginPassword,
        });

      if (error) {
        setLoginError(
          "Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse, Passwort und E-Mail-Bestätigung.",
        );
      } else {
        setLoginPassword("");
      }
    } else {
      const { data, error } =
        await supabase.auth.signUp({
          email,
          password: loginPassword,
          options: {
            emailRedirectTo:
              getAuthRedirectUrl(),
            data: {
              full_name: name,
              name,
            },
          },
        });

      if (error) {
        setLoginError(error.message);
      } else if (data.session) {
        setLoginPassword("");
        setSignupName("");
      } else {
        setAuthMessage(
          "Account erstellt. Öffne jetzt die Bestätigungs-E-Mail und klicke auf den Verifizierungslink.",
        );
        setLoginPassword("");
      }
    }

    setIsLoggingIn(false);
  }

  async function handleForgotPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const email = loginEmail.trim();

    if (!email) {
      setLoginError(
        "Bitte gib deine E-Mail-Adresse ein.",
      );
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");
    setAuthMessage("");

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: getAuthRedirectUrl(),
        },
      );

    if (error) {
      setLoginError(error.message);
    } else {
      setAuthMessage(
        "Wir haben dir eine E-Mail geschickt. Öffne den Link darin, um ein neues Passwort festzulegen.",
      );
    }

    setIsLoggingIn(false);
  }

  async function handlePasswordUpdate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isLoggingIn) {
      return;
    }

    if (newPassword.length < 8) {
      setLoginError(
        "Das neue Passwort muss mindestens 8 Zeichen lang sein.",
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setLoginError(
        "Die beiden Passwörter stimmen nicht überein.",
      );
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");
    setPasswordUpdateMessage("");

    const { error } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    if (error) {
      setLoginError(error.message);
    } else {
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordUpdateMessage(
        "Dein Passwort wurde erfolgreich geändert.",
      );
    }

    setIsLoggingIn(false);
  }

  async function handleGoogleLogin() {
    if (isGoogleLoading) {
      return;
    }

    setIsGoogleLoading(true);
    setLoginError("");
    setAuthMessage("");

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthRedirectUrl(),
        },
      });

    if (error) {
      setLoginError(
        `Google-Anmeldung konnte nicht gestartet werden: ${error.message}`,
      );
      setIsGoogleLoading(false);
    }
  }

  async function resendConfirmationEmail() {
    const email = loginEmail.trim();

    if (!email) {
      setLoginError(
        "Gib zuerst deine E-Mail-Adresse ein.",
      );
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");
    setAuthMessage("");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });

    if (error) {
      setLoginError(error.message);
    } else {
      setAuthMessage(
        "Die Bestätigungs-E-Mail wurde erneut gesendet.",
      );
    }

    setIsLoggingIn(false);
  }

  async function handleProfileNameUpdate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const name = profileName.trim();

    if (!name) {
      setProfileError("Bitte gib einen Namen ein.");
      setProfileMessage("");
      return;
    }

    setIsProfileSaving(true);
    setProfileError("");
    setProfileMessage("");

    const { data, error } = await supabase.auth.updateUser({
      data: {
        full_name: name,
        name,
      },
    });

    if (error) {
      setProfileError(error.message);
    } else {
      const updatedName =
        getDisplayName(data.user) || name;

      setUserName(updatedName);
      setProfileName(updatedName);
      setProfileMessage(
        "Dein Name wurde erfolgreich gespeichert.",
      );
    }

    setIsProfileSaving(false);
  }

  async function handleProfilePasswordUpdate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (profilePassword.length < 8) {
      setProfileError(
        "Das neue Passwort muss mindestens 8 Zeichen lang sein.",
      );
      setProfileMessage("");
      return;
    }

    if (profilePassword !== profilePasswordConfirm) {
      setProfileError(
        "Die beiden Passwörter stimmen nicht überein.",
      );
      setProfileMessage("");
      return;
    }

    setIsProfileSaving(true);
    setProfileError("");
    setProfileMessage("");

    const { error } = await supabase.auth.updateUser({
      password: profilePassword,
    });

    if (error) {
      setProfileError(error.message);
    } else {
      setProfilePassword("");
      setProfilePasswordConfirm("");
      setProfileMessage(
        "Dein Passwort wurde erfolgreich geändert.",
      );
    }

    setIsProfileSaving(false);
  }

  async function handleLogout() {
    setIsSidebarOpen(false);
    setDatabaseError("");

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      setDatabaseError(error.message);
    }
  }

  function changePage(page: Page) {
    setActivePage(page);
    setIsSidebarOpen(false);

    if (page !== "statistics") {
      setSelectedMaterial(null);
    }
  }

  function changeMode(newMode: Mode) {
    setMode(newMode);
    setBarcode("");
    setUnknownBarcode("");

    setMessage(
      newMode === "in"
        ? "Einlagerungsmodus aktiv."
        : "Entnahmemodus aktiv.",
    );
  }

  async function addLogEntry(
    action: "in" | "out",
    filament: Filament,
    stockAfter: number,
    source: "scan" | "manual",
  ) {
    const entry = createLogEntry(
      action,
      filament,
      stockAfter,
      source,
    );

    const { data, error } = await supabase
      .from("filament_logs")
      .insert({
        id: entry.id,
        created_at: entry.timestamp,
        action: entry.action,
        source: entry.source,
        filament_id: filament.id,
        filament_name: entry.filamentName,
        barcode: entry.barcode,
        stock_after: entry.stockAfter,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    setLogs((current) => [
      rowToLog(data as LogRow),
      ...current,
    ]);
  }

  async function processBarcode() {
    const scannedBarcode = normalizeFilamentEan(barcode);

    if (!scannedBarcode || isSaving) {
      if (!scannedBarcode) {
        setMessage("Bitte einen Barcode scannen.");
      }

      inputRef.current?.focus();
      return;
    }

    const currentTimestamp = performance.now();
    const isDuplicateScan =
      lastScanRef.current.barcode === scannedBarcode &&
      currentTimestamp -
        lastScanRef.current.timestamp <
        1200;

    if (isDuplicateScan) {
      setMessage(
        "Doppelscan verhindert. Bitte kurz warten und erneut scannen.",
      );
      setBarcode("");
      inputRef.current?.focus();
      return;
    }

    lastScanRef.current = {
      barcode: scannedBarcode,
      timestamp: currentTimestamp,
    };

    const filament = filaments.find(
      (item) => item.barcode === scannedBarcode,
    );

    if (!filament) {
      setIsSaving(true);
      setDatabaseError("");
      setUnknownBarcode("");

      try {
        const { data: catalogData, error: catalogError } =
          await supabase
            .from("filament_catalog")
            .select(
              "barcode, manufacturer, material, color, weight_per_roll, price, variant",
            )
            .eq("barcode", scannedBarcode)
            .maybeSingle();

        if (catalogError) {
          throw new Error(catalogError.message);
        }

        if (!catalogData) {
          setUnknownBarcode(scannedBarcode);
          setMessage(
            `Barcode ${scannedBarcode} ist noch nicht in der Filament-Datenbank vorhanden.`,
          );
          return;
        }

        const catalog =
          catalogData as FilamentCatalogRow;

        if (mode === "out") {
          setUnknownBarcode(scannedBarcode);
          setMessage(
            `${catalog.manufacturer} ${catalog.material} ${catalog.color} ist noch nicht in deinem Lager angelegt. Wechsle zum Einlagerungsmodus und scanne erneut.`,
          );
          return;
        }

        const materialName = catalog.variant
          ? `${catalog.material} ${catalog.variant}`
          : catalog.material;

        const catalogForm: FilamentForm = {
          barcode: catalog.barcode,
          manufacturer: catalog.manufacturer,
          material: materialName,
          color: catalog.color,
          weightPerRoll: catalog.weight_per_roll,
          location: "",
          minimumStock: 1,
          stock: 1,
          orderLink: "",
        };

        const { data, error } = await supabase
          .from("filaments")
          .insert(filamentToInsert(catalogForm))
          .select("*")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        const createdFilament = rowToFilament(
          data as FilamentRow,
        );

        await addLogEntry(
          "in",
          createdFilament,
          1,
          "scan",
        );

        setFilaments((current) => [
          ...current,
          createdFilament,
        ]);

        setMessage(
          `${createdFilament.manufacturer} ${createdFilament.material} ${createdFilament.color} wurde aus der Datenbank angelegt und eingelagert. Bestand: 1 Rolle.`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unbekannter Datenbankfehler";

        setDatabaseError(errorMessage);
        setMessage(
          "Das Filament konnte nicht aus der Datenbank angelegt werden.",
        );
      } finally {
        setIsSaving(false);
        setBarcode("");
        inputRef.current?.focus();
      }

      return;
    }

    setUnknownBarcode("");

    if (mode === "out" && filament.stock <= 0) {
      setMessage(
        `${filament.material} ${filament.color} hat keinen Bestand mehr.`,
      );
      setBarcode("");
      inputRef.current?.focus();
      return;
    }

    const newStock =
      mode === "in"
        ? filament.stock + 1
        : filament.stock - 1;

    setIsSaving(true);
    setDatabaseError("");

    try {
      const { error } = await supabase
        .from("filaments")
        .update({
          stock: newStock,
        })
        .eq("id", filament.id);

      if (error) {
        throw new Error(error.message);
      }

      await addLogEntry(
        mode,
        filament,
        newStock,
        "scan",
      );

      setFilaments((current) =>
        current.map((item) =>
          item.id === filament.id
            ? {
                ...item,
                stock: newStock,
              }
            : item,
        ),
      );

      setMessage(
        mode === "in"
          ? `${filament.manufacturer} ${filament.material} ${filament.color} eingelagert. Neuer Bestand: ${newStock} Rollen.`
          : `${filament.manufacturer} ${filament.material} ${filament.color} entfernt. Neuer Bestand: ${newStock} Rollen.`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unbekannter Datenbankfehler";

      setDatabaseError(errorMessage);
      setMessage(
        "Die Lagerbewegung konnte nicht gespeichert werden.",
      );
    } finally {
      setIsSaving(false);
      setBarcode("");
      inputRef.current?.focus();
    }
  }

  function handleBarcodeKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter") {
      void processBarcode();
    }
  }

  function openCreateForm(prefilledBarcode = "") {
    setEditingId(null);
    setForm({
      ...emptyForm,
      barcode: prefilledBarcode,
    });
    setIsFormOpen(true);
  }

  function openEditForm(filament: Filament) {
    setEditingId(filament.id);

    setForm({
      barcode: filament.barcode,
      manufacturer: filament.manufacturer,
      material: filament.material,
      color: filament.color,
      weightPerRoll: filament.weightPerRoll,
      location: filament.location,
      minimumStock: filament.minimumStock,
      stock: filament.stock,
      orderLink: filament.orderLink,
    });

    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);

    if (activePage === "storage") {
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }

  async function saveFilament(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const cleanedBarcode = normalizeFilamentEan(form.barcode);

    if (
      !cleanedBarcode ||
      !form.manufacturer.trim() ||
      !form.color.trim()
    ) {
      window.alert(
        "Bitte fülle alle Pflichtfelder aus.",
      );
      return;
    }

    const barcodeExists = filaments.some(
      (filament) =>
        filament.barcode === cleanedBarcode &&
        filament.id !== editingId,
    );

    if (barcodeExists) {
      window.alert(
        "Dieser Barcode ist bereits vorhanden.",
      );
      return;
    }

    const cleanedForm: FilamentForm = {
      ...form,
      barcode: cleanedBarcode,
      manufacturer: form.manufacturer.trim(),
      material: form.material.trim(),
      color: form.color.trim(),
      location: form.location.trim(),
      orderLink: form.orderLink.trim(),
      weightPerRoll: Math.max(
        1,
        form.weightPerRoll,
      ),
      minimumStock: Math.max(
        0,
        form.minimumStock,
      ),
      stock: Math.max(0, form.stock),
    };

    setIsSaving(true);
    setDatabaseError("");

    try {
      if (editingId !== null) {
        const { data, error } = await supabase
          .from("filaments")
          .update(
            filamentToInsert(cleanedForm),
          )
          .eq("id", editingId)
          .select("*")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        const updated = rowToFilament(
          data as FilamentRow,
        );

        setFilaments((current) =>
          current.map((filament) =>
            filament.id === editingId
              ? updated
              : filament,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("filaments")
          .insert(
            filamentToInsert(cleanedForm),
          )
          .select("*")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        setFilaments((current) => [
          ...current,
          rowToFilament(data as FilamentRow),
        ]);
      }

      const { error: catalogError } = await supabase
        .from("filament_catalog")
        .upsert(
          {
            barcode: cleanedForm.barcode,
            manufacturer: cleanedForm.manufacturer,
            material: cleanedForm.material,
            color: cleanedForm.color,
            weight_per_roll:
              cleanedForm.weightPerRoll,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "barcode",
          },
        );

      if (catalogError) {
        throw new Error(
          `Lagerbestand wurde gespeichert, aber die Filament-Datenbank konnte nicht aktualisiert werden: ${catalogError.message}`,
        );
      }

      setUnknownBarcode("");
      closeForm();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unbekannter Datenbankfehler";

      setDatabaseError(errorMessage);
      window.alert(
        `Filament konnte nicht gespeichert werden: ${errorMessage}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteFilament(id: number) {
    const filament = filaments.find(
      (item) => item.id === id,
    );

    if (!filament || isSaving) {
      return;
    }

    const confirmed = window.confirm(
      `${filament.material} ${filament.color} wirklich löschen?`,
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setDatabaseError("");

    const { error } = await supabase
      .from("filaments")
      .delete()
      .eq("id", id);

    if (error) {
      setDatabaseError(error.message);
      window.alert(
        `Filament konnte nicht gelöscht werden: ${error.message}`,
      );
    } else {
      setFilaments((current) =>
        current.filter((item) => item.id !== id),
      );
    }

    setIsSaving(false);
  }

  async function adjustStock(
    id: number,
    amount: number,
  ) {
    if (isSaving) {
      return;
    }

    const filament = filaments.find(
      (item) => item.id === id,
    );

    if (!filament) {
      return;
    }

    const newStock = Math.max(
      0,
      filament.stock + amount,
    );

    if (newStock === filament.stock) {
      return;
    }

    setIsSaving(true);
    setDatabaseError("");

    try {
      const { error } = await supabase
        .from("filaments")
        .update({
          stock: newStock,
        })
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }

      await addLogEntry(
        amount > 0 ? "in" : "out",
        filament,
        newStock,
        "manual",
      );

      setFilaments((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                stock: newStock,
              }
            : item,
        ),
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unbekannter Datenbankfehler";

      setDatabaseError(errorMessage);
      window.alert(
        `Bestand konnte nicht geändert werden: ${errorMessage}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function clearLogs() {
    if (isSaving) {
      return;
    }

    const confirmed = window.confirm(
      "Möchtest du wirklich alle Statistikdaten und das komplette Protokoll löschen? Filamente und Bestände bleiben erhalten.",
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setDatabaseError("");

    const { error } = await supabase
      .from("filament_logs")
      .delete()
      .gte(
        "created_at",
        "1900-01-01T00:00:00.000Z",
      );

    if (error) {
      setDatabaseError(error.message);
      window.alert(
        `Protokoll konnte nicht gelöscht werden: ${error.message}`,
      );
    } else {
      setLogs([]);
    }

    setIsSaving(false);
  }

  function exportData() {
    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      filaments,
      logs,
    };

    const fileContent = JSON.stringify(backup, null, 2);
    const fileBlob = new Blob([fileContent], {
      type: "application/json",
    });

    const downloadUrl = URL.createObjectURL(fileBlob);
    const downloadLink = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    downloadLink.href = downloadUrl;
    downloadLink.download = `philamentix-hub-backup-${date}.json`;

    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    URL.revokeObjectURL(downloadUrl);
  }

  function openImportDialog() {
    importInputRef.current?.click();
  }

  async function importData(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file || isSaving) {
      return;
    }

    try {
      const fileContent = await file.text();
      const parsedData: unknown =
        JSON.parse(fileContent);

      if (
        typeof parsedData !== "object" ||
        parsedData === null ||
        !("version" in parsedData) ||
        !("filaments" in parsedData) ||
        !("logs" in parsedData)
      ) {
        throw new Error(
          "Ungültiges Backup-Format",
        );
      }

      const backup =
        parsedData as Partial<BackupData>;

      if (
        backup.version !== 1 ||
        !Array.isArray(backup.filaments) ||
        !Array.isArray(backup.logs)
      ) {
        throw new Error(
          "Ungültiges Backup-Format",
        );
      }

      const confirmed = window.confirm(
        "Beim Import werden deine aktuellen Supabase-Daten vollständig ersetzt. Fortfahren?",
      );

      if (!confirmed) {
        return;
      }

      setIsSaving(true);
      setDatabaseError("");

      const deleteLogsResponse = await supabase
        .from("filament_logs")
        .delete()
        .gte(
          "created_at",
          "1900-01-01T00:00:00.000Z",
        );

      if (deleteLogsResponse.error) {
        throw new Error(
          deleteLogsResponse.error.message,
        );
      }

      const deleteFilamentsResponse =
        await supabase
          .from("filaments")
          .delete()
          .gte("id", 0);

      if (deleteFilamentsResponse.error) {
        throw new Error(
          deleteFilamentsResponse.error.message,
        );
      }

      const insertFilamentsResponse =
        await supabase
          .from("filaments")
          .insert(
            backup.filaments.map(
              (filament) =>
                filamentToInsert(filament),
            ),
          )
          .select("*");

      if (insertFilamentsResponse.error) {
        throw new Error(
          insertFilamentsResponse.error.message,
        );
      }

      const importedFilaments = (
        insertFilamentsResponse.data ?? []
      ).map((row) =>
        rowToFilament(row as FilamentRow),
      );

      const idByBarcode = new Map(
        importedFilaments.map((filament) => [
          filament.barcode,
          filament.id,
        ]),
      );

      let importedLogs: LogEntry[] = [];

      if (backup.logs.length > 0) {
        const insertLogsResponse =
          await supabase
            .from("filament_logs")
            .insert(
              backup.logs.map((entry) => ({
                id: entry.id,
                created_at: entry.timestamp,
                action: entry.action,
                source: entry.source,
                filament_id:
                  idByBarcode.get(
                    entry.barcode,
                  ) ?? null,
                filament_name:
                  entry.filamentName,
                barcode: entry.barcode,
                stock_after:
                  entry.stockAfter,
              })),
            )
            .select("*");

        if (insertLogsResponse.error) {
          throw new Error(
            insertLogsResponse.error.message,
          );
        }

        importedLogs = (
          insertLogsResponse.data ?? []
        )
          .map((row) =>
            rowToLog(row as LogRow),
          )
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() -
              new Date(a.timestamp).getTime(),
          );
      }

      setFilaments(importedFilaments);
      setLogs(importedLogs);

      window.alert(
        "Backup wurde erfolgreich in Supabase importiert.",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unbekannter Importfehler";

      setDatabaseError(errorMessage);
      window.alert(
        `Die Datei konnte nicht importiert werden: ${errorMessage}`,
      );
    } finally {
      setIsSaving(false);
      event.target.value = "";
    }
  }

  function openOrderLink(link: string) {
    if (!link) {
      return;
    }

    const normalizedLink =
      link.startsWith("http://") ||
      link.startsWith("https://")
        ? link
        : `https://${link}`;

    window.open(
      normalizedLink,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const totalRolls = filaments.reduce(
    (total, filament) =>
      total + filament.stock,
    0,
  );

  const totalWeight = filaments.reduce(
    (total, filament) =>
      total +
      filament.stock *
        filament.weightPerRoll,
    0,
  );

  const criticalFilaments =
    filaments.filter(
      (filament) =>
        filament.stock <=
        filament.minimumStock,
    );

  const filteredFilaments =
    filaments.filter((filament) => {
      const text = [
        filament.barcode,
        filament.manufacturer,
        filament.material,
        filament.color,
        filament.location,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(
        search.toLowerCase(),
      );
    });

  const todayKey = new Date().toLocaleDateString("de-DE");

  const todaysLogs = logs.filter(
    (entry) =>
      new Date(entry.timestamp).toLocaleDateString("de-DE") ===
      todayKey,
  );

  const todaysIn = todaysLogs.filter(
    (entry) => entry.action === "in",
  ).length;

  const todaysOut = todaysLogs.filter(
    (entry) => entry.action === "out",
  ).length;

  const recentLogs = logs.slice(0, 5);

  const materialSummary = Object.entries(
    filaments.reduce<Record<string, number>>(
      (summary, filament) => {
        summary[filament.material] =
          (summary[filament.material] ?? 0) +
          filament.stock;

        return summary;
      },
      {},
    ),
  )
    .map(([material, stock]) => ({
      material,
      stock,
    }))
    .sort((a, b) => b.stock - a.stock);

  const largestMaterialStock =
    materialSummary[0]?.stock ?? 0;

  const rangeDays =
    statisticsRange === "all"
      ? null
      : Number(statisticsRange);

  const rangeStart =
    rangeDays === null
      ? null
      : STATISTICS_REFERENCE_TIME -
        rangeDays * 24 * 60 * 60 * 1000;

  const logsInRange = logs.filter((entry) => {
    if (rangeStart === null) {
      return true;
    }

    return (
      new Date(entry.timestamp).getTime() >= rangeStart
    );
  });

  const materialStatistics = Array.from(
    new Set(filaments.map((filament) => filament.material)),
  )
    .map((material) => {
      const materialFilaments = filaments.filter(
        (filament) => filament.material === material,
      );

      const materialBarcodes = new Set(
        materialFilaments.map(
          (filament) => filament.barcode,
        ),
      );

      const materialLogs = logs.filter((entry) =>
        materialBarcodes.has(entry.barcode),
      );

      const materialLogsInRange = logsInRange.filter(
        (entry) =>
          materialBarcodes.has(entry.barcode),
      );

      const stock = materialFilaments.reduce(
        (sum, filament) => sum + filament.stock,
        0,
      );

      const weight = materialFilaments.reduce(
        (sum, filament) =>
          sum +
          filament.stock *
            filament.weightPerRoll,
        0,
      );

      const totalIn = materialLogsInRange.filter(
        (entry) => entry.action === "in",
      ).length;

      const totalOut = materialLogsInRange.filter(
        (entry) => entry.action === "out",
      ).length;

      const criticalCount = materialFilaments.filter(
        (filament) =>
          filament.stock <= filament.minimumStock,
      ).length;

      const colors = new Set(
        materialFilaments.map(
          (filament) => filament.color,
        ),
      ).size;

      const manufacturers = new Set(
        materialFilaments.map(
          (filament) => filament.manufacturer,
        ),
      ).size;

      const lastIn = materialLogs.find(
        (entry) => entry.action === "in",
      );

      const lastOut = materialLogs.find(
        (entry) => entry.action === "out",
      );

      return {
        material,
        variants: materialFilaments.length,
        colors,
        manufacturers,
        stock,
        weight,
        totalIn,
        totalOut,
        netChange: totalIn - totalOut,
        criticalCount,
        share:
          totalRolls > 0
            ? (stock / totalRolls) * 100
            : 0,
        lastIn: lastIn?.timestamp ?? null,
        lastOut: lastOut?.timestamp ?? null,
        activity: totalIn + totalOut,
      };
    })
    .sort((a, b) => b.activity - a.activity);

  const maximumMaterialStock = Math.max(
    ...materialStatistics.map((item) => item.stock),
    1,
  );

  const statisticsTotals = materialStatistics.reduce(
    (totals, item) => ({
      stock: totals.stock + item.stock,
      weight: totals.weight + item.weight,
      totalIn: totals.totalIn + item.totalIn,
      totalOut: totals.totalOut + item.totalOut,
      criticalCount:
        totals.criticalCount + item.criticalCount,
    }),
    {
      stock: 0,
      weight: 0,
      totalIn: 0,
      totalOut: 0,
      criticalCount: 0,
    },
  );

  const mostActiveMaterial =
    materialStatistics[0] ?? null;

  const filamentActivity = filaments
    .map((filament) => {
      const filamentLogs = logsInRange.filter(
        (entry) =>
          entry.barcode === filament.barcode,
      );

      const incoming = filamentLogs.filter(
        (entry) => entry.action === "in",
      ).length;

      const outgoing = filamentLogs.filter(
        (entry) => entry.action === "out",
      ).length;

      return {
        filament,
        incoming,
        outgoing,
        activity: incoming + outgoing,
      };
    })
    .sort((a, b) => b.activity - a.activity);

  const mostActiveFilament =
    filamentActivity[0]?.activity > 0
      ? filamentActivity[0]
      : null;

  const topOutgoing = [...filamentActivity]
    .filter((item) => item.outgoing > 0)
    .sort((a, b) => b.outgoing - a.outgoing)
    .slice(0, 5);

  const topIncoming = [...filamentActivity]
    .filter((item) => item.incoming > 0)
    .sort((a, b) => b.incoming - a.incoming)
    .slice(0, 5);

  const largestStocks = [...filaments]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5);

  const zeroStockFilaments = filaments.filter(
    (filament) => filament.stock === 0,
  );

  const belowMinimumFilaments = filaments.filter(
    (filament) =>
      filament.stock < filament.minimumStock,
  );

  const exactlyMinimumFilaments = filaments.filter(
    (filament) =>
      filament.stock === filament.minimumStock,
  );

  const withoutLocation = filaments.filter(
    (filament) => !filament.location.trim(),
  );

  const withoutOrderLink = filaments.filter(
    (filament) => !filament.orderLink.trim(),
  );

  const withoutMovement = filaments.filter(
    (filament) =>
      !logs.some(
        (entry) =>
          entry.barcode === filament.barcode,
      ),
  );

  const duplicateBarcodes = Array.from(
    filaments.reduce<Map<string, number>>(
      (map, filament) => {
        map.set(
          filament.barcode,
          (map.get(filament.barcode) ?? 0) + 1,
        );

        return map;
      },
      new Map(),
    ),
  ).filter(([, count]) => count > 1);

  const chartDays =
    statisticsRange === "7"
      ? 7
      : statisticsRange === "30"
        ? 14
        : statisticsRange === "90"
          ? 18
          : 20;

  const chartStepDays =
    statisticsRange === "7"
      ? 1
      : statisticsRange === "30"
        ? 2
        : statisticsRange === "90"
          ? 5
          : 14;

  const movementChart = Array.from(
    { length: chartDays },
    (_, index) => {
      const bucketStart =
        STATISTICS_REFERENCE_TIME -
        (chartDays - index) *
          chartStepDays *
          24 *
          60 *
          60 *
          1000;

      const bucketEnd =
        bucketStart +
        chartStepDays *
          24 *
          60 *
          60 *
          1000;

      const bucketLogs = logs.filter((entry) => {
        const time = new Date(
          entry.timestamp,
        ).getTime();

        return (
          time >= bucketStart &&
          time < bucketEnd
        );
      });

      return {
        label: new Date(bucketStart).toLocaleDateString(
          "de-DE",
          {
            day: "2-digit",
            month: "2-digit",
          },
        ),
        incoming: bucketLogs.filter(
          (entry) => entry.action === "in",
        ).length,
        outgoing: bucketLogs.filter(
          (entry) => entry.action === "out",
        ).length,
      };
    },
  );

  const maximumChartValue = Math.max(
    ...movementChart.flatMap((item) => [
      item.incoming,
      item.outgoing,
    ]),
    1,
  );

  const manufacturerSummary = Array.from(
    filaments.reduce<Map<string, number>>(
      (map, filament) => {
        map.set(
          filament.manufacturer,
          (map.get(filament.manufacturer) ?? 0) +
            filament.stock,
        );

        return map;
      },
      new Map(),
    ),
  )
    .map(([manufacturer, stock]) => ({
      manufacturer,
      stock,
    }))
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 6);

  const selectedMaterialFilaments =
    selectedMaterial === null
      ? []
      : filaments
          .filter(
            (filament) =>
              filament.material === selectedMaterial,
          )
          .sort((a, b) =>
            a.color.localeCompare(b.color, "de"),
          );

  const selectedMaterialBarcodes = new Set(
    selectedMaterialFilaments.map(
      (filament) => filament.barcode,
    ),
  );

  const selectedMaterialLogs =
    selectedMaterial === null
      ? []
      : logsInRange
          .filter((entry) =>
            selectedMaterialBarcodes.has(entry.barcode),
          )
          .slice(0, 20);

  const selectedMaterialSummary =
    selectedMaterial === null
      ? null
      : materialStatistics.find(
          (item) =>
            item.material === selectedMaterial,
        ) ?? null;

  const selectedMaterialColorSummary =
    selectedMaterial === null
      ? []
      : Array.from(
          selectedMaterialFilaments.reduce<
            Map<string, number>
          >((map, filament) => {
            map.set(
              filament.color,
              (map.get(filament.color) ?? 0) +
                filament.stock,
            );

            return map;
          }, new Map()),
        )
          .map(([color, stock]) => ({
            color,
            stock,
          }))
          .sort((a, b) => b.stock - a.stock);

  const selectedMaterialTopColor =
    selectedMaterialColorSummary[0] ?? null;

  const selectedMaterialManufacturerSummary =
    selectedMaterial === null
      ? []
      : Array.from(
          selectedMaterialFilaments.reduce<
            Map<string, number>
          >((map, filament) => {
            map.set(
              filament.manufacturer,
              (map.get(filament.manufacturer) ?? 0) +
                filament.stock,
            );

            return map;
          }, new Map()),
        )
          .map(([manufacturer, stock]) => ({
            manufacturer,
            stock,
          }))
          .sort((a, b) => b.stock - a.stock);

  const selectedMaterialTopManufacturer =
    selectedMaterialManufacturerSummary[0] ?? null;

  const selectedMaterialWeeklyAverage =
    selectedMaterialSummary === null ||
    statisticsRange === "all"
      ? null
      : (
          selectedMaterialSummary.activity /
          Math.max(Number(statisticsRange) / 7, 1)
        ).toFixed(1);

  if (!isHydrated || !authReady) {
    return (
      <div className="hydration-screen">
        <div className="hydration-card">
          <div className="hydration-logo">
            Philamentix<span>Hub</span>
          </div>

          <div className="hydration-loader">
            <span />
            <span />
            <span />
          </div>

          <p>
            Sichere Verbindung wird vorbereitet …
          </p>
        </div>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="login-brand">
            <div className="login-logo">
              Philamentix<span>Hub</span>
            </div>

            <p>PASSWORT ZURÜCKSETZEN</p>
          </div>

          <div className="login-heading">
            <span className="login-lock">●</span>

            <div>
              <h1>Neues Passwort</h1>
              <p>
                Lege jetzt ein neues Passwort für
                deinen Philamentix-Hub-Account fest.
              </p>
            </div>
          </div>

          <form
            className="login-form"
            onSubmit={handlePasswordUpdate}
          >
            <label>
              Neues Passwort
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(
                    event.target.value,
                  )
                }
                placeholder="Mindestens 8 Zeichen"
                autoFocus
              />
            </label>

            <label>
              Passwort wiederholen
              <input
                type="password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(event) =>
                  setConfirmNewPassword(
                    event.target.value,
                  )
                }
                placeholder="Passwort erneut eingeben"
              />
            </label>

            {loginError && (
              <div className="login-error">
                {loginError}
              </div>
            )}

            {passwordUpdateMessage && (
              <div className="login-success">
                <strong>Erfolgreich</strong>
                <span>{passwordUpdateMessage}</span>
              </div>
            )}

            {!passwordUpdateMessage ? (
              <button
                className="login-button"
                type="submit"
                disabled={isLoggingIn}
              >
                {isLoggingIn
                  ? "Passwort wird geändert …"
                  : "Neues Passwort speichern"}
              </button>
            ) : (
              <button
                className="login-button"
                type="button"
                onClick={() => {
                  setIsPasswordRecovery(false);
                  setLoginError("");
                  setPasswordUpdateMessage("");
                }}
              >
                Weiter zu Philamentix Hub
              </button>
            )}
          </form>
        </section>
      </main>
    );
  }

  if (!userEmail) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="login-brand">
            <div className="login-logo">
              Philamentix<span>Hub</span>
            </div>

            <p>FILAMENT MANAGEMENT</p>
          </div>

          {authMode !== "forgot" ? (
            <div className="login-mode-switch">
              <button
                type="button"
                className={
                  authMode === "login"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setAuthMode("login");
                  setLoginError("");
                  setAuthMessage("");
                }}
              >
                Anmelden
              </button>

              <button
                type="button"
                className={
                  authMode === "signup"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setAuthMode("signup");
                  setLoginError("");
                  setAuthMessage("");
                }}
              >
                Account erstellen
              </button>
            </div>
          ) : (
            <button
              className="login-back-button"
              type="button"
              onClick={() => {
                setAuthMode("login");
                setLoginError("");
                setAuthMessage("");
              }}
            >
              ← Zurück zur Anmeldung
            </button>
          )}

          <div className="login-heading">
            <span className="login-lock">●</span>

            <div>
              <h1>
                {authMode === "login"
                  ? "Willkommen zurück"
                  : authMode === "signup"
                    ? "Neuen Account erstellen"
                    : "Passwort vergessen?"}
              </h1>

              <p>
                {authMode === "login"
                  ? "Melde dich an, um auf das Filamentlager zuzugreifen."
                  : authMode === "signup"
                    ? "Nach der Registrierung erhältst du eine E-Mail zur Bestätigung deines Accounts."
                    : "Gib deine E-Mail-Adresse ein. Du erhältst einen Link zum Zurücksetzen."}
              </p>
            </div>
          </div>

          {authMode !== "forgot" && (
            <>
              <button
                className="google-login-button"
                type="button"
                disabled={isGoogleLoading}
                onClick={() =>
                  void handleGoogleLogin()
                }
              >
                <span
                  className="google-mark"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                  >
                    <path
                      fill="#4285F4"
                      d="M21.35 12.23c0-.71-.06-1.4-.2-2.07H12v3.91h5.23a4.48 4.48 0 0 1-1.94 2.94v2.54h3.14c1.84-1.69 2.92-4.18 2.92-7.32Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 21.72c2.63 0 4.84-.87 6.45-2.37l-3.14-2.54c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.02H3.3v2.62A9.73 9.73 0 0 0 12 21.72Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M6.54 13.71a5.85 5.85 0 0 1 0-3.74V7.35H3.3a9.73 9.73 0 0 0 0 8.98l3.24-2.62Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.95c1.43 0 2.71.49 3.72 1.45l2.79-2.79A9.35 9.35 0 0 0 12 2.28a9.73 9.73 0 0 0-8.7 5.07l3.24 2.62C7.31 7.67 9.46 5.95 12 5.95Z"
                    />
                  </svg>
                </span>

                {isGoogleLoading
                  ? "Weiterleitung zu Google …"
                  : "Mit Google fortfahren"}
              </button>

              <div className="login-divider">
                <span>oder mit E-Mail</span>
              </div>
            </>
          )}

          <form
            className="login-form"
            onSubmit={
              authMode === "forgot"
                ? handleForgotPassword
                : handleEmailAuth
            }
          >
            {authMode === "signup" && (
              <label>
                Name
                <input
                  type="text"
                  autoComplete="name"
                  value={signupName}
                  onChange={(event) =>
                    setSignupName(
                      event.target.value,
                    )
                  }
                  placeholder="Dein Name"
                  autoFocus
                />
              </label>
            )}

            <label>
              E-Mail-Adresse
              <input
                type="email"
                autoComplete="email"
                value={loginEmail}
                onChange={(event) =>
                  setLoginEmail(
                    event.target.value,
                  )
                }
                placeholder="name@beispiel.de"
                autoFocus={authMode !== "signup"}
              />
            </label>

            {authMode !== "forgot" && (
              <label>
                Passwort
                <input
                  type="password"
                  autoComplete={
                    authMode === "signup"
                      ? "new-password"
                      : "current-password"
                  }
                  value={loginPassword}
                  onChange={(event) =>
                    setLoginPassword(
                      event.target.value,
                    )
                  }
                  placeholder="Mindestens 8 Zeichen"
                />
              </label>
            )}

            {authMode === "login" && (
              <button
                className="forgot-password-button"
                type="button"
                onClick={() => {
                  setAuthMode("forgot");
                  setLoginError("");
                  setAuthMessage("");
                }}
              >
                Passwort vergessen?
              </button>
            )}

            {loginError && (
              <div className="login-error">
                {loginError}
              </div>
            )}

            {authMessage && (
              <div className="login-success">
                <strong>
                  {authMode === "forgot"
                    ? "E-Mail gesendet"
                    : "Fast geschafft"}
                </strong>

                <span>{authMessage}</span>

                {authMode === "signup" && (
                  <button
                    type="button"
                    onClick={() =>
                      void resendConfirmationEmail()
                    }
                    disabled={isLoggingIn}
                  >
                    Bestätigungs-Mail erneut senden
                  </button>
                )}
              </div>
            )}

            <button
              className="login-button"
              type="submit"
              disabled={isLoggingIn}
            >
              {isLoggingIn
                ? "Bitte warten …"
                : authMode === "login"
                  ? "Bei Philamentix Hub anmelden"
                  : authMode === "signup"
                    ? "Account erstellen"
                    : "Reset-Link senden"}
            </button>
          </form>

          <p className="login-security-note">
            {authMode === "signup"
              ? "Die E-Mail-Adresse muss vor dem ersten Login bestätigt werden."
              : authMode === "forgot"
                ? "Der Reset-Link ist nur für kurze Zeit gültig."
                : "Zugriff nur für angemeldete Benutzer"}
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="mobile-app-header">
        <button
          className="mobile-menu-button"
          type="button"
          aria-label="Navigation öffnen"
          aria-expanded={isSidebarOpen}
          onClick={() =>
            setIsSidebarOpen(true)
          }
        >
          <span />
          <span />
          <span />
        </button>

        <div className="mobile-logo">
          Philamentix<span>Hub</span>
        </div>

        <span className="mobile-sync-status">
          <i />
          Online
        </span>
      </header>

      <button
        className={`sidebar-overlay ${
          isSidebarOpen ? "visible" : ""
        }`}
        type="button"
        aria-label="Navigation schließen"
        onClick={() =>
          setIsSidebarOpen(false)
        }
      />

      <aside
        className={`sidebar ${
          isSidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-brand-row">
          <div>
            <div className="logo">
              Philamentix<span>Hub</span>
            </div>

            <p className="version">
              FILAMENT MANAGEMENT // V1.0
            </p>
          </div>

          <button
            className="sidebar-close-button"
            type="button"
            aria-label="Navigation schließen"
            onClick={() =>
              setIsSidebarOpen(false)
            }
          >
            ×
          </button>
        </div>

        <nav>
          <p className="nav-title">Übersicht</p>

          <button
            className={`nav-button ${
              activePage === "dashboard"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changePage("dashboard")
            }
          >
            <span>⌂</span>
            Dashboard
          </button>

          <button
            className={`nav-button ${
              activePage === "statistics"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changePage("statistics")
            }
          >
            <span>▥</span>
            Statistik
          </button>

          <p className="nav-title">Lager</p>

          <button
            className={`nav-button ${
              activePage === "storage"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changePage("storage")
            }
          >
            <span>▣</span>
            Ein-/Auslagerung
          </button>

          <button
            className={`nav-button ${
              activePage === "filaments"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changePage("filaments")
            }
          >
            <span>▤</span>
            Filamenttypen
          </button>

          <button
            className={`nav-button ${
              activePage === "log"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changePage("log")
            }
          >
            <span>≡</span>
            Protokoll
          </button>

          <p className="nav-title">Konto</p>

          <button
            className={`nav-button ${
              activePage === "profile"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changePage("profile")
            }
          >
            <span>●</span>
            Profil & Sicherheit
          </button>

          <p className="nav-title">System</p>

          <button
            className={`nav-button ${
              activePage === "settings"
                ? "active"
                : ""
            }`}
            onClick={() =>
              changePage("settings")
            }
          >
            <span>⚙</span>
            Einstellungen
          </button>

          <p className="nav-title">Daten</p>

          <button
            className="nav-button"
            onClick={() => {
              exportData();
              setIsSidebarOpen(false);
            }}
          >
            <span>⇩</span>
            Daten exportieren
          </button>

          <button
            className="nav-button"
            onClick={() => {
              openImportDialog();
              setIsSidebarOpen(false);
            }}
          >
            <span>⇧</span>
            Daten importieren
          </button>

          <input
            ref={importInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json,.json"
            onChange={importData}
          />
        </nav>

        <div className="sidebar-account">
          <button
            className="sidebar-account-info sidebar-account-link"
            type="button"
            onClick={() => changePage("profile")}
          >
            <span>Angemeldet als</span>
            <strong>{userName}</strong>
            <small>{userEmail}</small>
          </button>

          <button
            className="sidebar-logout-button"
            type="button"
            onClick={() => void handleLogout()}
          >
            Abmelden
          </button>
        </div>
      </aside>

      <main className="main-content">
        {isLoading && (
          <div className="database-status-banner">
            Supabase-Daten werden geladen …
          </div>
        )}

        {databaseError && (
          <div className="database-error-banner">
            <strong>Datenbankfehler:</strong>{" "}
            {databaseError}
          </div>
        )}

        {isSaving && (
          <div className="database-saving-indicator">
            Wird gespeichert …
          </div>
        )}
        {activePage === "dashboard" && (
          <>
            <header className="topbar">
              <div>
                <span className="welcome-label">
                  Willkommen zurück,
                </span>

                <h1>{userName}</h1>

                <p>
                  Bestand, Bewegungen und Warnungen auf einen Blick
                </p>
              </div>

              <div className="system-status">
                <span className="status-dot" />
                System aktuell
              </div>
            </header>

            <section className="dashboard-kpis">
              <article className="dashboard-kpi">
                <span>Rollen im Lager</span>
                <strong>{totalRolls}</strong>
                <small>
                  {filaments.length} Filamenttypen
                </small>
              </article>

              <article className="dashboard-kpi">
                <span>Gesamtgewicht</span>
                <strong className="blue">
                  {(totalWeight / 1000).toLocaleString(
                    "de-DE",
                  )}{" "}
                  kg
                </strong>
                <small>Aktueller Lagerbestand</small>
              </article>

              <article className="dashboard-kpi">
                <span>Kritische Bestände</span>
                <strong className="red">
                  {criticalFilaments.length}
                </strong>
                <small>
                  Bestand ≤ Mindestbestand
                </small>
              </article>

              <article className="dashboard-kpi">
                <span>Bewegungen heute</span>
                <strong>{todaysLogs.length}</strong>
                <small>
                  <span className="dashboard-in">
                    +{todaysIn}
                  </span>{" "}
                  /{" "}
                  <span className="dashboard-out">
                    −{todaysOut}
                  </span>
                </small>
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="panel dashboard-panel">
                <div className="dashboard-panel-header">
                  <div>
                    <h2>Materialverteilung</h2>
                    <p>
                      Rollenbestand nach Material
                    </p>
                  </div>
                </div>

                {materialSummary.length === 0 ? (
                  <p className="empty-message">
                    Noch keine Filamente vorhanden.
                  </p>
                ) : (
                  <div className="material-summary">
                    {materialSummary.map((item) => {
                      const percentage =
                        largestMaterialStock > 0
                          ? (item.stock /
                              largestMaterialStock) *
                            100
                          : 0;

                      return (
                        <div
                          className="material-summary-row"
                          key={item.material}
                        >
                          <div className="material-summary-label">
                            <span>{item.material}</span>
                            <strong>
                              {item.stock} Rollen
                            </strong>
                          </div>

                          <div className="material-summary-bar">
                            <div
                              style={{
                                width: `${percentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>

              <article className="panel dashboard-panel">
                <div className="dashboard-panel-header">
                  <div>
                    <h2>Kritische Bestände</h2>
                    <p>
                      Filamente mit Handlungsbedarf
                    </p>
                  </div>

                  <button
                    className="dashboard-link-button"
                    onClick={() =>
                      changePage("filaments")
                    }
                  >
                    Verwalten
                  </button>
                </div>

                {criticalFilaments.length === 0 ? (
                  <div className="dashboard-all-good">
                    <span>✓</span>
                    <div>
                      <strong>Alles im grünen Bereich</strong>
                      <p>
                        Kein Filament liegt unter dem Mindestbestand.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="dashboard-warning-list">
                    {criticalFilaments
                      .slice(0, 4)
                      .map((filament) => (
                        <div
                          className="dashboard-warning-row"
                          key={filament.id}
                        >
                          <div>
                            <strong>
                              {filament.material}{" "}
                              {filament.color}
                            </strong>
                            <span>
                              {filament.manufacturer}
                            </span>
                          </div>

                          <div className="dashboard-warning-stock">
                            <strong>
                              {filament.stock}
                            </strong>
                            <span>
                              Minimum{" "}
                              {filament.minimumStock}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </article>

              <article className="panel dashboard-panel dashboard-recent">
                <div className="dashboard-panel-header">
                  <div>
                    <h2>Letzte Bewegungen</h2>
                    <p>
                      Die fünf neuesten Lageraktionen
                    </p>
                  </div>

                  <button
                    className="dashboard-link-button"
                    onClick={() =>
                      changePage("log")
                    }
                  >
                    Alle anzeigen
                  </button>
                </div>

                {recentLogs.length === 0 ? (
                  <p className="empty-message">
                    Noch keine Lagerbewegungen vorhanden.
                  </p>
                ) : (
                  <div className="recent-movements">
                    {recentLogs.map((entry) => (
                      <div
                        className="recent-movement-row"
                        key={entry.id}
                      >
                        <span
                          className={`recent-movement-symbol ${
                            entry.action === "in"
                              ? "recent-movement-in"
                              : "recent-movement-out"
                          }`}
                        >
                          {entry.action === "in"
                            ? "+"
                            : "−"}
                        </span>

                        <div className="recent-movement-main">
                          <strong>
                            {entry.filamentName}
                          </strong>
                          <span>
                            {entry.source === "scan"
                              ? "Barcode-Scanner"
                              : "Manuelle Änderung"}
                          </span>
                        </div>

                        <div className="recent-movement-meta">
                          <strong>
                            {entry.stockAfter} Rollen
                          </strong>
                          <time>
                            {new Date(
                              entry.timestamp,
                            ).toLocaleString(
                              "de-DE",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </time>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </section>
          </>
        )}

        {activePage === "statistics" && (
          <>
            <header className="topbar">
              <div>
                <h1>
                  {selectedMaterial === null
                    ? "Statistik"
                    : `${selectedMaterial} – Details`}
                </h1>

                <p>
                  {selectedMaterial === null
                    ? "Bestand, Bewegungen und Datenqualität im Überblick"
                    : "Varianten, Bestand und Aktivität dieses Materials"}
                </p>
              </div>

              {selectedMaterial === null ? (
                <div className="system-status">
                  <span className="status-dot" />
                  Live aus dem Lagerbestand
                </div>
              ) : (
                <button
                  className="secondary-button"
                  onClick={() =>
                    setSelectedMaterial(null)
                  }
                >
                  ← Zurück zur Statistik
                </button>
              )}
            </header>

            <section className="statistics-range-bar">
              <div>
                <strong>Zeitraum</strong>
                <span>
                  Bewegungen und Ranglisten anpassen
                </span>
              </div>

              <div className="statistics-range-buttons">
                {(
                  [
                    ["7", "7 Tage"],
                    ["30", "30 Tage"],
                    ["90", "90 Tage"],
                    ["all", "Gesamt"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={
                      statisticsRange === value
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setStatisticsRange(value)
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {selectedMaterial === null ? (
              <>
                <section className="statistics-overview statistics-overview-eight">
                  <article className="statistics-overview-card">
                    <span>Rollenbestand</span>
                    <strong>{statisticsTotals.stock}</strong>
                    <small>{filaments.length} Filamenttypen</small>
                  </article>

                  <article className="statistics-overview-card">
                    <span>Gesamtgewicht</span>
                    <strong>
                      {(statisticsTotals.weight / 1000).toLocaleString(
                        "de-DE",
                        {
                          maximumFractionDigits: 1,
                        },
                      )}{" "}
                      kg
                    </strong>
                    <small>Aktuell im Lager</small>
                  </article>

                  <article className="statistics-overview-card">
                    <span>Eingelagert</span>
                    <strong className="green">
                      +{statisticsTotals.totalIn}
                    </strong>
                    <small>Im gewählten Zeitraum</small>
                  </article>

                  <article className="statistics-overview-card">
                    <span>Entnommen</span>
                    <strong className="red">
                      −{statisticsTotals.totalOut}
                    </strong>
                    <small>Im gewählten Zeitraum</small>
                  </article>

                  <article className="statistics-overview-card">
                    <span>Bestandsänderung</span>
                    <strong
                      className={
                        statisticsTotals.totalIn -
                          statisticsTotals.totalOut >=
                        0
                          ? "green"
                          : "red"
                      }
                    >
                      {statisticsTotals.totalIn -
                        statisticsTotals.totalOut >=
                      0
                        ? "+"
                        : ""}
                      {statisticsTotals.totalIn -
                        statisticsTotals.totalOut}
                    </strong>
                    <small>Zugänge minus Entnahmen</small>
                  </article>

                  <article className="statistics-overview-card">
                    <span>Kritische Typen</span>
                    <strong className="red">
                      {statisticsTotals.criticalCount}
                    </strong>
                    <small>Am oder unter Minimum</small>
                  </article>

                  <article className="statistics-overview-card">
                    <span>Aktivstes Material</span>
                    <strong className="statistics-text-value">
                      {mostActiveMaterial?.activity
                        ? mostActiveMaterial.material
                        : "–"}
                    </strong>
                    <small>
                      {mostActiveMaterial?.activity ?? 0} Bewegungen
                    </small>
                  </article>

                  <article className="statistics-overview-card">
                    <span>Aktivster Typ</span>
                    <strong className="statistics-text-value">
                      {mostActiveFilament
                        ? `${mostActiveFilament.filament.material} ${mostActiveFilament.filament.color}`
                        : "–"}
                    </strong>
                    <small>
                      {mostActiveFilament?.activity ?? 0} Bewegungen
                    </small>
                  </article>
                </section>

                <section className="statistics-main-grid">
                  <article className="panel statistics-chart-panel">
                    <div className="dashboard-panel-header">
                      <div>
                        <h2>Bewegungsverlauf</h2>
                        <p>
                          Einlagerungen und Entnahmen im Zeitverlauf
                        </p>
                      </div>

                      <div className="chart-legend">
                        <span>
                          <i className="chart-incoming" />
                          Eingelagert
                        </span>
                        <span>
                          <i className="chart-outgoing" />
                          Entnommen
                        </span>
                      </div>
                    </div>

                    <div className="movement-chart">
                      {movementChart.map((item) => (
                        <div
                          className="movement-chart-column"
                          key={item.label}
                        >
                          <div className="movement-chart-bars">
                            <div
                              className="movement-chart-bar movement-chart-in"
                              title={`${item.incoming} eingelagert`}
                              style={{
                                height: `${Math.max(
                                  (item.incoming /
                                    maximumChartValue) *
                                    100,
                                  item.incoming > 0 ? 8 : 0,
                                )}%`,
                              }}
                            />

                            <div
                              className="movement-chart-bar movement-chart-out"
                              title={`${item.outgoing} entnommen`}
                              style={{
                                height: `${Math.max(
                                  (item.outgoing /
                                    maximumChartValue) *
                                    100,
                                  item.outgoing > 0 ? 8 : 0,
                                )}%`,
                              }}
                            />
                          </div>

                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="panel statistics-chart-panel">
                    <div className="dashboard-panel-header">
                      <div>
                        <h2>Herstellerverteilung</h2>
                        <p>Rollenbestand nach Hersteller</p>
                      </div>
                    </div>

                    <div className="statistics-ranking-list">
                      {manufacturerSummary.map(
                        (item, index) => (
                          <div
                            className="statistics-ranking-row"
                            key={item.manufacturer}
                          >
                            <span className="statistics-rank">
                              {index + 1}
                            </span>

                            <div>
                              <strong>
                                {item.manufacturer}
                              </strong>

                              <div className="statistics-mini-bar">
                                <div
                                  style={{
                                    width: `${
                                      manufacturerSummary[0]
                                        ?.stock
                                        ? (item.stock /
                                            manufacturerSummary[0]
                                              .stock) *
                                          100
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>

                            <strong>{item.stock}</strong>
                          </div>
                        ),
                      )}
                    </div>
                  </article>
                </section>

                <section className="statistics-ranking-grid">
                  <article className="panel">
                    <div className="dashboard-panel-header">
                      <div>
                        <h2>Meist entnommen</h2>
                        <p>Top 5 im Zeitraum</p>
                      </div>
                    </div>

                    <div className="statistics-ranking-list">
                      {topOutgoing.length === 0 ? (
                        <p className="empty-message">
                          Keine Entnahmen vorhanden.
                        </p>
                      ) : (
                        topOutgoing.map((item, index) => (
                          <div
                            className="statistics-ranking-row"
                            key={item.filament.id}
                          >
                            <span className="statistics-rank">
                              {index + 1}
                            </span>

                            <div>
                              <strong>
                                {item.filament.material}{" "}
                                {item.filament.color}
                              </strong>
                              <span>
                                {item.filament.manufacturer}
                              </span>
                            </div>

                            <strong className="red">
                              {item.outgoing}
                            </strong>
                          </div>
                        ))
                      )}
                    </div>
                  </article>

                  <article className="panel">
                    <div className="dashboard-panel-header">
                      <div>
                        <h2>Meist eingelagert</h2>
                        <p>Top 5 im Zeitraum</p>
                      </div>
                    </div>

                    <div className="statistics-ranking-list">
                      {topIncoming.length === 0 ? (
                        <p className="empty-message">
                          Keine Einlagerungen vorhanden.
                        </p>
                      ) : (
                        topIncoming.map((item, index) => (
                          <div
                            className="statistics-ranking-row"
                            key={item.filament.id}
                          >
                            <span className="statistics-rank">
                              {index + 1}
                            </span>

                            <div>
                              <strong>
                                {item.filament.material}{" "}
                                {item.filament.color}
                              </strong>
                              <span>
                                {item.filament.manufacturer}
                              </span>
                            </div>

                            <strong className="green">
                              {item.incoming}
                            </strong>
                          </div>
                        ))
                      )}
                    </div>
                  </article>

                  <article className="panel">
                    <div className="dashboard-panel-header">
                      <div>
                        <h2>Größte Bestände</h2>
                        <p>Top 5 nach Rollenanzahl</p>
                      </div>
                    </div>

                    <div className="statistics-ranking-list">
                      {largestStocks.map((filament, index) => (
                        <div
                          className="statistics-ranking-row"
                          key={filament.id}
                        >
                          <span className="statistics-rank">
                            {index + 1}
                          </span>

                          <div>
                            <strong>
                              {filament.material}{" "}
                              {filament.color}
                            </strong>
                            <span>
                              {filament.manufacturer}
                            </span>
                          </div>

                          <strong>{filament.stock}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                </section>

                <section className="statistics-analysis-grid">
                  <article className="panel">
                    <div className="dashboard-panel-header">
                      <div>
                        <h2>Bestandsanalyse</h2>
                        <p>Aktueller Handlungsbedarf</p>
                      </div>
                    </div>

                    <div className="analysis-tile-grid">
                      <div>
                        <span>Ohne Bestand</span>
                        <strong className="red">
                          {zeroStockFilaments.length}
                        </strong>
                      </div>

                      <div>
                        <span>Unter Minimum</span>
                        <strong className="red">
                          {belowMinimumFilaments.length}
                        </strong>
                      </div>

                      <div>
                        <span>Genau am Minimum</span>
                        <strong>
                          {exactlyMinimumFilaments.length}
                        </strong>
                      </div>

                      <div>
                        <span>Ohne Bewegung</span>
                        <strong>
                          {withoutMovement.length}
                        </strong>
                      </div>
                    </div>
                  </article>

                  <article className="panel">
                    <div className="dashboard-panel-header">
                      <div>
                        <h2>Datenqualität</h2>
                        <p>Fehlende oder problematische Angaben</p>
                      </div>
                    </div>

                    <div className="analysis-tile-grid">
                      <div>
                        <span>Ohne Lagerort</span>
                        <strong>
                          {withoutLocation.length}
                        </strong>
                      </div>

                      <div>
                        <span>Ohne Bestelllink</span>
                        <strong>
                          {withoutOrderLink.length}
                        </strong>
                      </div>

                      <div>
                        <span>Doppelte Barcodes</span>
                        <strong
                          className={
                            duplicateBarcodes.length > 0
                              ? "red"
                              : "green"
                          }
                        >
                          {duplicateBarcodes.length}
                        </strong>
                      </div>

                      <div>
                        <span>Ohne Protokoll</span>
                        <strong>
                          {withoutMovement.length}
                        </strong>
                      </div>
                    </div>
                  </article>
                </section>

                {materialStatistics.length === 0 ? (
                  <section className="panel">
                    <p className="empty-message">
                      Noch keine Materialien vorhanden.
                    </p>
                  </section>
                ) : (
                  <section className="material-statistics-list">
                    <div className="statistics-section-heading">
                      <div>
                        <h2>Materialauswertung</h2>
                        <p>
                          Detaillierte Werte für jedes Material
                        </p>
                      </div>
                    </div>

                    {materialStatistics.map((item) => {
                      const stockPercentage =
                        (item.stock /
                          maximumMaterialStock) *
                        100;

                      return (
                        <article
                          className="material-statistics-card"
                          key={item.material}
                        >
                          <div className="material-statistics-heading">
                            <div>
                              <span className="material-statistics-label">
                                Material
                              </span>

                              <h2>{item.material}</h2>

                              <p>
                                {item.variants} Typen ·{" "}
                                {item.colors} Farben ·{" "}
                                {item.manufacturers} Hersteller
                              </p>
                            </div>

                            <div className="material-statistics-stock">
                              <strong>{item.stock}</strong>
                              <span>
                                Rollen ·{" "}
                                {item.share.toLocaleString(
                                  "de-DE",
                                  {
                                    maximumFractionDigits: 1,
                                  },
                                )}
                                %
                              </span>
                            </div>
                          </div>

                          <div className="material-stock-progress">
                            <div
                              style={{
                                width: `${stockPercentage}%`,
                              }}
                            />
                          </div>

                          <div className="material-statistics-values material-statistics-values-eight">
                            <div>
                              <span>Gewicht</span>
                              <strong>
                                {(item.weight / 1000).toLocaleString(
                                  "de-DE",
                                  {
                                    maximumFractionDigits: 1,
                                  },
                                )}{" "}
                                kg
                              </strong>
                            </div>

                            <div>
                              <span>Eingelagert</span>
                              <strong className="green">
                                +{item.totalIn}
                              </strong>
                            </div>

                            <div>
                              <span>Entnommen</span>
                              <strong className="red">
                                −{item.totalOut}
                              </strong>
                            </div>

                            <div>
                              <span>Veränderung</span>
                              <strong
                                className={
                                  item.netChange >= 0
                                    ? "green"
                                    : "red"
                                }
                              >
                                {item.netChange >= 0
                                  ? "+"
                                  : ""}
                                {item.netChange}
                              </strong>
                            </div>

                            <div>
                              <span>Kritische Typen</span>
                              <strong
                                className={
                                  item.criticalCount > 0
                                    ? "red"
                                    : "green"
                                }
                              >
                                {item.criticalCount}
                              </strong>
                            </div>

                            <div>
                              <span>Letzter Zugang</span>
                              <strong className="statistics-small-value">
                                {item.lastIn
                                  ? new Date(
                                      item.lastIn,
                                    ).toLocaleDateString(
                                      "de-DE",
                                    )
                                  : "–"}
                              </strong>
                            </div>

                            <div>
                              <span>Letzte Entnahme</span>
                              <strong className="statistics-small-value">
                                {item.lastOut
                                  ? new Date(
                                      item.lastOut,
                                    ).toLocaleDateString(
                                      "de-DE",
                                    )
                                  : "–"}
                              </strong>
                            </div>

                            <div>
                              <span>Aktivität</span>
                              <strong>{item.activity}</strong>
                            </div>
                          </div>

                          <div className="material-statistics-actions">
                            <button
                              className="primary-button"
                              onClick={() =>
                                setSelectedMaterial(
                                  item.material,
                                )
                              }
                            >
                              Details öffnen
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </section>
                )}
              </>
            ) : (
              <section className="material-detail-layout material-detail-layout-full">
                {selectedMaterialSummary && (
                  <section className="material-detail-kpis">
                    <article>
                      <span>Bestand</span>
                      <strong>
                        {selectedMaterialSummary.stock}
                      </strong>
                      <small>Rollen verfügbar</small>
                    </article>

                    <article>
                      <span>Bewegungen</span>
                      <strong>
                        {selectedMaterialSummary.activity}
                      </strong>
                      <small>Im gewählten Zeitraum</small>
                    </article>

                    <article>
                      <span>Häufigste Farbe</span>
                      <strong className="statistics-text-value">
                        {selectedMaterialTopColor?.color ??
                          "–"}
                      </strong>
                      <small>
                        {selectedMaterialTopColor?.stock ?? 0} Rollen
                      </small>
                    </article>

                    <article>
                      <span>Top-Hersteller</span>
                      <strong className="statistics-text-value">
                        {selectedMaterialTopManufacturer
                          ?.manufacturer ?? "–"}
                      </strong>
                      <small>
                        {selectedMaterialTopManufacturer?.stock ??
                          0} Rollen
                      </small>
                    </article>

                    <article>
                      <span>Ø pro Woche</span>
                      <strong>
                        {selectedMaterialWeeklyAverage ??
                          "–"}
                      </strong>
                      <small>Bewegungen</small>
                    </article>

                    <article>
                      <span>Kritische Typen</span>
                      <strong
                        className={
                          selectedMaterialSummary
                            .criticalCount > 0
                            ? "red"
                            : "green"
                        }
                      >
                        {
                          selectedMaterialSummary
                            .criticalCount
                        }
                      </strong>
                      <small>Handlungsbedarf</small>
                    </article>
                  </section>
                )}

                <article className="panel material-detail-summary">
                  <div className="dashboard-panel-header">
                    <div>
                      <h2>Varianten</h2>
                      <p>
                        Farben, Hersteller, Lagerorte und Bestand
                      </p>
                    </div>

                    <span className="material-detail-count">
                      {selectedMaterialFilaments.length} Typen
                    </span>
                  </div>

                  <div className="material-detail-table">
                    <div className="material-detail-table-head">
                      <span>Filament</span>
                      <span>Lagerort</span>
                      <span>Bestand</span>
                      <span>Status</span>
                    </div>

                    {selectedMaterialFilaments.map(
                      (filament) => {
                        const isCritical =
                          filament.stock <=
                          filament.minimumStock;

                        return (
                          <div
                            className="material-detail-row"
                            key={filament.id}
                          >
                            <div>
                              <strong>
                                {filament.color}
                              </strong>

                              <span>
                                {filament.manufacturer}
                              </span>
                            </div>

                            <span>
                              {filament.location ||
                                "Kein Lagerort"}
                            </span>

                            <strong>
                              {filament.stock} Rollen
                            </strong>

                            <span
                              className={`material-detail-status ${
                                isCritical
                                  ? "material-detail-critical"
                                  : "material-detail-ok"
                              }`}
                            >
                              {isCritical
                                ? "Kritisch"
                                : "In Ordnung"}
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                </article>

                <article className="panel material-detail-movements">
                  <div className="dashboard-panel-header">
                    <div>
                      <h2>Bewegungen</h2>
                      <p>
                        Die letzten Aktionen im gewählten Zeitraum
                      </p>
                    </div>
                  </div>

                  {selectedMaterialLogs.length === 0 ? (
                    <p className="empty-message">
                      Keine Bewegungen in diesem Zeitraum.
                    </p>
                  ) : (
                    <div className="recent-movements">
                      {selectedMaterialLogs.map(
                        (entry) => (
                          <div
                            className="recent-movement-row"
                            key={entry.id}
                          >
                            <span
                              className={`recent-movement-symbol ${
                                entry.action === "in"
                                  ? "recent-movement-in"
                                  : "recent-movement-out"
                              }`}
                            >
                              {entry.action === "in"
                                ? "+"
                                : "−"}
                            </span>

                            <div className="recent-movement-main">
                              <strong>
                                {entry.filamentName}
                              </strong>

                              <span>
                                {entry.source === "scan"
                                  ? "Barcode-Scanner"
                                  : "Manuelle Änderung"}
                              </span>
                            </div>

                            <div className="recent-movement-meta">
                              <strong>
                                {entry.stockAfter} Rollen
                              </strong>

                              <time>
                                {new Date(
                                  entry.timestamp,
                                ).toLocaleString(
                                  "de-DE",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </time>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </article>
              </section>
            )}
          </>
        )}

        {activePage === "storage" && (
          <>
            <header className="topbar">
              <div>
                <h1>Filamentlager</h1>

                <p>
                  Barcode scannen und Rollen
                  automatisch verwalten
                </p>
              </div>

              <div className="system-status">
                <span className="status-dot" />
                Scanner bereit
              </div>
            </header>

            <section className="statistics">
              <article className="stat-card">
                <span>Filamenttypen</span>

                <strong className="accent">
                  {filaments.length}
                </strong>
              </article>

              <article className="stat-card">
                <span>Rollen gesamt</span>

                <strong>
                  {totalRolls}
                </strong>
              </article>

              <article className="stat-card">
                <span>Gesamtgewicht</span>

                <strong className="blue">
                  {(
                    totalWeight / 1000
                  ).toLocaleString("de-DE")}{" "}
                  kg
                </strong>
              </article>

              <article className="stat-card">
                <span>
                  Unter Mindestbestand
                </span>

                <strong className="red">
                  {
                    criticalFilaments.length
                  }
                </strong>
              </article>
            </section>

            <section className="workspace">
              <article
                className="panel scanner-panel"
                onClick={() => inputRef.current?.focus()}
              >
                <div className="scanner-heading">
                  <h2>Barcode-Scanner</h2>

                  <span
                    className={`mode-indicator ${
                      mode === "in"
                        ? "mode-indicator-in"
                        : "mode-indicator-out"
                    }`}
                  >
                    {mode === "in"
                      ? "EINLAGERN"
                      : "ENTFERNEN"}
                  </span>
                </div>

                <div className="mode-buttons">
                  <button
                    className={`mode-button ${
                      mode === "in"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      changeMode("in")
                    }
                  >
                    + Rolle einlagern
                  </button>

                  <button
                    className={`mode-button remove ${
                      mode === "out"
                        ? "remove-active"
                        : ""
                    }`}
                    onClick={() =>
                      changeMode("out")
                    }
                  >
                    − Rolle entfernen
                  </button>
                </div>

                <input
                  ref={inputRef}
                  className="barcode-input"
                  type="text"
                  value={barcode}
                  onChange={(event) =>
                    setBarcode(
                      event.target.value,
                    )
                  }
                  onKeyDown={
                    handleBarcodeKeyDown
                  }
                  aria-label="Barcode"
                  autoFocus
                />

                <div
                  className={`scanner-message ${
                    message.includes(
                      "eingelagert",
                    )
                      ? "success-message"
                      : message.includes(
                            "entfernt",
                          ) ||
                          message.includes(
                            "nicht bekannt",
                          ) ||
                          message.includes(
                            "keinen Bestand",
                          )
                        ? "error-message"
                        : ""
                  }`}
                >
                  <span>{message}</span>

                  {unknownBarcode && (
                    <button
                      className="unknown-barcode-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCreateForm(unknownBarcode);
                      }}
                    >
                      Filament mit diesem Barcode anlegen
                    </button>
                  )}
                </div>
              </article>

              <article className="panel">
                <h2>
                  Kritische Bestände
                </h2>

                {criticalFilaments.length ===
                0 ? (
                  <p className="empty-message">
                    Keine kritischen
                    Bestände.
                  </p>
                ) : (
                  <div className="warning-list">
                    {criticalFilaments.map(
                      (filament) => (
                        <div
                          className="warning-card"
                          key={
                            filament.id
                          }
                        >
                          <div className="warning-header">
                            <strong>
                              {
                                filament.material
                              }{" "}
                              {
                                filament.color
                              }
                            </strong>

                            <span>
                              {
                                filament.stock
                              }{" "}
                              Rollen
                            </span>
                          </div>

                          <p>
                            {
                              filament.manufacturer
                            }{" "}
                            ·{" "}
                            {filament.location ||
                              "Kein Lagerort"}
                          </p>

                          <button
                            className="order-button"
                            disabled={
                              !filament.orderLink
                            }
                            onClick={() =>
                              openOrderLink(
                                filament.orderLink,
                              )
                            }
                          >
                            Nachbestellen
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </article>
            </section>
          </>
        )}

        {activePage === "filaments" && (
          <>
            <header className="topbar">
              <div>
                <h1>Filamenttypen</h1>

                <p>
                  Barcodes und zugehörige
                  Filamente verwalten
                </p>
              </div>

              <button
                className="primary-button"
                onClick={() => openCreateForm()}
              >
                + Filament hinzufügen
              </button>
            </header>

            <div className="filament-toolbar">
              <input
                className="search-input"
                type="search"
                placeholder="Filament suchen …"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
              />
            </div>

            <section className="filament-grid">
              {filteredFilaments.length ===
              0 ? (
                <div className="empty-state">
                  Keine Filamente gefunden.
                </div>
              ) : (
                filteredFilaments.map(
                  (filament) => (
                    <article
                      className={`filament-card ${
                        filament.stock <=
                        filament.minimumStock
                          ? "low-stock"
                          : ""
                      }`}
                      key={filament.id}
                    >
                      <div className="filament-card-header">
                        <div>
                          <h2>
                            {
                              filament.material
                            }{" "}
                            {
                              filament.color
                            }
                          </h2>

                          <p>
                            {
                              filament.manufacturer
                            }
                          </p>
                        </div>

                        <strong>
                          {filament.stock}
                        </strong>
                      </div>

                      <dl className="filament-details">
                        <div>
                          <dt>Barcode</dt>

                          <dd>
                            {
                              filament.barcode
                            }
                          </dd>
                        </div>

                        <div>
                          <dt>Gewicht</dt>

                          <dd>
                            {
                              filament.weightPerRoll
                            }{" "}
                            g
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Lagerort
                          </dt>

                          <dd>
                            {filament.location ||
                              "–"}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Mindestbestand
                          </dt>

                          <dd>
                            {
                              filament.minimumStock
                            }{" "}
                            Rollen
                          </dd>
                        </div>
                      </dl>

                      <div className="filament-actions">
                        <button
                          className="stock-button add"
                          onClick={() =>
                            adjustStock(
                              filament.id,
                              1,
                            )
                          }
                        >
                          + Rolle
                        </button>

                        <button
                          className="stock-button remove"
                          onClick={() =>
                            adjustStock(
                              filament.id,
                              -1,
                            )
                          }
                          disabled={
                            filament.stock === 0
                          }
                        >
                          − Rolle
                        </button>

                        {filament.orderLink && (
                          <button
                            className="order-button"
                            onClick={() =>
                              openOrderLink(
                                filament.orderLink,
                              )
                            }
                          >
                            Nachbestellen
                          </button>
                        )}

                        <button
                          className="secondary-button"
                          onClick={() =>
                            openEditForm(
                              filament,
                            )
                          }
                        >
                          Bearbeiten
                        </button>

                        <button
                          className="delete-button"
                          onClick={() =>
                            deleteFilament(
                              filament.id,
                            )
                          }
                        >
                          Löschen
                        </button>
                      </div>
                    </article>
                  ),
                )
              )}
            </section>
          </>
        )}

        {activePage === "settings" && (
          <>
            <header className="topbar">
              <div>
                <span className="welcome-label">
                  System
                </span>
                <h1>Einstellungen</h1>
                <p>
                  Philamentix Hub verwalten und zurücksetzen
                </p>
              </div>

              <div className="system-status">
                <span className="status-dot" />
                System bereit
              </div>
            </header>

            <section className="settings-grid">
              <article className="panel settings-card">
                <div className="settings-card-heading">
                  <div>
                    <span className="settings-icon">
                      ↺
                    </span>

                    <div>
                      <h2>Statistiken zurücksetzen</h2>
                      <p>
                        Entfernt alle bisherigen Lagerbewegungen und startet die Statistik bei null.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="settings-warning">
                  <strong>Achtung</strong>
                  <p>
                    Da die Statistiken aus dem Protokoll berechnet werden,
                    wird dabei auch das vollständige Ein- und
                    Auslagerungsprotokoll gelöscht. Filamente und aktuelle
                    Bestände bleiben erhalten.
                  </p>
                </div>

                <div className="settings-actions">
                  <button
                    className="danger-reset-button"
                    type="button"
                    disabled={isSaving || logs.length === 0}
                    onClick={() => void clearLogs()}
                  >
                    {isSaving
                      ? "Wird zurückgesetzt …"
                      : logs.length === 0
                        ? "Statistiken bereits leer"
                        : "Statistiken zurücksetzen"}
                  </button>
                </div>
              </article>
            </section>
          </>
        )}

        {activePage === "profile" && (
          <>
            <header className="topbar">
              <div>
                <span className="welcome-label">
                  Konto
                </span>
                <h1>Profil & Sicherheit</h1>
                <p>
                  Persönliche Daten und Zugangsdaten verwalten
                </p>
              </div>

              <div className="system-status">
                <span className="status-dot" />
                Konto geschützt
              </div>
            </header>

            {(profileMessage || profileError) && (
              <div
                className={`profile-feedback ${
                  profileError
                    ? "profile-feedback-error"
                    : "profile-feedback-success"
                }`}
              >
                {profileError || profileMessage}
              </div>
            )}

            <section className="profile-grid">
              <article className="panel profile-card profile-overview-card">
                <div className="profile-avatar">
                  {(userName || userEmail || "P")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <span className="profile-eyebrow">
                    Philamentix Hub Account
                  </span>
                  <h2>{userName}</h2>
                  <p>{userEmail}</p>
                </div>

                <div className="profile-status-row">
                  <span className="profile-status-dot" />
                  Angemeldet und synchronisiert
                </div>
              </article>

              <article className="panel profile-card">
                <div className="profile-card-heading">
                  <div>
                    <span className="profile-section-number">
                      01
                    </span>
                    <h2>Persönliche Daten</h2>
                  </div>
                  <p>
                    Dieser Name wird im Dashboard und in deinem Konto angezeigt.
                  </p>
                </div>

                <form
                  className="profile-form"
                  onSubmit={handleProfileNameUpdate}
                >
                  <label>
                    Anzeigename
                    <input
                      type="text"
                      autoComplete="name"
                      value={profileName}
                      onChange={(event) =>
                        setProfileName(event.target.value)
                      }
                      placeholder="Dein Name"
                    />
                  </label>

                  <label>
                    E-Mail-Adresse
                    <input
                      type="email"
                      value={userEmail}
                      disabled
                    />
                    <small>
                      Die E-Mail-Adresse ist mit deinem Supabase-Konto verknüpft.
                    </small>
                  </label>

                  <div className="profile-form-actions">
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={isProfileSaving}
                    >
                      {isProfileSaving
                        ? "Wird gespeichert …"
                        : "Name speichern"}
                    </button>
                  </div>
                </form>
              </article>

              <article className="panel profile-card">
                <div className="profile-card-heading">
                  <div>
                    <span className="profile-section-number">
                      02
                    </span>
                    <h2>Passwort ändern</h2>
                  </div>
                  <p>
                    Verwende mindestens acht Zeichen und ein einzigartiges Passwort.
                  </p>
                </div>

                <form
                  className="profile-form"
                  onSubmit={handleProfilePasswordUpdate}
                >
                  <label>
                    Neues Passwort
                    <input
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      value={profilePassword}
                      onChange={(event) =>
                        setProfilePassword(
                          event.target.value,
                        )
                      }
                      placeholder="Mindestens 8 Zeichen"
                    />
                  </label>

                  <label>
                    Passwort wiederholen
                    <input
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      value={profilePasswordConfirm}
                      onChange={(event) =>
                        setProfilePasswordConfirm(
                          event.target.value,
                        )
                      }
                      placeholder="Passwort erneut eingeben"
                    />
                  </label>

                  <div className="profile-form-actions">
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={isProfileSaving}
                    >
                      {isProfileSaving
                        ? "Wird gespeichert …"
                        : "Passwort aktualisieren"}
                    </button>
                  </div>
                </form>
              </article>

              <article className="panel profile-card profile-session-card">
                <div className="profile-card-heading">
                  <div>
                    <span className="profile-section-number">
                      03
                    </span>
                    <h2>Sitzung</h2>
                  </div>
                  <p>
                    Beende deine aktuelle Sitzung auf diesem Gerät.
                  </p>
                </div>

                <button
                  className="delete-button profile-logout-action"
                  type="button"
                  onClick={() => void handleLogout()}
                >
                  Von Philamentix Hub abmelden
                </button>
              </article>
            </section>
          </>
        )}

        {activePage === "log" && (
          <>
            <header className="topbar">
              <div>
                <h1>
                  Bewegungsprotokoll
                </h1>

                <p>
                  Alle Einlagerungen und
                  Entnahmen im Überblick
                </p>
              </div>

              <button
                className="delete-button"
                onClick={clearLogs}
                disabled={logs.length === 0}
              >
                Protokoll leeren
              </button>
            </header>

            {logs.length === 0 ? (
              <div className="empty-state">
                Noch keine Lagerbewegungen
                vorhanden.
              </div>
            ) : (
              <section className="log-list">
                {logs.map((entry) => (
                  <article
                    className="log-card"
                    key={entry.id}
                  >
                    <div
                      className={`log-symbol ${
                        entry.action ===
                        "in"
                          ? "log-symbol-in"
                          : "log-symbol-out"
                      }`}
                    >
                      {entry.action ===
                      "in"
                        ? "+"
                        : "−"}
                    </div>

                    <div className="log-content">
                      <div className="log-header">
                        <strong>
                          {
                            entry.filamentName
                          }
                        </strong>

                        <time>
                          {new Date(
                            entry.timestamp,
                          ).toLocaleString(
                            "de-DE",
                          )}
                        </time>
                      </div>

                      <div className="log-details">
                        <span>
                          {entry.action ===
                          "in"
                            ? "1 Rolle eingelagert"
                            : "1 Rolle entfernt"}
                        </span>

                        <span>
                          Quelle:{" "}
                          {entry.source ===
                          "scan"
                            ? "Barcode-Scanner"
                            : "Manuelle Änderung"}
                        </span>

                        <span>
                          Barcode:{" "}
                          {entry.barcode}
                        </span>

                        <span>
                          Bestand danach:{" "}
                          {
                            entry.stockAfter
                          }{" "}
                          Rollen
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </main>

      {isFormOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingId === null
                    ? "Filament hinzufügen"
                    : "Filament bearbeiten"}
                </h2>

                <p>
                  Barcode und Eigenschaften – neue oder geänderte
                  Einträge aktualisieren automatisch die zentrale Datenbank
                </p>
              </div>

              <button
                className="close-button"
                onClick={closeForm}
                type="button"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveFilament}>
              <div className="form-grid">

                <label>
                  Barcode *
                  <input
                    value={form.barcode}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        barcode:
                          event.target.value,
                      })
                    }
                    autoFocus
                  />
                </label>

                <label>
                  Hersteller *
                  <input
                    value={
                      form.manufacturer
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        manufacturer:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Material
                  <select
                    value={form.material}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        material:
                          event.target.value,
                      })
                    }
                  >
                    <option>PLA</option>
                    <option>PLA Basic</option>
                    <option>PETG</option>
                    <option>PETG HF</option>
                    <option>PETG Translucent</option>
                    <option>PETG-CF</option>
                    <option>ASA</option>
                    <option>ABS</option>
                    <option>TPU</option>
                    <option>PA</option>
                    <option>PC</option>
                    <option>
                      Sonstiges
                    </option>
                  </select>
                </label>

                <label>
                  Farbe *
                  <input
                    value={form.color}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        color:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Gewicht pro Rolle in
                  Gramm
                  <input
                    type="number"
                    min="1"
                    value={
                      form.weightPerRoll
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        weightPerRoll:
                          Number(
                            event.target
                              .value,
                          ),
                      })
                    }
                  />
                </label>

                <label>
                  Lagerort
                  <input
                    value={form.location}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        location:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Aktueller Bestand
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        stock: Number(
                          event.target.value,
                        ),
                      })
                    }
                  />
                </label>

                <label>
                  Mindestbestand
                  <input
                    type="number"
                    min="0"
                    value={
                      form.minimumStock
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        minimumStock:
                          Number(
                            event.target
                              .value,
                          ),
                      })
                    }
                  />
                </label>

                <label className="full-width">
                  Bestelllink – optional
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.orderLink}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        orderLink:
                          event.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={closeForm}
                >
                  Abbrechen
                </button>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Wird gespeichert …"
                    : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}