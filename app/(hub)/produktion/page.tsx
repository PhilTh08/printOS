"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import type { Filament } from "@/components/philamentix/types";
import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

const REQUIRED_RELEASE = "18.0";

const JOB_STATUSES = [
  "queue",
  "preparation",
  "printing",
  "completed",
  "failed",
  "cancelled",
] as const;

type JobStatus = (typeof JOB_STATUSES)[number];
type JobPriority = "low" | "normal" | "high" | "urgent";

type ProductionJobRow = {
  id: string;
  user_id: string;
  title: string;
  order_id: string | null;
  print_project_id: string | null;
  print_file_id: string | null;
  filament_id: number | null;
  printer_id: string | null;
  status: JobStatus;
  priority: JobPriority;
  quantity: number;
  material_grams: number;
  estimated_minutes: number;
  progress_percent: number;
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
  location: string;
  notes: string;
  active: boolean;
  created_at: string;
  updated_at: string;
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
  location: string;
  notes: string;
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
  location: "",
  notes: "",
};

const BOARD_COLUMNS: Array<{
  status: JobStatus;
  label: string;
  shortLabel: string;
}> = [
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
  completed: "Fertig",
  failed: "Fehler",
  cancelled: "Abgebrochen",
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

function errorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "";
  }

  return "code" in error && typeof error.code === "string"
    ? error.code
    : "";
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
  return ["42P01", "PGRST204", "PGRST205"].includes(errorCode(error));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: string, fallback = 0): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMinutes(value: number): string {
  if (value <= 0) {
    return "—";
  }

  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function orderCode(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function filamentName(filament: Filament | undefined): string {
  if (!filament) {
    return "Kein Filament";
  }

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

export default function ProductionPage() {
  const {
    user,
    filaments,
    releaseInfo,
    releaseReady,
    hasReleaseAccess,
  } = useHub();

  const [jobs, setJobs] = useState<ProductionJobRow[]>([]);
  const [printers, setPrinters] = useState<ProductionPrinterRow[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [projects, setProjects] = useState<PrintProjectOption[]>([]);
  const [files, setFiles] = useState<PrintFileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupMissing, setSetupMissing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<JobForm>(EMPTY_JOB_FORM);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [printerForm, setPrinterForm] = useState<PrinterForm>(EMPTY_PRINTER_FORM);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | JobPriority>("all");

  const betaFeatureAvailable = releaseReady && hasReleaseAccess(REQUIRED_RELEASE);

  const loadProduction = useCallback(async () => {
    if (!user || !betaFeatureAvailable) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const [jobsResult, printersResult, ordersResult, projectsResult, filesResult] =
      await Promise.all([
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
          .select(
            "id,project_id,file_name,file_type,version_number,source_missing,created_at",
          )
          .eq("user_id", user.id)
          .eq("is_preview", false)
          .order("created_at", { ascending: false }),
      ]);

    if (jobsResult.error || printersResult.error) {
      const productionError = jobsResult.error ?? printersResult.error;
      if (isSetupMissing(productionError)) {
        setSetupMissing(true);
        setJobs([]);
        setPrinters([]);
        setLoading(false);
        return;
      }

      setError(errorMessage(productionError) || "Produktionsdaten konnten nicht geladen werden.");
      setLoading(false);
      return;
    }

    setSetupMissing(false);
    setJobs((jobsResult.data ?? []) as ProductionJobRow[]);
    setPrinters((printersResult.data ?? []) as ProductionPrinterRow[]);

    if (!ordersResult.error) {
      setOrders((ordersResult.data ?? []) as OrderOption[]);
    }

    if (!projectsResult.error) {
      setProjects((projectsResult.data ?? []) as PrintProjectOption[]);
    }

    if (!filesResult.error) {
      setFiles(
        ((filesResult.data ?? []) as PrintFileOption[]).filter((file) =>
          PRINTABLE_EXTENSIONS.has(String(file.file_type).toLowerCase()),
        ),
      );
    }

    setLoading(false);
  }, [betaFeatureAvailable, user]);

  useEffect(() => {
    void loadProduction();
  }, [loadProduction]);

  useEffect(() => {
    if (!user || !betaFeatureAvailable || setupMissing) {
      return;
    }

    const channel = supabase
      .channel(`production-live-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "production_jobs",
          filter: `user_id=eq.${user.id}`,
        },
        () => void loadProduction(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "production_printers",
          filter: `user_id=eq.${user.id}`,
        },
        () => void loadProduction(),
      )
      .subscribe();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadProduction();
      }
    }, 15000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [betaFeatureAvailable, loadProduction, setupMissing, user]);

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

  const filteredJobs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const priorityOrder: Record<JobPriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    return jobs.filter((job) => {
      if (priorityFilter !== "all" && job.priority !== priorityFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const order = job.order_id ? orderMap.get(job.order_id) : undefined;
      const file = job.print_file_id ? fileMap.get(job.print_file_id) : undefined;
      const printer = job.printer_id ? printerMap.get(job.printer_id) : undefined;
      const filament = job.filament_id == null ? undefined : filamentMap.get(job.filament_id);

      return [
        job.title,
        job.notes,
        order?.title,
        order?.customer_name,
        file?.file_name,
        printer?.name,
        printer?.model,
        filamentName(filament),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    }).sort((left, right) => {
      const byPriority = priorityOrder[left.priority] - priorityOrder[right.priority];
      if (byPriority !== 0) {
        return byPriority;
      }
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    });
  }, [
    filamentMap,
    fileMap,
    jobs,
    orderMap,
    printerMap,
    priorityFilter,
    search,
  ]);

  const activeJobs = filteredJobs.filter((job) =>
    ["queue", "preparation", "printing", "completed"].includes(job.status),
  );
  const archivedJobs = filteredJobs.filter((job) =>
    ["failed", "cancelled"].includes(job.status),
  );

  const metrics = useMemo(() => {
    const relevant = jobs.filter((job) =>
      ["queue", "preparation", "printing"].includes(job.status),
    );

    return {
      queue: jobs.filter((job) => job.status === "queue").length,
      printing: jobs.filter((job) => job.status === "printing").length,
      material: relevant.reduce((sum, job) => sum + Number(job.material_grams || 0), 0),
      minutes: relevant.reduce((sum, job) => sum + Number(job.estimated_minutes || 0), 0),
    };
  }, [jobs]);

  const selectedFilament = jobForm.filamentId
    ? filamentMap.get(Number(jobForm.filamentId))
    : undefined;
  const plannedGrams = safeNumber(jobForm.materialGrams);
  const availableGrams = selectedFilament
    ? selectedFilament.stock * selectedFilament.weightPerRoll
    : 0;
  const materialWarning = Boolean(
    selectedFilament && plannedGrams > 0 && plannedGrams > availableGrams,
  );

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
    if (saving) {
      return;
    }
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
    if (!user) {
      return;
    }

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

    setSaving(true);
    setError("");
    setMessage("");

    const existingJob = editingJobId
      ? jobs.find((job) => job.id === editingJobId)
      : undefined;
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
        jobForm.status === "printing" || jobForm.status === "completed"
          ? existingJob?.started_at ?? now
          : null,
      completed_at:
        jobForm.status === "completed"
          ? existingJob?.completed_at ?? now
          : null,
    };

    const result = editingJobId
      ? await supabase
          .from("production_jobs")
          .update(payload)
          .eq("id", editingJobId)
          .eq("user_id", user.id)
      : await supabase.from("production_jobs").insert(payload);

    if (result.error) {
      if (isSetupMissing(result.error)) {
        setSetupMissing(true);
      }
      setError(errorMessage(result.error) || "Produktionsjob konnte nicht gespeichert werden.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setJobModalOpen(false);
    setEditingJobId(null);
    setJobForm(EMPTY_JOB_FORM);
    setMessage(editingJobId ? "Produktionsjob aktualisiert." : "Produktionsjob angelegt.");
    await loadProduction();
  }

  async function updateJobStatus(job: ProductionJobRow, status: JobStatus) {
    if (!user || saving) {
      return;
    }

    const now = new Date().toISOString();
    const updates: Partial<ProductionJobRow> = {
      status,
      progress_percent:
        status === "completed" ? 100 : status === "queue" ? 0 : job.progress_percent,
    };

    if (status === "printing" && !job.started_at) {
      updates.started_at = now;
    }
    if (status === "completed") {
      updates.completed_at = now;
    } else if (job.status === "completed") {
      updates.completed_at = null;
    }

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

  async function updateProgress(job: ProductionJobRow, value: number) {
    if (!user) {
      return;
    }

    const progress = clamp(Math.round(value), 0, 100);
    const { error: updateError } = await supabase
      .from("production_jobs")
      .update({ progress_percent: progress })
      .eq("id", job.id)
      .eq("user_id", user.id);

    if (updateError) {
      setError(errorMessage(updateError) || "Fortschritt konnte nicht gespeichert werden.");
      return;
    }

    setJobs((current) =>
      current.map((item) =>
        item.id === job.id ? { ...item, progress_percent: progress } : item,
      ),
    );
  }

  async function deleteJob(job: ProductionJobRow) {
    if (!user) {
      return;
    }

    if (!window.confirm(`Produktionsjob „${job.title}“ wirklich löschen?`)) {
      return;
    }

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

  async function savePrinter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    const name = printerForm.name.trim();
    if (!name) {
      setError("Bitte einen Druckernamen eingeben.");
      return;
    }

    setSaving(true);
    setError("");

    const { error: insertError } = await supabase.from("production_printers").insert({
      user_id: user.id,
      name,
      model: printerForm.model.trim(),
      location: printerForm.location.trim(),
      notes: printerForm.notes.trim(),
      active: true,
    });

    setSaving(false);

    if (insertError) {
      if (isSetupMissing(insertError)) {
        setSetupMissing(true);
      }
      setError(errorMessage(insertError) || "Drucker konnte nicht gespeichert werden.");
      return;
    }

    setPrinterForm(EMPTY_PRINTER_FORM);
    setMessage("Drucker hinzugefügt.");
    await loadProduction();
  }

  async function togglePrinter(printer: ProductionPrinterRow) {
    if (!user) {
      return;
    }

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
    if (!user) {
      return;
    }

    if (!window.confirm(`Drucker „${printer.name}“ wirklich entfernen?`)) {
      return;
    }

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

  if (!releaseReady) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingCard}>Release-Zugriff wird geprüft …</section>
      </main>
    );
  }

  if (!betaFeatureAvailable) {
    return (
      <main className={styles.page}>
        <section className={styles.lockedCard}>
          <span className={styles.lockedKicker}>BETA FEATURE · V18.0</span>
          <h1>Produktionszentrum ist für diesen Release noch nicht freigeschaltet</h1>
          <p>
            Dein aktiver Release ist <strong>{releaseInfo.channel} // {releaseInfo.version}</strong>.
            Für dieses Modul wird mindestens Version 18.0 benötigt.
          </p>
          <div className={styles.lockedHint}>
            Beta-Tester erhalten Zugriff, sobald im Adminbereich BETA // 18.0 aktiviert wurde.
          </div>
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
            {releaseInfo.audience === "beta" && (
              <span className={styles.betaBadge}>BETA 18.0</span>
            )}
          </div>
          <h1>Produktionszentrum</h1>
          <p>Aufträge, Druckdateien, Material und Maschinen in einer Produktionsansicht.</p>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => setPrinterModalOpen(true)}
          >
            Drucker verwalten
          </button>
          <button className={styles.primaryButton} type="button" onClick={openCreateJob}>
            + Produktionsjob
          </button>
        </div>
      </header>

      {releaseInfo.audience === "beta" && (
        <section className={styles.betaBanner}>
          <div>
            <strong>🧪 BETA FEATURE</strong>
            <span>Produktionszentrum · Beta 18.0</span>
          </div>
          <p>
            Dieses Modul wird aktuell nur für freigeschaltete Beta-Accounts angezeigt.
          </p>
        </section>
      )}

      {setupMissing && (
        <section className={styles.setupCard}>
          <strong>Produktionsdatenbank noch nicht eingerichtet</strong>
          <p>
            Bitte einmal <code>supabase/production_v18_0.sql</code> im Supabase SQL Editor
            ausführen. Danach diese Seite neu laden.
          </p>
        </section>
      )}

      {error && <div className={styles.errorBanner}>{error}</div>}
      {message && <div className={styles.successBanner}>{message}</div>}

      <section className={styles.metricsGrid}>
        <article className={styles.metricCard}>
          <span>Warteschlange</span>
          <strong>{metrics.queue}</strong>
          <small>Jobs bereit zur Vorbereitung</small>
        </article>
        <article className={styles.metricCard}>
          <span>Aktive Drucke</span>
          <strong>{metrics.printing}</strong>
          <small>{printers.filter((printer) => printer.active).length} aktive Drucker</small>
        </article>
        <article className={styles.metricCard}>
          <span>Geplantes Material</span>
          <strong>{Math.round(metrics.material)} g</strong>
          <small>Queue + Vorbereitung + Druck</small>
        </article>
        <article className={styles.metricCard}>
          <span>Geplante Druckzeit</span>
          <strong>{formatMinutes(metrics.minutes)}</strong>
          <small>offene Produktionsjobs</small>
        </article>
      </section>

      <section className={styles.toolbar}>
        <label className={styles.searchField}>
          <span>⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Jobs, Kunde, Datei, Drucker …"
          />
        </label>

        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as "all" | JobPriority)}
          aria-label="Priorität filtern"
        >
          <option value="all">Alle Prioritäten</option>
          <option value="urgent">Dringend</option>
          <option value="high">Hoch</option>
          <option value="normal">Normal</option>
          <option value="low">Niedrig</option>
        </select>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => void loadProduction()}
          disabled={loading}
        >
          ↻ Aktualisieren
        </button>
      </section>

      {loading ? (
        <section className={styles.loadingCard}>Produktionsboard wird geladen …</section>
      ) : !setupMissing ? (
        <>
          <section className={styles.board}>
            {BOARD_COLUMNS.map((column) => {
              const columnJobs = activeJobs.filter((job) => job.status === column.status);

              return (
                <div className={styles.column} key={column.status}>
                  <div className={styles.columnHeader}>
                    <div>
                      <span>{column.shortLabel}</span>
                      <strong>{column.label}</strong>
                    </div>
                    <b>{columnJobs.length}</b>
                  </div>

                  <div className={styles.columnBody}>
                    {columnJobs.length === 0 ? (
                      <div className={styles.emptyColumn}>Keine Jobs</div>
                    ) : (
                      columnJobs.map((job) => {
                        const order = job.order_id ? orderMap.get(job.order_id) : undefined;
                        const file = job.print_file_id ? fileMap.get(job.print_file_id) : undefined;
                        const filament =
                          job.filament_id == null ? undefined : filamentMap.get(job.filament_id);
                        const printer = job.printer_id ? printerMap.get(job.printer_id) : undefined;
                        const stockGrams = filament
                          ? filament.stock * filament.weightPerRoll
                          : 0;
                        const lowMaterial = Boolean(
                          filament && job.material_grams > 0 && job.material_grams > stockGrams,
                        );

                        return (
                          <article
                            className={`${styles.jobCard} ${styles[`priority_${job.priority}`]}`}
                            key={job.id}
                          >
                            <div className={styles.jobTopline}>
                              <span className={styles.priorityBadge}>
                                {PRIORITY_LABELS[job.priority]}
                              </span>
                              <button type="button" onClick={() => openEditJob(job)}>
                                Bearbeiten
                              </button>
                            </div>

                            <h3>{job.title}</h3>

                            {order && (
                              <div className={styles.orderLine}>
                                <span>{orderCode(order.id)}</span>
                                <div>
                                  <strong>{order.title}</strong>
                                  <small>{order.customer_name || "Kein Kunde"}</small>
                                </div>
                              </div>
                            )}

                            <div className={styles.jobFacts}>
                              <div>
                                <span>Datei</span>
                                <strong>{file?.file_name ?? "Nicht verknüpft"}</strong>
                                {file && (
                                  <small>
                                    {projectMap.get(file.project_id) ?? "Druckbibliothek"} · V
                                    {file.version_number}
                                  </small>
                                )}
                              </div>
                              <div>
                                <span>Drucker</span>
                                <strong>{printer?.name ?? "Nicht zugewiesen"}</strong>
                                <small>{printer?.model || "—"}</small>
                              </div>
                              <div className={lowMaterial ? styles.materialWarning : ""}>
                                <span>Material</span>
                                <strong>{filamentName(filament)}</strong>
                                <small>
                                  {job.material_grams > 0 ? `${job.material_grams} g geplant` : "—"}
                                  {lowMaterial ? " · zu wenig Bestand" : ""}
                                </small>
                              </div>
                            </div>

                            <div className={styles.jobMeta}>
                              <span>{job.quantity}×</span>
                              <span>{formatMinutes(job.estimated_minutes)}</span>
                              <span>{formatDateTime(job.created_at)}</span>
                            </div>

                            {job.status === "printing" && (
                              <div className={styles.progressBlock}>
                                <div>
                                  <span>Fortschritt</span>
                                  <strong>{job.progress_percent}%</strong>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={job.progress_percent}
                                  onChange={(event) =>
                                    setJobs((current) =>
                                      current.map((item) =>
                                        item.id === job.id
                                          ? {
                                              ...item,
                                              progress_percent: Number(event.target.value),
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  onMouseUp={(event) =>
                                    void updateProgress(job, Number(event.currentTarget.value))
                                  }
                                  onTouchEnd={(event) =>
                                    void updateProgress(job, Number(event.currentTarget.value))
                                  }
                                />
                                <div className={styles.progressTrack}>
                                  <i style={{ width: `${job.progress_percent}%` }} />
                                </div>
                              </div>
                            )}

                            <div className={styles.jobActions}>
                              {job.status === "queue" && (
                                <button
                                  type="button"
                                  onClick={() => void updateJobStatus(job, "preparation")}
                                >
                                  Vorbereiten
                                </button>
                              )}
                              {job.status === "preparation" && (
                                <>
                                  <button
                                    type="button"
                                    className={styles.startButton}
                                    onClick={() => void updateJobStatus(job, "printing")}
                                  >
                                    Druck starten
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void updateJobStatus(job, "queue")}
                                  >
                                    Zurück
                                  </button>
                                </>
                              )}
                              {job.status === "printing" && (
                                <>
                                  <button
                                    type="button"
                                    className={styles.completeButton}
                                    onClick={() => void updateJobStatus(job, "completed")}
                                  >
                                    Fertig
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.failButton}
                                    onClick={() => void updateJobStatus(job, "failed")}
                                  >
                                    Fehler
                                  </button>
                                </>
                              )}
                              {job.status === "completed" && (
                                <button
                                  type="button"
                                  onClick={() => void updateJobStatus(job, "queue")}
                                >
                                  Erneut einplanen
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          <section className={styles.archiveSection}>
            <button
              type="button"
              className={styles.archiveToggle}
              onClick={() => setArchiveOpen((current) => !current)}
            >
              <span>Fehler & abgebrochene Jobs</span>
              <strong>{archivedJobs.length}</strong>
              <i>{archiveOpen ? "−" : "+"}</i>
            </button>

            {archiveOpen && (
              <div className={styles.archiveList}>
                {archivedJobs.length === 0 ? (
                  <p>Keine archivierten Produktionsjobs.</p>
                ) : (
                  archivedJobs.map((job) => (
                    <article key={job.id}>
                      <div>
                        <span>{STATUS_LABELS[job.status]}</span>
                        <strong>{job.title}</strong>
                        <small>{formatDateTime(job.updated_at)}</small>
                      </div>
                      <div>
                        <button type="button" onClick={() => openEditJob(job)}>
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateJobStatus(job, "queue")}
                        >
                          Wieder einplanen
                        </button>
                        <button
                          type="button"
                          className={styles.deleteTextButton}
                          onClick={() => void deleteJob(job)}
                        >
                          Löschen
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}
          </section>
        </>
      ) : null}

      {jobModalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeJobModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={editingJobId ? "Produktionsjob bearbeiten" : "Produktionsjob anlegen"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <span>{editingJobId ? "JOB BEARBEITEN" : "NEUER JOB"}</span>
                <h2>{editingJobId ? "Produktionsjob bearbeiten" : "Produktionsjob planen"}</h2>
              </div>
              <button type="button" onClick={closeJobModal} aria-label="Schließen">
                ×
              </button>
            </div>

            <form className={styles.jobForm} onSubmit={(event) => void saveJob(event)}>
              <label className={styles.fullField}>
                <span>Jobname *</span>
                <input
                  value={jobForm.title}
                  onChange={(event) =>
                    setJobForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="z. B. Halterung Kunde Max"
                  maxLength={200}
                  required
                />
              </label>

              <label>
                <span>Auftrag</span>
                <select
                  value={jobForm.orderId}
                  onChange={(event) => handleOrderSelection(event.target.value)}
                >
                  <option value="">Kein Auftrag</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {orderCode(order.id)} · {order.title}
                      {order.customer_name ? ` · ${order.customer_name}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Druckdatei</span>
                <select
                  value={jobForm.printFileId}
                  onChange={(event) => handleFileSelection(event.target.value)}
                >
                  <option value="">Keine Datei</option>
                  {files.map((file) => (
                    <option key={file.id} value={file.id} disabled={file.source_missing}>
                      {projectMap.get(file.project_id) ?? "Projekt"} · {file.file_name} · V
                      {file.version_number}
                      {file.source_missing ? " · Quelle fehlt" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Filament</span>
                <select
                  value={jobForm.filamentId}
                  onChange={(event) =>
                    setJobForm((current) => ({ ...current, filamentId: event.target.value }))
                  }
                >
                  <option value="">Kein Filament</option>
                  {filaments.map((filament) => (
                    <option key={filament.id} value={filament.id}>
                      {filamentName(filament)} · ca. {filament.stock * filament.weightPerRoll} g
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Drucker</span>
                <select
                  value={jobForm.printerId}
                  onChange={(event) =>
                    setJobForm((current) => ({ ...current, printerId: event.target.value }))
                  }
                >
                  <option value="">Nicht zugewiesen</option>
                  {printers
                    .filter((printer) => printer.active || printer.id === jobForm.printerId)
                    .map((printer) => (
                      <option key={printer.id} value={printer.id}>
                        {printer.name}{printer.model ? ` · ${printer.model}` : ""}
                        {!printer.active ? " · deaktiviert" : ""}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>Priorität</span>
                <select
                  value={jobForm.priority}
                  onChange={(event) =>
                    setJobForm((current) => ({
                      ...current,
                      priority: event.target.value as JobPriority,
                    }))
                  }
                >
                  <option value="low">Niedrig</option>
                  <option value="normal">Normal</option>
                  <option value="high">Hoch</option>
                  <option value="urgent">Dringend</option>
                </select>
              </label>

              <label>
                <span>Status</span>
                <select
                  value={jobForm.status}
                  onChange={(event) =>
                    setJobForm((current) => ({
                      ...current,
                      status: event.target.value as JobStatus,
                    }))
                  }
                >
                  {JOB_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Anzahl</span>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  step="1"
                  value={jobForm.quantity}
                  onChange={(event) =>
                    setJobForm((current) => ({ ...current, quantity: event.target.value }))
                  }
                />
              </label>

              <label>
                <span>Material gesamt · g</span>
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.1"
                  value={jobForm.materialGrams}
                  onChange={(event) =>
                    setJobForm((current) => ({ ...current, materialGrams: event.target.value }))
                  }
                />
              </label>

              <label>
                <span>Druckzeit · Minuten</span>
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  value={jobForm.estimatedMinutes}
                  onChange={(event) =>
                    setJobForm((current) => ({
                      ...current,
                      estimatedMinutes: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Fortschritt · %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={jobForm.progressPercent}
                  onChange={(event) =>
                    setJobForm((current) => ({
                      ...current,
                      progressPercent: event.target.value,
                    }))
                  }
                />
              </label>

              {selectedFilament && (
                <div
                  className={`${styles.materialCheck} ${
                    materialWarning ? styles.materialCheckWarning : styles.materialCheckOk
                  }`}
                >
                  <span>{materialWarning ? "⚠" : "✓"}</span>
                  <div>
                    <strong>{materialWarning ? "Material reicht voraussichtlich nicht" : "Materialcheck OK"}</strong>
                    <small>
                      Geplant: {plannedGrams || 0} g · rechnerisch verfügbar: {availableGrams} g
                    </small>
                  </div>
                </div>
              )}

              <label className={styles.fullField}>
                <span>Notizen</span>
                <textarea
                  value={jobForm.notes}
                  onChange={(event) =>
                    setJobForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={4}
                  maxLength={4000}
                  placeholder="Druckeinstellungen, Kundenwunsch, Hinweise …"
                />
              </label>

              <div className={styles.modalActions}>
                {editingJobId && (
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => {
                      const job = jobs.find((item) => item.id === editingJobId);
                      if (job) {
                        closeJobModal();
                        void deleteJob(job);
                      }
                    }}
                  >
                    Job löschen
                  </button>
                )}
                <span />
                <button type="button" className={styles.secondaryButton} onClick={closeJobModal}>
                  Abbrechen
                </button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  {saving ? "Speichert …" : editingJobId ? "Änderungen speichern" : "Job anlegen"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {printerModalOpen && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={() => !saving && setPrinterModalOpen(false)}
        >
          <section
            className={`${styles.modal} ${styles.printerModal}`}
            role="dialog"
            aria-modal="true"
            aria-label="Drucker verwalten"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <span>MASCHINEN</span>
                <h2>Drucker verwalten</h2>
              </div>
              <button type="button" onClick={() => setPrinterModalOpen(false)} aria-label="Schließen">
                ×
              </button>
            </div>

            <form className={styles.printerForm} onSubmit={(event) => void savePrinter(event)}>
              <label>
                <span>Name *</span>
                <input
                  value={printerForm.name}
                  onChange={(event) =>
                    setPrinterForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="z. B. A1 #1"
                  required
                />
              </label>
              <label>
                <span>Modell</span>
                <input
                  value={printerForm.model}
                  onChange={(event) =>
                    setPrinterForm((current) => ({ ...current, model: event.target.value }))
                  }
                  placeholder="z. B. Bambu Lab A1"
                />
              </label>
              <label>
                <span>Standort</span>
                <input
                  value={printerForm.location}
                  onChange={(event) =>
                    setPrinterForm((current) => ({ ...current, location: event.target.value }))
                  }
                  placeholder="Werkstatt / Regal 1"
                />
              </label>
              <label>
                <span>Notiz</span>
                <input
                  value={printerForm.notes}
                  onChange={(event) =>
                    setPrinterForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="0.4 mm Düse, AMS Lite …"
                />
              </label>
              <button type="submit" className={styles.primaryButton} disabled={saving}>
                + Drucker hinzufügen
              </button>
            </form>

            <div className={styles.printerList}>
              {printers.length === 0 ? (
                <p>Noch kein Drucker hinterlegt.</p>
              ) : (
                printers.map((printer) => (
                  <article key={printer.id}>
                    <div className={styles.printerState} data-active={printer.active}>
                      <i />
                    </div>
                    <div>
                      <strong>{printer.name}</strong>
                      <span>{printer.model || "Modell nicht angegeben"}</span>
                      <small>
                        {printer.location || "Kein Standort"}
                        {printer.notes ? ` · ${printer.notes}` : ""}
                      </small>
                    </div>
                    <button type="button" onClick={() => void togglePrinter(printer)}>
                      {printer.active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                    <button
                      type="button"
                      className={styles.deleteTextButton}
                      onClick={() => void deletePrinter(printer)}
                    >
                      Entfernen
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
