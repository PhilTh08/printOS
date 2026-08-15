"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { QRCodeSVG } from "qrcode.react";

import { useHub } from "@/components/philamentix/hub-provider";
import type { Filament } from "@/components/philamentix/types";
import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

const REQUIRED_RELEASE = "18.0";
const RELEASE_FLEET = "18.1";
const RELEASE_PLANNING = "18.2";
const RELEASE_QUALITY = "18.3";
const RELEASE_LABELS = "18.4";

const JOB_STATUSES = [
  "queue",
  "preparation",
  "printing",
  "quality_check",
  "completed",
  "failed",
  "cancelled",
] as const;

type JobStatus = (typeof JOB_STATUSES)[number];
type JobPriority = "low" | "normal" | "high" | "urgent";
type ProductionTab = "board" | "fleet" | "planning" | "quality" | "labels";
type QualityResult = "passed" | "failed";

type ProductionJobRow = {
  id: string;
  user_id: string;
  title: string;
  order_id: string | null;
  print_project_id: string | null;
  print_file_id: string | null;
  filament_id: number | null;
  printer_id: string | null;
  parent_job_id: string | null;
  status: JobStatus;
  priority: JobPriority;
  quantity: number;
  material_grams: number;
  estimated_minutes: number;
  progress_percent: number;
  queue_position: number;
  planned_start_at: string | null;
  planned_finish_at: string | null;
  label_code: string;
  label_print_count: number;
  label_last_printed_at: string | null;
  runtime_accounted_at: string | null;
  notes: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProductionPrinterRow = {
  id: string;
  user_id: string;
  name: string;
  model: string;
  serial_number: string;
  nozzle_mm: number;
  location: string;
  notes: string;
  active: boolean;
  print_minutes_total: number;
  print_minutes_at_last_maintenance: number;
  maintenance_interval_hours: number;
  last_maintenance_at: string | null;
  created_at: string;
  updated_at: string;
};

type MaintenanceLogRow = {
  id: string;
  user_id: string;
  printer_id: string;
  kind: string;
  notes: string;
  performed_at: string;
  print_minutes_at_service: number;
  created_at: string;
};

type QualityCheckRow = {
  id: string;
  user_id: string;
  job_id: string;
  result: QualityResult;
  visual_ok: boolean;
  dimensions_ok: boolean;
  adhesion_ok: boolean;
  color_ok: boolean;
  damage_free: boolean;
  failure_reason: string;
  notes: string;
  checked_at: string;
  created_at: string;
};

type OrderOption = {
  id: string;
  title: string;
  customer_name: string;
  status: string;
  due_date: string | null;
};

type PrintProjectOption = {
  id: string;
  name: string;
};

type PrintFileOption = {
  id: string;
  project_id: string;
  file_name: string;
  file_type: string;
  version_number: number;
  source_missing: boolean;
  created_at: string;
};

type JobForm = {
  title: string;
  orderId: string;
  printFileId: string;
  filamentId: string;
  printerId: string;
  status: JobStatus;
  priority: JobPriority;
  quantity: string;
  materialGrams: string;
  estimatedMinutes: string;
  progressPercent: string;
  notes: string;
};

type PrinterForm = {
  name: string;
  model: string;
  serialNumber: string;
  nozzleMm: string;
  location: string;
  maintenanceIntervalHours: string;
  notes: string;
};

type QualityForm = {
  visualOk: boolean;
  dimensionsOk: boolean;
  adhesionOk: boolean;
  colorOk: boolean;
  damageFree: boolean;
  failureReason: string;
  notes: string;
  createReprint: boolean;
};

const EMPTY_JOB_FORM: JobForm = {
  title: "",
  orderId: "",
  printFileId: "",
  filamentId: "",
  printerId: "",
  status: "queue",
  priority: "normal",
  quantity: "1",
  materialGrams: "0",
  estimatedMinutes: "0",
  progressPercent: "0",
  notes: "",
};

const EMPTY_PRINTER_FORM: PrinterForm = {
  name: "A1",
  model: "Bambu Lab A1",
  serialNumber: "",
  nozzleMm: "0.4",
  location: "",
  maintenanceIntervalHours: "100",
  notes: "",
};

const EMPTY_QUALITY_FORM: QualityForm = {
  visualOk: true,
  dimensionsOk: true,
  adhesionOk: true,
  colorOk: true,
  damageFree: true,
  failureReason: "",
  notes: "",
  createReprint: true,
};

const BOARD_COLUMNS: Array<{ status: JobStatus; label: string; shortLabel: string }> = [
  { status: "queue", label: "Warteschlange", shortLabel: "Queue" },
  { status: "preparation", label: "Vorbereitung", shortLabel: "Prep" },
  { status: "printing", label: "Druckt", shortLabel: "Druck" },
  { status: "completed", label: "Fertig", shortLabel: "Fertig" },
];

const PRIORITY_LABELS: Record<JobPriority, string> = {
  low: "Niedrig",
  normal: "Normal",
  high: "Hoch",
  urgent: "Dringend",
};

const STATUS_LABELS: Record<JobStatus, string> = {
  queue: "Warteschlange",
  preparation: "Vorbereitung",
  printing: "Druckt",
  quality_check: "Qualitätsprüfung",
  completed: "Fertig",
  failed: "Fehler",
  cancelled: "Abgebrochen",
};

const PRIORITY_WEIGHT: Record<JobPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const PRINTABLE_EXTENSIONS = new Set([
  "3mf",
  "stl",
  "obj",
  "step",
  "stp",
  "amf",
  "gcode",
  "bgcode",
]);

const RESERVING_STATUSES = new Set<JobStatus>([
  "queue",
  "preparation",
  "printing",
  "quality_check",
]);

function errorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  return "code" in error && typeof error.code === "string" ? error.code : "";
}

function errorMessage(error: unknown): string {
  if (
    typeof error !== "object" ||
    error === null ||
    !("message" in error) ||
    typeof error.message !== "string"
  ) {
    return "";
  }
  return error.message;
}

