export type MaintenanceArea =
  | "all"
  | "dashboard"
  | "statistics"
  | "storage"
  | "filaments"
  | "reorder"
  | "logs"
  | "orders"
  | "print_library"
  | "profile"
  | "settings";

export type MaintenanceMode = "maintenance" | "available";
export type MaintenanceScope = "global" | "user";

export type MaintenanceRule = {
  id: string;
  scope: MaintenanceScope;
  user_id: string | null;
  area: MaintenanceArea;
  mode: MaintenanceMode;
  message: string;
  enabled: boolean;
  updated_at?: string;
};

export const DEFAULT_MAINTENANCE_MESSAGE =
  "Dieser Bereich wird gerade gewartet. Bitte versuche es später erneut.";

export const MAINTENANCE_AREAS: ReadonlyArray<{
  id: MaintenanceArea;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "all",
    label: "Gesamter Hub",
    shortLabel: "Alles",
    description: "Sperrt alle normalen Bereiche gleichzeitig.",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    shortLabel: "Dashboard",
    description: "Übersicht und Widgets.",
  },
  {
    id: "statistics",
    label: "Statistiken",
    shortLabel: "Statistik",
    description: "Auswertungen und Kennzahlen.",
  },
  {
    id: "storage",
    label: "Ein-/Auslagerung",
    shortLabel: "Lagerbuchung",
    description: "Scanner und Bestandsbuchungen.",
  },
  {
    id: "filaments",
    label: "Filamenttypen",
    shortLabel: "Filamente",
    description: "Filamentliste, Details und Neuanlage.",
  },
  {
    id: "reorder",
    label: "Nachbestellen",
    shortLabel: "Nachbestellen",
    description: "Kritische Bestände und Bestellübersicht.",
  },
  {
    id: "logs",
    label: "Protokoll",
    shortLabel: "Protokoll",
    description: "Bestands- und Bewegungsprotokoll.",
  },
  {
    id: "orders",
    label: "Aufträge",
    shortLabel: "Aufträge",
    description: "Auftragsverwaltung und Produktion.",
  },
  {
    id: "print_library",
    label: "Druckbibliothek",
    shortLabel: "Druckbibliothek",
    description: "Modelle, Dateien und Projekte.",
  },
  {
    id: "profile",
    label: "Profil & Sicherheit",
    shortLabel: "Profil",
    description: "Profil- und Sicherheitseinstellungen.",
  },
  {
    id: "settings",
    label: "Einstellungen",
    shortLabel: "Einstellungen",
    description: "Darstellung, Vorgaben und Backup.",
  },
];

export function isMaintenanceArea(
  value: unknown,
): value is MaintenanceArea {
  return MAINTENANCE_AREAS.some(
    (area) => area.id === value,
  );
}

export function maintenanceAreaForPathname(
  pathname: string,
): MaintenanceArea | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "dashboard";
  }
  if (pathname === "/statistiken" || pathname.startsWith("/statistiken/")) {
    return "statistics";
  }
  if (pathname === "/ein-auslagern" || pathname.startsWith("/ein-auslagern/")) {
    return "storage";
  }
  if (pathname === "/filamente" || pathname.startsWith("/filamente/")) {
    return "filaments";
  }
  if (pathname === "/nachbestellen" || pathname.startsWith("/nachbestellen/")) {
    return "reorder";
  }
  if (pathname === "/protokoll" || pathname.startsWith("/protokoll/")) {
    return "logs";
  }
  if (pathname === "/auftraege" || pathname.startsWith("/auftraege/")) {
    return "orders";
  }
  if (
    pathname === "/druckbibliothek" ||
    pathname.startsWith("/druckbibliothek/")
  ) {
    return "print_library";
  }
  if (pathname === "/profil" || pathname.startsWith("/profil/")) {
    return "profile";
  }
  if (
    pathname === "/einstellungen" ||
    pathname.startsWith("/einstellungen/")
  ) {
    return "settings";
  }

  return null;
}

export type MaintenanceResolution = {
  blocked: boolean;
  mode: MaintenanceMode | null;
  message: string;
  source: "user-area" | "user-all" | "global-area" | "global-all" | "none";
  rule: MaintenanceRule | null;
};

export function resolveMaintenance(
  rules: MaintenanceRule[],
  userId: string,
  area: MaintenanceArea,
): MaintenanceResolution {
  const enabledRules = rules.filter((rule) => rule.enabled !== false);

  const findRule = (
    scope: MaintenanceScope,
    ruleArea: MaintenanceArea,
  ) =>
    enabledRules.find(
      (rule) =>
        rule.scope === scope &&
        rule.area === ruleArea &&
        (scope === "global"
          ? rule.user_id === null
          : rule.user_id === userId),
    ) ?? null;

  const candidates: Array<{
    rule: MaintenanceRule | null;
    source: MaintenanceResolution["source"];
  }> = [];

  candidates.push({
    rule: findRule("user", area),
    source: "user-area",
  });

  if (area !== "all") {
    candidates.push({
      rule: findRule("user", "all"),
      source: "user-all",
    });
  }

  candidates.push({
    rule: findRule("global", area),
    source: "global-area",
  });

  if (area !== "all") {
    candidates.push({
      rule: findRule("global", "all"),
      source: "global-all",
    });
  }

  const winner = candidates.find((candidate) => candidate.rule);

  if (!winner?.rule) {
    return {
      blocked: false,
      mode: null,
      message: "",
      source: "none",
      rule: null,
    };
  }

  return {
    blocked: winner.rule.mode === "maintenance",
    mode: winner.rule.mode,
    message:
      winner.rule.mode === "maintenance"
        ? winner.rule.message.trim() || DEFAULT_MAINTENANCE_MESSAGE
        : "",
    source: winner.source,
    rule: winner.rule,
  };
}
