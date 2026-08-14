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
  | "production"
  | "profile"
  | "settings";

export type MaintenanceMode = "maintenance" | "available" | "hidden";
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
    id: "production",
    label: "Produktionszentrum",
    shortLabel: "Produktion",
    description: "Produktionsboard, Druckjobs und Maschinenzuordnung.",
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
  if (pathname === "/produktion" || pathname.startsWith("/produktion/")) {
    return "production";
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
  hidden: boolean;
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

  const applicable = enabledRules
    .filter((rule) => {
      const appliesToUser =
        rule.scope === "global" ||
        (rule.scope === "user" && rule.user_id === userId);
      const appliesToArea = rule.area === area || rule.area === "all";

      return appliesToUser && appliesToArea;
    })
    .map((rule) => {
      const updatedAt = Date.parse(rule.updated_at ?? "") || 0;
      const specificity =
        rule.scope === "user" && rule.area === area
          ? 4
          : rule.scope === "global" && rule.area === area
            ? 3
            : rule.scope === "user" && rule.area === "all"
              ? 2
              : 1;

      return { rule, updatedAt, specificity };
    })
    .sort((left, right) => {
      if (right.updatedAt !== left.updatedAt) {
        return right.updatedAt - left.updatedAt;
      }

      return right.specificity - left.specificity;
    });

  const winner = applicable[0]?.rule ?? null;

  if (!winner) {
    return {
      blocked: false,
      hidden: false,
      mode: null,
      message: "",
      source: "none",
      rule: null,
    };
  }

  const source: MaintenanceResolution["source"] =
    winner.scope === "user" && winner.area === area
      ? "user-area"
      : winner.scope === "user" && winner.area === "all"
        ? "user-all"
        : winner.scope === "global" && winner.area === area
          ? "global-area"
          : "global-all";

  return {
    blocked: winner.mode === "maintenance",
    hidden: winner.mode === "hidden",
    mode: winner.mode,
    message:
      winner.mode === "maintenance"
        ? winner.message.trim() || DEFAULT_MAINTENANCE_MESSAGE
        : "",
    source,
    rule: winner,
  };
}