function isSetupMissing(error: unknown): boolean {
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(errorCode(error));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: string | number | null | undefined, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMinutes(value: number): string {
  if (value <= 0) return "—";
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  if (hours <= 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function orderCode(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function filamentName(filament: Filament | undefined): string {
  if (!filament) return "Kein Filament";
  return [filament.manufacturer, filament.material, filament.color]
    .filter(Boolean)
    .join(" ");
}

function jobToForm(job: ProductionJobRow): JobForm {
  return {
    title: job.title,
    orderId: job.order_id ?? "",
    printFileId: job.print_file_id ?? "",
    filamentId: job.filament_id == null ? "" : String(job.filament_id),
    printerId: job.printer_id ?? "",
    status: job.status,
    priority: job.priority,
    quantity: String(job.quantity),
    materialGrams: String(job.material_grams),
    estimatedMinutes: String(job.estimated_minutes),
    progressPercent: String(job.progress_percent),
    notes: job.notes,
  };
}

function printerToForm(printer: ProductionPrinterRow): PrinterForm {
  return {
    name: printer.name,
    model: printer.model,
    serialNumber: printer.serial_number ?? "",
    nozzleMm: String(printer.nozzle_mm ?? 0.4),
    location: printer.location,
    maintenanceIntervalHours: String(printer.maintenance_interval_hours ?? 100),
    notes: printer.notes,
  };
}

function dueTimestamp(order: OrderOption | undefined): number {
  if (!order?.due_date) return Number.MAX_SAFE_INTEGER;
  const timestamp = new Date(order.due_date).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function maintenanceState(printer: ProductionPrinterRow) {
  const intervalMinutes = Math.max(1, safeNumber(printer.maintenance_interval_hours, 100) * 60);
  const since = Math.max(
    0,
    safeNumber(printer.print_minutes_total) -
      safeNumber(printer.print_minutes_at_last_maintenance),
  );
  const remaining = intervalMinutes - since;
  const progress = clamp(Math.round((since / intervalMinutes) * 100), 0, 999);
  return {
    intervalMinutes,
    since,
    remaining,
    progress,
    due: remaining <= 0,
    soon: remaining > 0 && remaining <= Math.max(120, intervalMinutes * 0.15),
  };
}


const CODE39_PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  "$": "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

function normalizeBarcodeValue(value: string): string {
  return value.trim().toUpperCase();
}

function parseScannedJobCode(value: string): { labelCode?: string; jobId?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};

  try {
    const url = new URL(trimmed);
    const label = url.searchParams.get("label") || undefined;
    const jobId = url.searchParams.get("job") || undefined;
    return { labelCode: label ? normalizeBarcodeValue(label) : undefined, jobId };
  } catch {
    // no-op
  }

  const inlineMatch = trimmed.match(/[?&](label|job)=([^&#]+)/i);
  if (inlineMatch) {
    const key = inlineMatch[1].toLowerCase();
    const value = decodeURIComponent(inlineMatch[2]);
    return key === "label"
      ? { labelCode: normalizeBarcodeValue(value) }
      : { jobId: value };
  }

  return { labelCode: normalizeBarcodeValue(trimmed) };
}

function Code39Barcode({ value, className }: { value: string; className?: string }) {
  const normalized = normalizeBarcodeValue(value);
  if (!normalized) return null;

  const encoded = `*${normalized}*`;
  const narrow = 2;
  const wide = 5;
  const gap = 2;
  const quietZone = 10;
  const barHeight = 54;

  const bars: Array<{ x: number; width: number }> = [];
  let x = quietZone;

  for (const char of encoded) {
    const pattern = CODE39_PATTERNS[char];
    if (!pattern) continue;

    for (let index = 0; index < pattern.length; index += 1) {
      const width = pattern[index] === "w" ? wide : narrow;
      const isBar = index % 2 === 0;
      if (isBar) bars.push({ x, width });
      x += width;
    }

    x += gap;
  }

  const totalWidth = x + quietZone - gap;
  const textY = barHeight + 14;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${textY + 4}`}
      className={className}
      role="img"
      aria-label={`Barcode ${normalized}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width={totalWidth} height={textY + 4} fill="#ffffff" />
      {bars.map((bar, index) => (
        <rect
          key={`${bar.x}-${bar.width}-${index}`}
          x={bar.x}
          y="0"
          width={bar.width}
          height={barHeight}
          fill="#111111"
        />
      ))}
      <text
        x={totalWidth / 2}
        y={textY}
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontSize="10"
        letterSpacing="1.4"
        fill="#111111"
      >
        {normalized}
      </text>
    </svg>
  );
}

export default function ProductionPage() {
  const { user, filaments, releaseInfo, releaseReady, hasReleaseAccess } = useHub();

  const access18_1 = releaseReady && hasReleaseAccess(RELEASE_FLEET);
  const access18_2 = releaseReady && hasReleaseAccess(RELEASE_PLANNING);
  const access18_3 = releaseReady && hasReleaseAccess(RELEASE_QUALITY);
  const access18_4 = releaseReady && hasReleaseAccess(RELEASE_LABELS);
  const betaFeatureAvailable = releaseReady && hasReleaseAccess(REQUIRED_RELEASE);

  const [activeTab, setActiveTab] = useState<ProductionTab>("board");
  const [jobs, setJobs] = useState<ProductionJobRow[]>([]);
  const [printers, setPrinters] = useState<ProductionPrinterRow[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLogRow[]>([]);
  const [qualityChecks, setQualityChecks] = useState<QualityCheckRow[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [projects, setProjects] = useState<PrintProjectOption[]>([]);
  const [files, setFiles] = useState<PrintFileOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [setupMissing, setSetupMissing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | JobPriority>("all");

  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<JobForm>(EMPTY_JOB_FORM);

  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [printerForm, setPrinterForm] = useState<PrinterForm>(EMPTY_PRINTER_FORM);

  const [qualityJobId, setQualityJobId] = useState<string | null>(null);
  const [qualityForm, setQualityForm] = useState<QualityForm>(EMPTY_QUALITY_FORM);

  const [labelJobId, setLabelJobId] = useState<string | null>(null);
  const [labelPartNumber, setLabelPartNumber] = useState(1);
  const [scanValue, setScanValue] = useState("");

  const loadedOnceRef = useRef(false);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const refreshInFlightRef = useRef(false);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const openedFromQrRef = useRef(false);

  const loadProduction = useCallback(
    async (options?: { foreground?: boolean }) => {
      if (!user || !betaFeatureAvailable) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (refreshInFlightRef.current) return;

      refreshInFlightRef.current = true;
      const firstLoad = !loadedOnceRef.current;
      const foreground = options?.foreground === true;
      if (firstLoad) setLoading(true);
      else if (foreground) setRefreshing(true);
      if (firstLoad || foreground) setError("");

      try {
        const [
          jobsResult,
          printersResult,
          maintenanceResult,
          qualityResult,
          ordersResult,
          projectsResult,
          filesResult,
        ] = await Promise.all([
          supabase
            .from("production_jobs")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("production_printers")
            .select("*")
            .eq("user_id", user.id)
            .order("name", { ascending: true }),
          supabase
            .from("production_maintenance_logs")
            .select("*")
            .eq("user_id", user.id)
            .order("performed_at", { ascending: false })
            .limit(100),
          supabase
            .from("production_quality_checks")
            .select("*")
            .eq("user_id", user.id)
            .order("checked_at", { ascending: false })
            .limit(150),
          supabase
            .from("orders")
            .select("id,title,customer_name,status,due_date")
            .eq("user_id", user.id)
            .neq("status", "cancelled")
            .order("created_at", { ascending: false }),
          supabase
            .from("print_projects")
            .select("id,name")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false }),
          supabase
            .from("print_project_files")
            .select("id,project_id,file_name,file_type,version_number,source_missing,created_at")
            .eq("user_id", user.id)
            .eq("is_preview", false)
            .order("created_at", { ascending: false }),
        ]);

        const coreError = jobsResult.error ?? printersResult.error;
        const extensionError = maintenanceResult.error ?? qualityResult.error;
        if (coreError || extensionError) {
          const productionError = coreError ?? extensionError;
          if (isSetupMissing(productionError)) {
            setSetupMissing(true);
            return;
          }
          setError(errorMessage(productionError) || "Produktionsdaten konnten nicht geladen werden.");
          return;
        }

        setSetupMissing(false);

        const nextJobs = (jobsResult.data ?? []) as ProductionJobRow[];
        const nextPrinters = (printersResult.data ?? []) as ProductionPrinterRow[];
        const nextMaintenance = (maintenanceResult.data ?? []) as MaintenanceLogRow[];
        const nextQuality = (qualityResult.data ?? []) as QualityCheckRow[];

        setJobs((current) =>
          JSON.stringify(current) === JSON.stringify(nextJobs) ? current : nextJobs,
        );
        setPrinters((current) =>
          JSON.stringify(current) === JSON.stringify(nextPrinters) ? current : nextPrinters,
        );
        setMaintenanceLogs((current) =>
          JSON.stringify(current) === JSON.stringify(nextMaintenance) ? current : nextMaintenance,
        );
        setQualityChecks((current) =>
          JSON.stringify(current) === JSON.stringify(nextQuality) ? current : nextQuality,
        );

        if (!ordersResult.error) {
          const nextOrders = (ordersResult.data ?? []) as OrderOption[];
          setOrders((current) =>
            JSON.stringify(current) === JSON.stringify(nextOrders) ? current : nextOrders,
          );
        }
        if (!projectsResult.error) {
          const nextProjects = (projectsResult.data ?? []) as PrintProjectOption[];
          setProjects((current) =>
            JSON.stringify(current) === JSON.stringify(nextProjects) ? current : nextProjects,
          );
        }
        if (!filesResult.error) {
          const nextFiles = ((filesResult.data ?? []) as PrintFileOption[]).filter((file) =>
            PRINTABLE_EXTENSIONS.has(String(file.file_type).toLowerCase()),
          );
          setFiles((current) =>
            JSON.stringify(current) === JSON.stringify(nextFiles) ? current : nextFiles,
          );
        }

        loadedOnceRef.current = true;
      } finally {
        refreshInFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [betaFeatureAvailable, user],
  );

  const scheduleBackgroundRefresh = useCallback(
    (delay = 450) => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        realtimeRefreshTimerRef.current = null;
        void loadProduction();
      }, delay);
    },
    [loadProduction],
  );

  useEffect(() => {
    void loadProduction();
  }, [loadProduction]);

  useEffect(() => {
    if (!user || !betaFeatureAvailable || setupMissing) return;

    const channel = supabase
      .channel(`production-v184-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_jobs", filter: `user_id=eq.${user.id}` },
        () => scheduleBackgroundRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_printers", filter: `user_id=eq.${user.id}` },
        () => scheduleBackgroundRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_maintenance_logs", filter: `user_id=eq.${user.id}` },
        () => scheduleBackgroundRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_quality_checks", filter: `user_id=eq.${user.id}` },
        () => scheduleBackgroundRefresh(),
      )
      .subscribe();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") scheduleBackgroundRefresh(0);
    }, 60000);

    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") scheduleBackgroundRefresh(100);
    };

    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("pageshow", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);

    return () => {
      window.clearInterval(interval);
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("pageshow", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
      void supabase.removeChannel(channel);
    };
  }, [betaFeatureAvailable, scheduleBackgroundRefresh, setupMissing, user]);

  useEffect(() => {
    if (activeTab === "fleet" && !access18_1) setActiveTab("board");
    if (activeTab === "planning" && !access18_2) setActiveTab("board");
    if (activeTab === "quality" && !access18_3) setActiveTab("board");
    if (activeTab === "labels" && !access18_4) setActiveTab("board");
  }, [access18_1, access18_2, access18_3, access18_4, activeTab]);

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
  const orderMap = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const fileMap = useMemo(
    () => new Map(files.map((file) => [file.id, file])),
    [files],
  );
  const filamentMap = useMemo(
    () => new Map(filaments.map((filament) => [filament.id, filament])),
    [filaments],
  );
  const printerMap = useMemo(
    () => new Map(printers.map((printer) => [printer.id, printer])),
    [printers],
  );

  const reservedByFilament = useMemo(() => {
    const map = new Map<number, number>();
    for (const job of jobs) {
      if (job.filament_id == null || !RESERVING_STATUSES.has(job.status)) continue;
      map.set(job.filament_id, (map.get(job.filament_id) ?? 0) + safeNumber(job.material_grams));
    }
    return map;
  }, [jobs]);

  const printerJobLoad = useMemo(() => {
    const load = new Map<string, number>();
    for (const printer of printers) load.set(printer.id, 0);
    for (const job of jobs) {
      if (!job.printer_id || !["queue", "preparation", "printing"].includes(job.status)) continue;
      const base = safeNumber(job.estimated_minutes);
      const remaining = job.status === "printing"
        ? base * (1 - clamp(job.progress_percent, 0, 100) / 100)
        : base;
      load.set(job.printer_id, (load.get(job.printer_id) ?? 0) + Math.max(0, remaining));
    }
    return load;
  }, [jobs, printers]);

  const filteredJobs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return jobs
      .filter((job) => {
        if (priorityFilter !== "all" && job.priority !== priorityFilter) return false;
        if (!needle) return true;
        const order = job.order_id ? orderMap.get(job.order_id) : undefined;
        const file = job.print_file_id ? fileMap.get(job.print_file_id) : undefined;
        const printer = job.printer_id ? printerMap.get(job.printer_id) : undefined;
        const filament = job.filament_id == null ? undefined : filamentMap.get(job.filament_id);
        return [
          job.title,
          job.notes,
          job.label_code,
          order?.title,
          order?.customer_name,
          file?.file_name,
          printer?.name,
          printer?.model,
          filamentName(filament),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((left, right) => {
        const priority = PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority];
        if (priority !== 0) return priority;
        const leftDue = dueTimestamp(left.order_id ? orderMap.get(left.order_id) : undefined);
        const rightDue = dueTimestamp(right.order_id ? orderMap.get(right.order_id) : undefined);
        if (leftDue !== rightDue) return leftDue - rightDue;
        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      });
  }, [filamentMap, fileMap, jobs, orderMap, printerMap, priorityFilter, search]);

  const metrics = useMemo(() => {
    const reserved = Array.from(reservedByFilament.values()).reduce((sum, value) => sum + value, 0);
    const due = printers.filter((printer) => maintenanceState(printer).due).length;
    return {
      queue: jobs.filter((job) => job.status === "queue").length,
      printing: jobs.filter((job) => job.status === "printing").length,
      reserved,
      quality: jobs.filter((job) => job.status === "quality_check").length,
      maintenanceDue: due,
    };
  }, [jobs, printers, reservedByFilament]);

  const selectedFilament = jobForm.filamentId
    ? filamentMap.get(Number(jobForm.filamentId))
    : undefined;
  const plannedGrams = safeNumber(jobForm.materialGrams);
  const editingJob = editingJobId ? jobs.find((job) => job.id === editingJobId) : undefined;
  const reservedForSelected = selectedFilament
    ? reservedByFilament.get(selectedFilament.id) ?? 0
    : 0;
  const ownExistingReservation =
    editingJob && selectedFilament && editingJob.filament_id === selectedFilament.id && RESERVING_STATUSES.has(editingJob.status)
      ? safeNumber(editingJob.material_grams)
      : 0;
  const totalSelectedGrams = selectedFilament
    ? selectedFilament.stock * selectedFilament.weightPerRoll
    : 0;
  const availableForSelected = Math.max(
    0,
    totalSelectedGrams - reservedForSelected + ownExistingReservation,
  );
  const materialWarning = Boolean(
    access18_2 && selectedFilament && plannedGrams > availableForSelected,
  );

  const selectedQualityJob = qualityJobId
    ? jobs.find((job) => job.id === qualityJobId)
    : undefined;
  const selectedLabelJob = labelJobId
    ? jobs.find((job) => job.id === labelJobId)
    : undefined;

  useEffect(() => {
    if (!access18_4 || openedFromQrRef.current || jobs.length === 0 || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const label = params.get("label");
    const jobId = params.get("job");
    const match = jobs.find((job) => (label && job.label_code === label) || (jobId && job.id === jobId));
    if (match) {
      openedFromQrRef.current = true;
      setActiveTab("labels");
      setLabelPartNumber(1);
      setLabelJobId(match.id);
    }
  }, [access18_4, jobs]);

  useEffect(() => {
    if (activeTab !== "labels" || !access18_4) return;
    const timer = window.setTimeout(() => scannerInputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [activeTab, access18_4, labelJobId]);

  function openCreateJob() {
    setEditingJobId(null);
    setJobForm(EMPTY_JOB_FORM);
    setJobModalOpen(true);
    setError("");
    setMessage("");
  }

  function openEditJob(job: ProductionJobRow) {
    setEditingJobId(job.id);
    setJobForm(jobToForm(job));
    setJobModalOpen(true);
    setError("");
    setMessage("");
  }

  function closeJobModal() {
    if (saving) return;
    setJobModalOpen(false);
    setEditingJobId(null);
    setJobForm(EMPTY_JOB_FORM);
  }

  function handleOrderSelection(orderId: string) {
    const order = orderMap.get(orderId);
    setJobForm((current) => ({
      ...current,
      orderId,
      title:
        current.title.trim() || !order
          ? current.title
          : `${order.title}${order.customer_name ? ` · ${order.customer_name}` : ""}`,
    }));
  }

  function handleFileSelection(fileId: string) {
    const file = fileMap.get(fileId);
    setJobForm((current) => ({
      ...current,
      printFileId: fileId,
      title: current.title.trim() || !file ? current.title : file.file_name,
    }));
  }

  async function saveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const title = jobForm.title.trim();
    if (!title) {
      setError("Bitte einen Namen für den Produktionsjob eingeben.");
      return;
    }

    const file = jobForm.printFileId ? fileMap.get(jobForm.printFileId) : undefined;
    const quantity = Math.max(1, Math.round(safeNumber(jobForm.quantity, 1)));
    const materialGrams = Math.max(0, safeNumber(jobForm.materialGrams));
    const estimatedMinutes = Math.max(0, Math.round(safeNumber(jobForm.estimatedMinutes)));
    const progressPercent = clamp(Math.round(safeNumber(jobForm.progressPercent)), 0, 100);
    const existingJob = editingJobId ? jobs.find((job) => job.id === editingJobId) : undefined;
    const now = new Date().toISOString();

    const payload = {
      user_id: user.id,
      title,
      order_id: jobForm.orderId || null,
      print_project_id: file?.project_id ?? null,
      print_file_id: jobForm.printFileId || null,
      filament_id: jobForm.filamentId ? Number(jobForm.filamentId) : null,
      printer_id: jobForm.printerId || null,
      status: jobForm.status,
      priority: jobForm.priority,
      quantity,
      material_grams: materialGrams,
      estimated_minutes: estimatedMinutes,
      progress_percent: progressPercent,
      notes: jobForm.notes.trim(),
      started_at:
        ["printing", "quality_check", "completed"].includes(jobForm.status)
          ? existingJob?.started_at ?? now
          : null,
      completed_at:
        jobForm.status === "completed" ? existingJob?.completed_at ?? now : null,
    };

    setSaving(true);
    setError("");
    setMessage("");
    const result = editingJobId
      ? await supabase.from("production_jobs").update(payload).eq("id", editingJobId).eq("user_id", user.id)
      : await supabase.from("production_jobs").insert(payload);
    setSaving(false);

    if (result.error) {
      if (isSetupMissing(result.error)) setSetupMissing(true);
      setError(errorMessage(result.error) || "Produktionsjob konnte nicht gespeichert werden.");
      return;
    }

    setJobModalOpen(false);
    setEditingJobId(null);
    setJobForm(EMPTY_JOB_FORM);
    setMessage(editingJobId ? "Produktionsjob aktualisiert." : "Produktionsjob angelegt.");
    await loadProduction();
  }

  async function updateJobStatus(job: ProductionJobRow, status: JobStatus) {
    if (!user || saving) return;
    const now = new Date().toISOString();
    const updates: Partial<ProductionJobRow> = {
      status,
      progress_percent:
        ["quality_check", "completed"].includes(status) ? 100 : status === "queue" ? 0 : job.progress_percent,
    };
    if (status === "printing" && !job.started_at) updates.started_at = now;
    if (status === "completed") updates.completed_at = now;
    else if (job.status === "completed") updates.completed_at = null;

    setSaving(true);
    setError("");
    const { error: updateError } = await supabase
      .from("production_jobs")
      .update(updates)
      .eq("id", job.id)
      .eq("user_id", user.id);
    setSaving(false);
    if (updateError) {
      setError(errorMessage(updateError) || "Status konnte nicht geändert werden.");
      return;
    }
    await loadProduction();
  }

  async function finishPrint(job: ProductionJobRow) {
    await updateJobStatus(job, access18_3 ? "quality_check" : "completed");
  }

  async function updateProgress(job: ProductionJobRow, value: number) {
    if (!user) return;
    const progress = clamp(Math.round(value), 0, 100);
    setJobs((current) =>
      current.map((item) => (item.id === job.id ? { ...item, progress_percent: progress } : item)),
    );
    const { error: updateError } = await supabase
      .from("production_jobs")
      .update({ progress_percent: progress })
      .eq("id", job.id)
      .eq("user_id", user.id);
    if (updateError) setError(errorMessage(updateError) || "Fortschritt konnte nicht gespeichert werden.");
  }

  async function deleteJob(job: ProductionJobRow) {
    if (!user || !window.confirm(`Produktionsjob „${job.title}“ wirklich löschen?`)) return;
    setSaving(true);
    const { error: deleteError } = await supabase
      .from("production_jobs")
      .delete()
      .eq("id", job.id)
      .eq("user_id", user.id);
    setSaving(false);
    if (deleteError) {
      setError(errorMessage(deleteError) || "Produktionsjob konnte nicht gelöscht werden.");
      return;
    }
    setMessage("Produktionsjob gelöscht.");
    await loadProduction();
  }

  function openCreatePrinter() {
    setEditingPrinterId(null);
    setPrinterForm(EMPTY_PRINTER_FORM);
    setPrinterModalOpen(true);
  }

  function openEditPrinter(printer: ProductionPrinterRow) {
    setEditingPrinterId(printer.id);
    setPrinterForm(printerToForm(printer));
    setPrinterModalOpen(true);
  }

  async function savePrinter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const name = printerForm.name.trim();
    if (!name) {
      setError("Bitte einen Druckernamen eingeben.");
      return;
    }

    const payload = {
      user_id: user.id,
      name,
      model: printerForm.model.trim(),
      serial_number: printerForm.serialNumber.trim(),
      nozzle_mm: Math.max(0.1, safeNumber(printerForm.nozzleMm, 0.4)),
      location: printerForm.location.trim(),
      maintenance_interval_hours: Math.max(1, safeNumber(printerForm.maintenanceIntervalHours, 100)),
      notes: printerForm.notes.trim(),
      active: editingPrinterId
        ? printers.find((printer) => printer.id === editingPrinterId)?.active ?? true
        : true,
    };

    setSaving(true);
    setError("");
    const result = editingPrinterId
      ? await supabase.from("production_printers").update(payload).eq("id", editingPrinterId).eq("user_id", user.id)
      : await supabase.from("production_printers").insert(payload);
    setSaving(false);

    if (result.error) {
      if (isSetupMissing(result.error)) setSetupMissing(true);
      setError(errorMessage(result.error) || "Drucker konnte nicht gespeichert werden.");
      return;
    }

    setPrinterModalOpen(false);
    setEditingPrinterId(null);
    setPrinterForm(EMPTY_PRINTER_FORM);
    setMessage(editingPrinterId ? "Drucker aktualisiert." : "Drucker hinzugefügt.");
    await loadProduction();
  }

  async function togglePrinter(printer: ProductionPrinterRow) {
    if (!user) return;
    const { error: updateError } = await supabase
      .from("production_printers")
      .update({ active: !printer.active })
      .eq("id", printer.id)
      .eq("user_id", user.id);
    if (updateError) {
      setError(errorMessage(updateError) || "Druckerstatus konnte nicht geändert werden.");
      return;
    }
    await loadProduction();
  }

  async function deletePrinter(printer: ProductionPrinterRow) {
    if (!user || !window.confirm(`Drucker „${printer.name}“ wirklich entfernen?`)) return;
    const { error: deleteError } = await supabase
      .from("production_printers")
      .delete()
      .eq("id", printer.id)
      .eq("user_id", user.id);
    if (deleteError) {
      setError(errorMessage(deleteError) || "Drucker konnte nicht entfernt werden.");
      return;
    }
    await loadProduction();
  }

  async function completeMaintenance(printer: ProductionPrinterRow) {
    if (!user) return;
    const notes = window.prompt("Was wurde gewartet?", "Drucker gereinigt / Achsen geprüft / Druckbett gereinigt") ?? "";
    if (notes === "" && !window.confirm("Wartung ohne Notiz speichern?")) return;

    setSaving(true);
    setError("");
    const now = new Date().toISOString();
    const { error: logError } = await supabase.from("production_maintenance_logs").insert({
      user_id: user.id,
      printer_id: printer.id,
      kind: "service",
      notes: notes.trim(),
      performed_at: now,
      print_minutes_at_service: Math.round(safeNumber(printer.print_minutes_total)),
    });
    if (!logError) {
      const { error: printerError } = await supabase
        .from("production_printers")
        .update({
          last_maintenance_at: now,
          print_minutes_at_last_maintenance: Math.round(safeNumber(printer.print_minutes_total)),
        })
        .eq("id", printer.id)
        .eq("user_id", user.id);
      if (printerError) {
        setSaving(false);
        setError(errorMessage(printerError) || "Wartungsstand konnte nicht gespeichert werden.");
        return;
      }
    }
    setSaving(false);
    if (logError) {
      setError(errorMessage(logError) || "Wartung konnte nicht protokolliert werden.");
      return;
    }
    setMessage(`Wartung für ${printer.name} protokolliert.`);
    await loadProduction();
  }

  async function runSmartPlanner() {
    if (!user || !access18_2 || saving) return;
    const activePrinters = printers.filter((printer) => printer.active);
    if (activePrinters.length === 0) {
      setError("Für die Smart Queue ist mindestens ein aktiver Drucker nötig.");
      return;
    }

    const preferredPrinters = activePrinters.filter((printer) => !maintenanceState(printer).due);
    const planningPrinters = preferredPrinters.length > 0 ? preferredPrinters : activePrinters;
    const now = Date.now();
    const load = new Map<string, number>();

    for (const printer of planningPrinters) {
      let minutes = 0;
      for (const job of jobs) {
        if (job.printer_id !== printer.id) continue;
        if (job.status === "printing") {
          minutes += Math.max(0, safeNumber(job.estimated_minutes) * (1 - clamp(job.progress_percent, 0, 100) / 100));
        }
      }
      load.set(printer.id, minutes);
    }

    const queue = jobs
      .filter((job) => ["queue", "preparation"].includes(job.status))
      .sort((a, b) => {
        const byPriority = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
        if (byPriority !== 0) return byPriority;
        const aDue = dueTimestamp(a.order_id ? orderMap.get(a.order_id) : undefined);
        const bDue = dueTimestamp(b.order_id ? orderMap.get(b.order_id) : undefined);
        if (aDue !== bDue) return aDue - bDue;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    const positionByPrinter = new Map<string, number>();
    const updates: Array<{ id: string; printer_id: string; queue_position: number; planned_start_at: string; planned_finish_at: string }> = [];

    for (const job of queue) {
      let target = planningPrinters.find((printer) => printer.id === job.printer_id);
      if (!target) {
        target = planningPrinters.reduce((best, printer) =>
          (load.get(printer.id) ?? 0) < (load.get(best.id) ?? 0) ? printer : best,
        );
      }
      const currentLoad = load.get(target.id) ?? 0;
      const start = new Date(now + currentLoad * 60000);
      const duration = Math.max(1, safeNumber(job.estimated_minutes, 1));
      const finish = new Date(start.getTime() + duration * 60000);
      const position = (positionByPrinter.get(target.id) ?? 0) + 1;
      positionByPrinter.set(target.id, position);
      load.set(target.id, currentLoad + duration);
      updates.push({
        id: job.id,
        printer_id: target.id,
        queue_position: position,
        planned_start_at: start.toISOString(),
        planned_finish_at: finish.toISOString(),
      });
    }

    setSaving(true);
    setError("");
    const results = await Promise.all(
      updates.map((item) =>
        supabase
          .from("production_jobs")
          .update({
            printer_id: item.printer_id,
            queue_position: item.queue_position,
            planned_start_at: item.planned_start_at,
            planned_finish_at: item.planned_finish_at,
          })
          .eq("id", item.id)
          .eq("user_id", user.id),
      ),
    );
    setSaving(false);
    const failed = results.find((result) => result.error)?.error;
    if (failed) {
      setError(errorMessage(failed) || "Smart Queue konnte nicht vollständig gespeichert werden.");
      return;
    }
    setMessage(`${updates.length} Jobs wurden automatisch geplant.`);
    await loadProduction();
  }

  function openQualityCheck(job: ProductionJobRow) {
    setQualityJobId(job.id);
    setQualityForm(EMPTY_QUALITY_FORM);
  }

  async function saveQualityCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !selectedQualityJob) return;
    const passed =
      qualityForm.visualOk &&
      qualityForm.dimensionsOk &&
      qualityForm.adhesionOk &&
      qualityForm.colorOk &&
      qualityForm.damageFree;
    const result: QualityResult = passed ? "passed" : "failed";
    if (!passed && !qualityForm.failureReason.trim()) {
      setError("Bitte bei einer fehlgeschlagenen Prüfung einen Fehlergrund angeben.");
      return;
    }

    setSaving(true);
    setError("");
    const now = new Date().toISOString();
    const { error: checkError } = await supabase.from("production_quality_checks").insert({
      user_id: user.id,
      job_id: selectedQualityJob.id,
      result,
      visual_ok: qualityForm.visualOk,
      dimensions_ok: qualityForm.dimensionsOk,
      adhesion_ok: qualityForm.adhesionOk,
      color_ok: qualityForm.colorOk,
      damage_free: qualityForm.damageFree,
      failure_reason: qualityForm.failureReason.trim(),
      notes: qualityForm.notes.trim(),
      checked_at: now,
    });

    if (checkError) {
      setSaving(false);
      setError(errorMessage(checkError) || "Qualitätsprüfung konnte nicht gespeichert werden.");
      return;
    }

    const nextStatus: JobStatus = passed ? "completed" : "failed";
    const { error: jobError } = await supabase
      .from("production_jobs")
      .update({
        status: nextStatus,
        completed_at: passed ? now : null,
        progress_percent: 100,
      })
      .eq("id", selectedQualityJob.id)
      .eq("user_id", user.id);

    if (jobError) {
      setSaving(false);
      setError(errorMessage(jobError) || "Jobstatus konnte nach der Prüfung nicht gespeichert werden.");
      return;
    }

    if (!passed && qualityForm.createReprint) {
      const reprintPayload = {
        user_id: user.id,
        title: `${selectedQualityJob.title} · Nachdruck`,
        order_id: selectedQualityJob.order_id,
        print_project_id: selectedQualityJob.print_project_id,
        print_file_id: selectedQualityJob.print_file_id,
        filament_id: selectedQualityJob.filament_id,
        printer_id: null,
        parent_job_id: selectedQualityJob.id,
        status: "queue",
        priority: selectedQualityJob.priority,
        quantity: selectedQualityJob.quantity,
        material_grams: selectedQualityJob.material_grams,
        estimated_minutes: selectedQualityJob.estimated_minutes,
        progress_percent: 0,
        notes: `Automatischer Nachdruck nach QS-Fehler: ${qualityForm.failureReason.trim()}`,
      };
      const { error: reprintError } = await supabase.from("production_jobs").insert(reprintPayload);
      if (reprintError) {
        setSaving(false);
        setError(errorMessage(reprintError) || "QS gespeichert, aber Nachdruck konnte nicht erstellt werden.");
        await loadProduction();
        return;
      }
    }

    setSaving(false);
    setQualityJobId(null);
    setQualityForm(EMPTY_QUALITY_FORM);
    setMessage(passed ? "Qualitätsprüfung bestanden – Job freigegeben." : "QS fehlgeschlagen – Job als Fehler markiert.");
    await loadProduction();
  }

  function openLabel(job: ProductionJobRow) {
    setActiveTab("labels");
    setLabelJobId(job.id);
    setLabelPartNumber(1);
  }

  function handleScanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseScannedJobCode(scanValue);
    if (!parsed.labelCode && !parsed.jobId) {
      setError("Kein gültiger Barcode-/QR-Inhalt erkannt.");
      return;
    }

    const match = jobs.find((job) => (parsed.labelCode && normalizeBarcodeValue(job.label_code) === parsed.labelCode) || (parsed.jobId && job.id === parsed.jobId));

    if (!match) {
      setError(`Kein Produktionsjob zu „${scanValue.trim()}“ gefunden.`);
      return;
    }

    setError("");
    setMessage(`Produktionsjob „${match.title}“ geöffnet.`);
    setScanValue("");
    openLabel(match);
  }

  async function printLabel() {
    if (!user || !selectedLabelJob) return;
    window.print();
    const { error: updateError } = await supabase
      .from("production_jobs")
      .update({
        label_print_count: safeNumber(selectedLabelJob.label_print_count) + 1,
        label_last_printed_at: new Date().toISOString(),
      })
      .eq("id", selectedLabelJob.id)
      .eq("user_id", user.id);
    if (!updateError) scheduleBackgroundRefresh(150);
  }

  const labelUrl = selectedLabelJob && typeof window !== "undefined"
    ? `${window.location.origin}/produktion?label=${encodeURIComponent(selectedLabelJob.label_code)}`
    : "";

  const visibleTabs: Array<{ id: ProductionTab; label: string; release: string }> = [
    { id: "board", label: "Board", release: "18.0" },
    ...(access18_1 ? [{ id: "fleet" as const, label: "Drucker-Flotte", release: "18.1" }] : []),
    ...(access18_2 ? [{ id: "planning" as const, label: "Smart Planung", release: "18.2" }] : []),
    ...(access18_3 ? [{ id: "quality" as const, label: "Qualität", release: "18.3" }] : []),
    ...(access18_4 ? [{ id: "labels" as const, label: "Etiketten", release: "18.4" }] : []),
  ];

  if (!releaseReady) {
    return <main className={styles.page}><section className={styles.loadingCard}>Release-Zugriff wird geprüft …</section></main>;
  }

  if (!betaFeatureAvailable) {
    return (
      <main className={styles.page}>
        <section className={styles.lockedCard}>
          <span className={styles.lockedKicker}>BETA FEATURE · V18.0+</span>
          <h1>Produktionszentrum ist für diesen Release noch nicht freigeschaltet</h1>
          <p>
            Dein aktiver Release ist <strong>{releaseInfo.channel} // {releaseInfo.version}</strong>.
            Für dieses Modul wird mindestens Version 18.0 benötigt.
          </p>
          <div className={styles.lockedHint}>Beta-Tester erhalten die neuen Ausbaustufen schrittweise über 18.1 bis 18.4.</div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.kickerRow}>
            <span className={styles.kicker}>PRODUKTION</span>
            {releaseInfo.audience === "beta" && <span className={styles.betaBadge}>BETA {releaseInfo.version}</span>}
          </div>
          <h1>Produktionszentrum</h1>
          <p>Von der Warteschlange über Material und Qualitätsprüfung bis zum QR-Etikett.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} type="button" onClick={() => void loadProduction({ foreground: true })} disabled={refreshing}>
            {refreshing ? "Aktualisiere …" : "↻ Aktualisieren"}
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => access18_1 ? setActiveTab("fleet") : openCreatePrinter()}>
            Drucker verwalten
          </button>
          <button className={styles.primaryButton} type="button" onClick={openCreateJob}>+ Produktionsjob</button>
        </div>
      </header>

      <section className={styles.betaBanner}>
        <div>
          <strong>🧪 RELEASE-GATING AKTIV</strong>
          <span>18.0 Board</span>
          <span className={access18_1 ? styles.releaseOn : styles.releaseOff}>18.1 Flotte</span>
          <span className={access18_2 ? styles.releaseOn : styles.releaseOff}>18.2 Planung</span>
          <span className={access18_3 ? styles.releaseOn : styles.releaseOff}>18.3 QS</span>
          <span className={access18_4 ? styles.releaseOn : styles.releaseOff}>18.4 QR</span>
        </div>
        <p>Ein Deploy, aber die Ausbaustufen werden über deine Beta-Version freigeschaltet.</p>
      </section>

      {setupMissing && (
        <section className={styles.setupCard}>
          <strong>Supabase-Migration fehlt</strong>
          <p>Bitte <code>supabase/production_v18_1_to_v18_4.sql</code> einmal vollständig im Supabase SQL Editor ausführen.</p>
        </section>
      )}
      {error && <section className={styles.errorBanner}>{error}</section>}
      {message && <section className={styles.successBanner}>{message}</section>}

      {!setupMissing && (
        <>
          <nav className={styles.tabBar} aria-label="Produktionsmodule">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? styles.tabActive : styles.tabButton}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}<small>V{tab.release}</small>
              </button>
            ))}
          </nav>

          <section className={styles.metricsGrid}>
            <article className={styles.metricCard}><span>Warteschlange</span><strong>{metrics.queue}</strong><small>offene Jobs</small></article>
            <article className={styles.metricCard}><span>Druckt</span><strong>{metrics.printing}</strong><small>aktive Drucke</small></article>
            <article className={styles.metricCard}><span>Reserviert</span><strong>{Math.round(metrics.reserved)} g</strong><small>Material in aktiven Jobs</small></article>
            <article className={styles.metricCard}>
              <span>{access18_3 ? "QS wartet" : access18_1 ? "Wartung fällig" : "Drucker"}</span>
              <strong>{access18_3 ? metrics.quality : access18_1 ? metrics.maintenanceDue : printers.filter((printer) => printer.active).length}</strong>
              <small>{access18_3 ? "Prüfungen" : access18_1 ? "Maschinen" : "aktiv"}</small>
            </article>
          </section>

          {loading ? (
            <section className={styles.loadingCard}>Produktionsdaten werden geladen …</section>
          ) : (
            <>
              {activeTab === "board" && (
                <section className={styles.moduleSection}>
                  <div className={styles.sectionHeader}>
                    <div><span>V18.0</span><h2>Produktionsboard</h2></div>
                    {access18_2 && <button className={styles.smartButton} type="button" onClick={() => void runSmartPlanner()} disabled={saving}>⚡ Smart planen</button>}
                  </div>

                  <div className={styles.toolbar}>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Jobs, Auftrag, Datei, Drucker oder Label suchen …" />
                    <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as "all" | JobPriority)}>
                      <option value="all">Alle Prioritäten</option>
                      <option value="urgent">Dringend</option>
                      <option value="high">Hoch</option>
                      <option value="normal">Normal</option>
                      <option value="low">Niedrig</option>
                    </select>
                  </div>

                  <div className={styles.board}>
                    {BOARD_COLUMNS.map((column) => {
                      const columnJobs = filteredJobs.filter((job) => {
                        if (column.status === "completed" && !access18_3 && job.status === "quality_check") return true;
                        return job.status === column.status;
                      });
                      return (
                        <section className={styles.boardColumn} key={column.status}>
                          <header><div><span>{column.shortLabel}</span><strong>{column.label}</strong></div><b>{columnJobs.length}</b></header>
                          <div className={styles.jobStack}>
                            {columnJobs.length === 0 && <div className={styles.emptyColumn}>Keine Jobs</div>}
                            {columnJobs.map((job) => {
                              const order = job.order_id ? orderMap.get(job.order_id) : undefined;
                              const file = job.print_file_id ? fileMap.get(job.print_file_id) : undefined;
                              const printer = job.printer_id ? printerMap.get(job.printer_id) : undefined;
                              const filament = job.filament_id == null ? undefined : filamentMap.get(job.filament_id);
                              const total = filament ? filament.stock * filament.weightPerRoll : 0;
                              const reserved = job.filament_id == null ? 0 : reservedByFilament.get(job.filament_id) ?? 0;
                              const shortage = Boolean(filament && reserved > total);
                              return (
                                <article className={`${styles.jobCard} ${styles[`priority_${job.priority}`]}`} key={job.id}>
                                  <div className={styles.jobTopline}>
                                    <span className={styles.priorityBadge}>{PRIORITY_LABELS[job.priority]}</span>
                                    {access18_4 && job.label_code && <button type="button" className={styles.codeButton} onClick={() => openLabel(job)}>{job.label_code}</button>}
                                  </div>
                                  <h3>{job.title}</h3>
                                  <div className={styles.jobMeta}>
                                    {order && <span>{orderCode(order.id)} · {order.customer_name || order.title}</span>}
                                    {file && <span>{projectMap.get(file.project_id) ?? "Datei"} / {file.file_name} · V{file.version_number}</span>}
                                    <span>{printer ? `🖨 ${printer.name}` : "🖨 Noch kein Drucker"}</span>
                                    <span className={shortage ? styles.warningText : undefined}>{filament ? `◉ ${filamentName(filament)} · ${Math.round(job.material_grams)} g` : "◉ Kein Material"}</span>
                                  </div>
                                  {access18_2 && job.planned_start_at && (
                                    <div className={styles.planLine}><span>Start {formatDateTime(job.planned_start_at)}</span><span>Ende {formatDateTime(job.planned_finish_at)}</span></div>
                                  )}
                                  <div className={styles.jobNumbers}>
                                    <span>{job.quantity}×</span><span>{formatMinutes(job.estimated_minutes)}</span>{access18_2 && job.queue_position > 0 && <span>Queue #{job.queue_position}</span>}
                                  </div>
                                  {job.status === "printing" && (
                                    <div className={styles.progressBlock}>
                                      <div><span>Fortschritt</span><strong>{job.progress_percent}%</strong></div>
                                      <input type="range" min="0" max="100" step="5" value={job.progress_percent} onChange={(event) => void updateProgress(job, Number(event.target.value))} />
                                    </div>
                                  )}
                                  {job.status === "quality_check" && access18_3 && <div className={styles.qualityPending}>✓ Druck fertig · wartet auf Qualitätsprüfung</div>}
                                  <div className={styles.jobActions}>
                                    <button type="button" onClick={() => openEditJob(job)}>Bearbeiten</button>
                                    {job.status === "queue" && <button type="button" onClick={() => void updateJobStatus(job, "preparation")}>Vorbereiten</button>}
                                    {job.status === "preparation" && <button type="button" onClick={() => void updateJobStatus(job, "printing")}>▶ Start</button>}
                                    {job.status === "printing" && <button type="button" onClick={() => void finishPrint(job)}>{access18_3 ? "✓ Druck fertig → QS" : "✓ Fertig"}</button>}
                                    {job.status === "quality_check" && access18_3 && <button type="button" onClick={() => openQualityCheck(job)}>QS prüfen</button>}
                                    {job.status === "completed" && access18_4 && <button type="button" onClick={() => openLabel(job)}>QR-Etikett</button>}
                                    {!["completed", "failed", "cancelled"].includes(job.status) && <button type="button" onClick={() => void updateJobStatus(job, "failed")}>Fehler</button>}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>

                  <details className={styles.archiveBox}>
                    <summary>Fehler / Abgebrochen ({jobs.filter((job) => ["failed", "cancelled"].includes(job.status)).length})</summary>
                    <div className={styles.archiveList}>
                      {jobs.filter((job) => ["failed", "cancelled"].includes(job.status)).map((job) => (
                        <div key={job.id}><span><strong>{job.title}</strong><small>{STATUS_LABELS[job.status]}</small></span><span><button type="button" onClick={() => void updateJobStatus(job, "queue")}>Wieder einplanen</button><button type="button" onClick={() => void deleteJob(job)}>Löschen</button></span></div>
                      ))}
                    </div>
                  </details>
                </section>
              )}

              {activeTab === "fleet" && access18_1 && (
                <section className={styles.moduleSection}>
                  <div className={styles.sectionHeader}>
                    <div><span>V18.1 BETA</span><h2>Drucker-Flotte & Wartung</h2><p>Druckstunden, Wartungsintervalle und aktuelle Maschinenlast.</p></div>
                    <button className={styles.primaryButton} type="button" onClick={openCreatePrinter}>+ Drucker</button>
                  </div>
                  <div className={styles.printerGrid}>
                    {printers.map((printer) => {
                      const maintenance = maintenanceState(printer);
                      const activeJob = jobs.find((job) => job.printer_id === printer.id && job.status === "printing");
                      return (
                        <article className={styles.printerCard} key={printer.id}>
                          <div className={styles.printerHead}>
                            <div><span className={printer.active ? styles.onlineDot : styles.offlineDot} /> <strong>{printer.name}</strong><small>{printer.model}</small></div>
                            <span className={maintenance.due ? styles.dueBadge : maintenance.soon ? styles.soonBadge : styles.okBadge}>{maintenance.due ? "WARTUNG FÄLLIG" : maintenance.soon ? "BALD FÄLLIG" : "OK"}</span>
                          </div>
                          <div className={styles.printerStats}><div><span>Druckzeit</span><strong>{(safeNumber(printer.print_minutes_total) / 60).toFixed(1)} h</strong></div><div><span>Queue</span><strong>{formatMinutes(printerJobLoad.get(printer.id) ?? 0)}</strong></div><div><span>Düse</span><strong>{printer.nozzle_mm || 0.4} mm</strong></div></div>
                          <div className={styles.maintenanceMeter}><div><span>Seit Wartung</span><b>{formatMinutes(maintenance.since)} / {formatMinutes(maintenance.intervalMinutes)}</b></div><div className={styles.meterTrack}><i style={{ width: `${Math.min(100, maintenance.progress)}%` }} /></div></div>
                          <div className={styles.printerCurrent}>{activeJob ? <>● Druckt: <strong>{activeJob.title}</strong> · {activeJob.progress_percent}%</> : <>○ {printer.active ? "Bereit" : "Deaktiviert"}</>}</div>
                          <div className={styles.printerMeta}>{printer.serial_number && <span>SN {printer.serial_number}</span>}{printer.location && <span>{printer.location}</span>}<span>Letzte Wartung: {formatDate(printer.last_maintenance_at)}</span></div>
                          <div className={styles.cardActions}><button type="button" onClick={() => openEditPrinter(printer)}>Bearbeiten</button><button type="button" onClick={() => void completeMaintenance(printer)}>✓ Wartung erledigt</button><button type="button" onClick={() => void togglePrinter(printer)}>{printer.active ? "Deaktivieren" : "Aktivieren"}</button><button type="button" onClick={() => void deletePrinter(printer)}>Entfernen</button></div>
                        </article>
                      );
                    })}
                    {printers.length === 0 && <div className={styles.emptyState}>Noch keine Drucker angelegt.</div>}
                  </div>

                  <div className={styles.historyCard}>
                    <h3>Wartungsprotokoll</h3>
                    {maintenanceLogs.length === 0 ? <p>Noch keine Wartungen protokolliert.</p> : maintenanceLogs.slice(0, 20).map((log) => <div className={styles.historyRow} key={log.id}><span><strong>{printerMap.get(log.printer_id)?.name ?? "Drucker"}</strong><small>{log.notes || log.kind}</small></span><time>{formatDateTime(log.performed_at)}</time></div>)}
                  </div>
                </section>
              )}

              {activeTab === "planning" && access18_2 && (
                <section className={styles.moduleSection}>
                  <div className={styles.sectionHeader}>
                    <div><span>V18.2 BETA</span><h2>Materialreservierung & Smart Queue</h2><p>Aktive Jobs reservieren Material automatisch. Die Smart Queue verteilt Jobs nach Priorität, Termin und Maschinenlast.</p></div>
                    <button className={styles.smartButton} type="button" onClick={() => void runSmartPlanner()} disabled={saving}>⚡ Jetzt automatisch planen</button>
                  </div>

                  <div className={styles.materialGrid}>
                    {filaments.map((filament) => {
                      const total = filament.stock * filament.weightPerRoll;
                      const reserved = reservedByFilament.get(filament.id) ?? 0;
                      const available = total - reserved;
                      return (
                        <article className={available < 0 ? styles.materialDanger : styles.materialCard} key={filament.id}>
                          <span>{filamentName(filament)}</span><strong>{Math.round(available)} g verfügbar</strong>
                          <div><small>Bestand {Math.round(total)} g</small><small>Reserviert {Math.round(reserved)} g</small></div>
                          <div className={styles.materialBar}><i style={{ width: `${total > 0 ? Math.min(100, (reserved / total) * 100) : 0}%` }} /></div>
                        </article>
                      );
                    })}
                  </div>

                  <div className={styles.planTable}>
                    <div className={styles.planTableHead}><span>Pos.</span><span>Job</span><span>Drucker</span><span>Start</span><span>Fertig</span><span>Material</span></div>
                    {jobs.filter((job) => ["queue", "preparation", "printing"].includes(job.status)).sort((a, b) => (a.planned_start_at ? new Date(a.planned_start_at).getTime() : Number.MAX_SAFE_INTEGER) - (b.planned_start_at ? new Date(b.planned_start_at).getTime() : Number.MAX_SAFE_INTEGER)).map((job) => {
                      const filament = job.filament_id == null ? undefined : filamentMap.get(job.filament_id);
                      const total = filament ? filament.stock * filament.weightPerRoll : 0;
                      const reserved = job.filament_id == null ? 0 : reservedByFilament.get(job.filament_id) ?? 0;
                      return <div className={styles.planTableRow} key={job.id}><span>{job.queue_position || "—"}</span><span><strong>{job.title}</strong><small>{PRIORITY_LABELS[job.priority]}</small></span><span>{job.printer_id ? printerMap.get(job.printer_id)?.name ?? "—" : "Nicht zugewiesen"}</span><span>{formatDateTime(job.planned_start_at)}</span><span>{formatDateTime(job.planned_finish_at)}</span><span className={reserved > total ? styles.warningText : undefined}>{Math.round(job.material_grams)} g</span></div>;
                    })}
                  </div>
                </section>
              )}

              {activeTab === "quality" && access18_3 && (
                <section className={styles.moduleSection}>
                  <div className={styles.sectionHeader}><div><span>V18.3 BETA</span><h2>Qualitätskontrolle & Nachdrucke</h2><p>Ein Druck gilt erst nach der QS als fertig. Fehler können direkt einen Nachdruck erzeugen.</p></div></div>
                  <div className={styles.qualityGrid}>
                    {jobs.filter((job) => job.status === "quality_check").map((job) => (
                      <article className={styles.qualityCard} key={job.id}><div><span>WARTET AUF QS</span><h3>{job.title}</h3><p>{job.printer_id ? printerMap.get(job.printer_id)?.name : "Kein Drucker"} · {Math.round(job.material_grams)} g · {formatMinutes(job.estimated_minutes)}</p></div><button className={styles.primaryButton} type="button" onClick={() => openQualityCheck(job)}>Prüfung starten</button></article>
                    ))}
                    {jobs.filter((job) => job.status === "quality_check").length === 0 && <div className={styles.emptyState}>Aktuell wartet kein Job auf eine Qualitätsprüfung.</div>}
                  </div>
                  <div className={styles.historyCard}>
                    <h3>QS-Historie</h3>
                    {qualityChecks.length === 0 ? <p>Noch keine Qualitätsprüfungen.</p> : qualityChecks.slice(0, 30).map((check) => <div className={styles.historyRow} key={check.id}><span><strong>{jobs.find((job) => job.id === check.job_id)?.title ?? "Produktionsjob"}</strong><small>{check.result === "passed" ? "✓ bestanden" : `✕ ${check.failure_reason || "fehlgeschlagen"}`}</small></span><time>{formatDateTime(check.checked_at)}</time></div>)}
                  </div>
                </section>
              )}

              {activeTab === "labels" && access18_4 && (
                <section className={styles.moduleSection}>
                  <div className={styles.sectionHeader}><div><span>V18.4 BETA</span><h2>Produktionsetiketten, QR & Barcode</h2><p>QR-Code fürs Handy, Barcode für deinen Handscanner: beides öffnet den passenden Produktionsjob direkt im Hub.</p></div></div>
                  <div className={styles.scanCard}>
                    <div>
                      <strong>Handscanner / Barcode öffnen</strong>
                      <p>Scanne den Produktionscode oder einen QR-Link. Der Job öffnet sich direkt, ohne langes Suchen.</p>
                    </div>
                    <form className={styles.scanForm} onSubmit={handleScanSubmit}>
                      <input
                        ref={scannerInputRef}
                        value={scanValue}
                        onChange={(event) => setScanValue(event.target.value)}
                        placeholder="PH-7A2D39C14F82 oder kompletter QR-Link"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button type="submit" className={styles.primaryButton}>Öffnen</button>
                    </form>
                    <small className={styles.scanHint}>Tipp: Viele Handscanner senden am Ende automatisch Enter – dann öffnet sich der Job direkt.</small>
                  </div>
                  <div className={styles.labelList}>
                    {jobs.filter((job) => !["cancelled"].includes(job.status)).map((job) => {
                      const order = job.order_id ? orderMap.get(job.order_id) : undefined;
                      return <article className={styles.labelRow} key={job.id}><div><span className={styles.labelCode}>{job.label_code || "Wird erzeugt"}</span><strong>{job.title}</strong><small>{order ? `${orderCode(order.id)} · ${order.customer_name || order.title}` : STATUS_LABELS[job.status]} · {job.label_print_count || 0}× gedruckt</small></div><button type="button" onClick={() => openLabel(job)}>Etikett öffnen</button></article>;
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {jobModalOpen && (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeJobModal(); }}>
          <form className={styles.modal} onSubmit={saveJob}>
            <div className={styles.modalHeader}><div><span>{editingJobId ? "JOB BEARBEITEN" : "NEUER JOB"}</span><h2>{editingJobId ? "Produktionsjob bearbeiten" : "Produktionsjob anlegen"}</h2></div><button type="button" onClick={closeJobModal}>×</button></div>
            <div className={styles.formGrid}>
              <label className={styles.fullField}><span>Name</span><input value={jobForm.title} onChange={(event) => setJobForm((current) => ({ ...current, title: event.target.value }))} placeholder="z. B. Halterung Kunde Max" required /></label>
              <label><span>Auftrag</span><select value={jobForm.orderId} onChange={(event) => handleOrderSelection(event.target.value)}><option value="">Kein Auftrag</option>{orders.map((order) => <option value={order.id} key={order.id}>{orderCode(order.id)} · {order.customer_name || order.title}</option>)}</select></label>
              <label><span>Druckdatei</span><select value={jobForm.printFileId} onChange={(event) => handleFileSelection(event.target.value)}><option value="">Keine Datei</option>{files.map((file) => <option value={file.id} key={file.id}>{projectMap.get(file.project_id) ?? "Projekt"} · {file.file_name} · V{file.version_number}</option>)}</select></label>
              <label><span>Filament</span><select value={jobForm.filamentId} onChange={(event) => setJobForm((current) => ({ ...current, filamentId: event.target.value }))}><option value="">Kein Filament</option>{filaments.map((filament) => <option value={filament.id} key={filament.id}>{filamentName(filament)}</option>)}</select></label>
              <label><span>Drucker</span><select value={jobForm.printerId} onChange={(event) => setJobForm((current) => ({ ...current, printerId: event.target.value }))}><option value="">Noch nicht zuweisen</option>{printers.filter((printer) => printer.active || printer.id === jobForm.printerId).map((printer) => <option value={printer.id} key={printer.id}>{printer.name} · {printer.model}</option>)}</select></label>
              <label><span>Priorität</span><select value={jobForm.priority} onChange={(event) => setJobForm((current) => ({ ...current, priority: event.target.value as JobPriority }))}><option value="low">Niedrig</option><option value="normal">Normal</option><option value="high">Hoch</option><option value="urgent">Dringend</option></select></label>
              <label><span>Status</span><select value={jobForm.status} onChange={(event) => setJobForm((current) => ({ ...current, status: event.target.value as JobStatus }))}>{JOB_STATUSES.filter((status) => access18_3 || status !== "quality_check").map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}</select></label>
              <label><span>Stückzahl</span><input inputMode="numeric" value={jobForm.quantity} onChange={(event) => setJobForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
              <label><span>Material gesamt (g)</span><input inputMode="decimal" value={jobForm.materialGrams} onChange={(event) => setJobForm((current) => ({ ...current, materialGrams: event.target.value }))} /></label>
              <label><span>Druckzeit (min)</span><input inputMode="numeric" value={jobForm.estimatedMinutes} onChange={(event) => setJobForm((current) => ({ ...current, estimatedMinutes: event.target.value }))} /></label>
              <label><span>Fortschritt (%)</span><input inputMode="numeric" value={jobForm.progressPercent} onChange={(event) => setJobForm((current) => ({ ...current, progressPercent: event.target.value }))} /></label>
              {access18_2 && selectedFilament && <div className={`${styles.fullField} ${materialWarning ? styles.materialWarningBox : styles.materialInfoBox}`}><strong>{materialWarning ? "⚠ Material nicht ausreichend" : "✓ Material wird reserviert"}</strong><span>Physisch: {Math.round(totalSelectedGrams)} g · bereits reserviert: {Math.round(Math.max(0, reservedForSelected - ownExistingReservation))} g · für diesen Job verfügbar: {Math.round(availableForSelected)} g</span></div>}
              <label className={styles.fullField}><span>Notizen</span><textarea value={jobForm.notes} onChange={(event) => setJobForm((current) => ({ ...current, notes: event.target.value }))} rows={4} /></label>
            </div>
            <div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={closeJobModal}>Abbrechen</button><button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Speichere …" : "Speichern"}</button></div>
          </form>
        </div>
      )}

      {printerModalOpen && (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setPrinterModalOpen(false); }}>
          <form className={styles.modal} onSubmit={savePrinter}>
            <div className={styles.modalHeader}><div><span>DRUCKER-FLOTTE</span><h2>{editingPrinterId ? "Drucker bearbeiten" : "Drucker hinzufügen"}</h2></div><button type="button" onClick={() => setPrinterModalOpen(false)}>×</button></div>
            <div className={styles.formGrid}>
              <label><span>Name</span><input value={printerForm.name} onChange={(event) => setPrinterForm((current) => ({ ...current, name: event.target.value }))} required /></label>
              <label><span>Modell</span><input value={printerForm.model} onChange={(event) => setPrinterForm((current) => ({ ...current, model: event.target.value }))} /></label>
              {access18_1 && <><label><span>Seriennummer</span><input value={printerForm.serialNumber} onChange={(event) => setPrinterForm((current) => ({ ...current, serialNumber: event.target.value }))} /></label><label><span>Düse (mm)</span><input inputMode="decimal" value={printerForm.nozzleMm} onChange={(event) => setPrinterForm((current) => ({ ...current, nozzleMm: event.target.value }))} /></label></>}
              <label><span>Standort</span><input value={printerForm.location} onChange={(event) => setPrinterForm((current) => ({ ...current, location: event.target.value }))} /></label>
              {access18_1 && <label><span>Wartung alle (h)</span><input inputMode="decimal" value={printerForm.maintenanceIntervalHours} onChange={(event) => setPrinterForm((current) => ({ ...current, maintenanceIntervalHours: event.target.value }))} /></label>}
              <label className={styles.fullField}><span>Notizen</span><textarea rows={4} value={printerForm.notes} onChange={(event) => setPrinterForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            </div>
            <div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={() => setPrinterModalOpen(false)}>Abbrechen</button><button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Speichere …" : "Speichern"}</button></div>
          </form>
        </div>
      )}

      {selectedQualityJob && qualityJobId && access18_3 && (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setQualityJobId(null); }}>
          <form className={styles.modal} onSubmit={saveQualityCheck}>
            <div className={styles.modalHeader}><div><span>QUALITÄTSPRÜFUNG</span><h2>{selectedQualityJob.title}</h2></div><button type="button" onClick={() => setQualityJobId(null)}>×</button></div>
            <div className={styles.checkGrid}>
              {([
                ["visualOk", "Oberfläche / Optik"],
                ["dimensionsOk", "Maße / Passform"],
                ["adhesionOk", "Schichthaftung"],
                ["colorOk", "Farbe / Material"],
                ["damageFree", "Keine Beschädigung"],
              ] as Array<[keyof Pick<QualityForm, "visualOk" | "dimensionsOk" | "adhesionOk" | "colorOk" | "damageFree">, string]>).map(([key, label]) => (
                <label className={qualityForm[key] ? styles.checkOk : styles.checkFail} key={key}><input type="checkbox" checked={qualityForm[key]} onChange={(event) => setQualityForm((current) => ({ ...current, [key]: event.target.checked }))} /><span>{qualityForm[key] ? "✓" : "✕"}</span><strong>{label}</strong></label>
              ))}
            </div>
            {!(qualityForm.visualOk && qualityForm.dimensionsOk && qualityForm.adhesionOk && qualityForm.colorOk && qualityForm.damageFree) && <label className={styles.fullField}><span>Fehlergrund</span><select value={qualityForm.failureReason} onChange={(event) => setQualityForm((current) => ({ ...current, failureReason: event.target.value }))}><option value="">Bitte auswählen</option><option value="Warping">Warping</option><option value="Haftungsproblem">Haftungsproblem</option><option value="Maßabweichung">Maßabweichung</option><option value="Oberflächenfehler">Oberflächenfehler</option><option value="Filamentfehler">Filamentfehler</option><option value="Druckerfehler">Druckerfehler</option><option value="Beschädigt">Beschädigt</option><option value="Sonstiges">Sonstiges</option></select></label>}
            <label className={styles.fullField}><span>QS-Notiz</span><textarea rows={3} value={qualityForm.notes} onChange={(event) => setQualityForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            {!(qualityForm.visualOk && qualityForm.dimensionsOk && qualityForm.adhesionOk && qualityForm.colorOk && qualityForm.damageFree) && <label className={styles.reprintOption}><input type="checkbox" checked={qualityForm.createReprint} onChange={(event) => setQualityForm((current) => ({ ...current, createReprint: event.target.checked }))} /><span><strong>Direkt Nachdruck erzeugen</strong><small>Material, Datei, Auftrag und Druckzeit werden übernommen.</small></span></label>}
            <div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={() => setQualityJobId(null)}>Abbrechen</button><button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Speichere …" : "Prüfung abschließen"}</button></div>
          </form>
        </div>
      )}

      {selectedLabelJob && labelJobId && access18_4 && (
        <div className={styles.labelOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLabelJobId(null); }}>
          <section className={styles.labelModal}>
            <div className={styles.modalHeader}><div><span>PRODUKTIONSETIKETT</span><h2>{selectedLabelJob.title}</h2></div><button type="button" onClick={() => setLabelJobId(null)}>×</button></div>
            <div className={styles.labelControls}><label><span>Teil</span><input type="number" min="1" max={Math.max(1, selectedLabelJob.quantity)} value={labelPartNumber} onChange={(event) => setLabelPartNumber(clamp(Number(event.target.value) || 1, 1, Math.max(1, selectedLabelJob.quantity)))} /></label><span>{selectedLabelJob.label_print_count || 0}× gedruckt · zuletzt {formatDateTime(selectedLabelJob.label_last_printed_at)}</span></div>
            <div className={styles.printLabel}>
              <div className={styles.labelBrand}><strong>PHILAMENTIX</strong><span>PRODUCTION</span></div>
              <div className={styles.labelContent}>
                <div className={styles.labelText}><span className={styles.printLabelCode}>{selectedLabelJob.label_code}</span><h3>{selectedLabelJob.title}</h3>{selectedLabelJob.order_id && <p>{orderCode(selectedLabelJob.order_id)} · {orderMap.get(selectedLabelJob.order_id)?.customer_name || orderMap.get(selectedLabelJob.order_id)?.title}</p>}<p>Teil {labelPartNumber}/{Math.max(1, selectedLabelJob.quantity)} · {Math.round(selectedLabelJob.material_grams)} g · {selectedLabelJob.printer_id ? printerMap.get(selectedLabelJob.printer_id)?.name : "Drucker offen"}</p><small>{selectedLabelJob.print_file_id ? fileMap.get(selectedLabelJob.print_file_id)?.file_name : "Keine Druckdatei verknüpft"}</small></div>
                <div className={styles.labelMedia}>
                  <div className={styles.qrBox}>{labelUrl && <QRCodeSVG value={labelUrl} size={132} level="M" marginSize={1} />}</div>
                  <div className={styles.barcodeBox}><Code39Barcode value={selectedLabelJob.label_code} className={styles.barcodeSvg} /></div>
                </div>
              </div>
              <div className={styles.labelFooter}><span>QR ODER BARCODE → JOB ÖFFNEN</span><span>{new Date().toLocaleDateString("de-DE")}</span></div>
            </div>
            <div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={() => setLabelJobId(null)}>Schließen</button><button className={styles.primaryButton} type="button" onClick={() => void printLabel()}>🖨 Etikett drucken</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
