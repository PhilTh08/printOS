"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import ModelViewer from "@/components/philamentix/model-viewer";
import {
  MAX_AUTOMATIC_MODEL_ANALYSIS_SIZE,
  analyzeModelFile,
  isViewableModelExtension,
  type ModelMetadata,
} from "@/components/philamentix/model-analyzer";
import {
  ALL_PRINT_EXTENSIONS,
  DEFAULT_SCAN_EXTENSIONS,
  MAX_PRINT_FILE_SIZE,
  MAX_SCAN_IMPORT_FILES,
  MAX_SCAN_IMPORT_SIZE,
  PREVIEW_IMAGE_EXTENSIONS,
  PRINT_FORMAT_GROUPS,
  PRINT_LIBRARY_ACCEPT,
  type DirectoryScanResult,
  type DirectorySelectableFile,
  type ScannedPrintFile,
  extensionOf,
  fileKindForExtension,
  formatLabelForExtension,
  safeFileName,
  scanDirectoryFiles,
} from "@/components/philamentix/print-library-scanner";
import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

const STORAGE_BUCKET = "print-library";
const SCAN_FORMAT_STORAGE_KEY =
  "philamentix.print-library.scan-formats.v1";
const SCAN_RESULTS_PER_PAGE = 200;

type PrintProjectRow = {
  id: string;
  user_id: string;
  name: string;
  folder: string;
  description: string;
  tags: string[];
  favorite: boolean;
  cover_path: string | null;
  scan_root_name?: string;
  last_scanned_at?: string | null;
  created_at: string;
  updated_at: string;
};

type PrintProjectFileRow = {
  id: string;
  user_id: string;
  project_id: string;
  storage_path: string;
  file_name: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  is_preview: boolean;
  relative_path: string;
  source_modified_at: string | null;
  source_kind: "upload" | "folder_scan";
  source_missing?: boolean;
  source_last_seen_at?: string | null;
  generated_preview_path: string | null;
  model_width_mm: number | null;
  model_depth_mm: number | null;
  model_height_mm: number | null;
  model_volume_mm3: number | null;
  triangle_count: number | null;
  metadata_extracted_at: string | null;
  version_group_id: string | null;
  version_number: number;
  version_note: string;
  created_at: string;
};

type PrintProject = PrintProjectRow & {
  fileCount: number;
  totalSize: number;
  coverUrl: string | null;
};

type ProjectForm = {
  name: string;
  folder: string;
  description: string;
  tags: string;
  favorite: boolean;
};

type RescanCandidate = {
  scanned: ScannedPrintFile;
  existing?: PrintProjectFileRow;
  nextVersion?: number;
};

type RescanMove = {
  scanned: ScannedPrintFile;
  existing: PrintProjectFileRow;
};

type RescanComparison = {
  projectId: string;
  rootName: string;
  rootMismatch: boolean;
  scannedAt: string;
  newFiles: RescanCandidate[];
  changedFiles: RescanCandidate[];
  movedFiles: RescanMove[];
  unchangedFiles: PrintProjectFileRow[];
  missingFiles: PrintProjectFileRow[];
  ignoredEntries: number;
  invalidEntries: number;
  disabledNewEntries: number;
};

const EMPTY_FORM: ProjectForm = {
  name: "",
  folder: "",
  description: "",
  tags: "",
  favorite: false,
};

function errorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "";
  }

  return "code" in error && typeof error.code === "string"
    ? error.code
    : "";
}

function isSetupMissing(error: unknown): boolean {
  return ["42P01", "PGRST205"].includes(
    errorCode(error),
  );
}

function errorMessage(error: unknown): string {
  if (
    typeof error !== "object" ||
    error === null ||
    !("message" in error)
  ) {
    return "";
  }

  const message = error.message;
  return typeof message === "string" ? message : "";
}

function isScannerMigrationMissing(
  error: unknown,
): boolean {
  if (errorCode(error) === "PGRST204") {
    return true;
  }

  const message = errorMessage(error);

  return [
    "relative_path",
    "source_modified_at",
    "source_kind",
  ].some((column) => message.includes(column));
}

function isViewerMigrationMissing(error: unknown): boolean {
  if (errorCode(error) === "PGRST204") {
    return true;
  }

  const message = errorMessage(error);
  return [
    "generated_preview_path",
    "model_width_mm",
    "triangle_count",
    "version_number",
  ].some((column) => message.includes(column));
}

function isRescanMigrationMissing(error: unknown): boolean {
  if (errorCode(error) === "PGRST204") {
    return true;
  }

  const message = errorMessage(error);
  return [
    "scan_root_name",
    "last_scanned_at",
    "source_missing",
    "source_last_seen_at",
  ].some((column) => message.includes(column));
}

function sourceModifiedMs(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Noch nie";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function metadataFromFile(file: PrintProjectFileRow): ModelMetadata | null {
  const values = [
    file.model_width_mm,
    file.model_depth_mm,
    file.model_height_mm,
    file.model_volume_mm3,
    file.triangle_count,
  ];

  if (values.some((value) => typeof value !== "number")) {
    return null;
  }

  return {
    widthMm: Number(file.model_width_mm),
    depthMm: Number(file.model_depth_mm),
    heightMm: Number(file.model_height_mm),
    volumeMm3: Number(file.model_volume_mm3),
    triangleCount: Number(file.triangle_count),
  };
}

function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }

  return `${value.toLocaleString("de-DE", {
    maximumFractionDigits: value >= 10 ? 1 : 2,
  })} ${unit}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
}

function fileKind(file: PrintProjectFileRow): string {
  return fileKindForExtension(file.file_type);
}

export default function PrintLibraryPage() {
  const { user } = useHub();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const versionInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const rescanInputRef = useRef<HTMLInputElement | null>(null);
  const [projects, setProjects] = useState<PrintProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<PrintProject | null>(
    null,
  );
  const [projectFiles, setProjectFiles] = useState<PrintProjectFileRow[]>([]);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [setupMissing, setSetupMissing] = useState(false);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [viewerMigrationMissing, setViewerMigrationMissing] = useState(false);
  const [viewerFile, setViewerFile] = useState<PrintProjectFileRow | null>(null);
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerSaving, setViewerSaving] = useState(false);
  const [versionTarget, setVersionTarget] = useState<PrintProjectFileRow | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState<DirectoryScanResult | null>(null);
  const [scanSearch, setScanSearch] = useState("");
  const [scanFormatFilter, setScanFormatFilter] = useState("all");
  const [scanPage, setScanPage] = useState(1);
  const [scanSelectedIds, setScanSelectedIds] = useState<Set<string>>(
    new Set(),
  );
  const [enabledScanExtensions, setEnabledScanExtensions] = useState<Set<string>>(
    new Set(DEFAULT_SCAN_EXTENSIONS),
  );
  const [scanTargetMode, setScanTargetMode] = useState<"new" | "existing">(
    "new",
  );
  const [scanProjectName, setScanProjectName] = useState("");
  const [scanTargetProjectId, setScanTargetProjectId] = useState("");
  const [scanImporting, setScanImporting] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [rescanProject, setRescanProject] = useState<PrintProject | null>(null);
  const [rescanComparison, setRescanComparison] = useState<RescanComparison | null>(null);
  const [rescanChecking, setRescanChecking] = useState(false);
  const [rescanApplying, setRescanApplying] = useState(false);
  const [rescanMigrationMissing, setRescanMigrationMissing] = useState(false);
  const [rescanProgress, setRescanProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const clearFeedback = useCallback(() => {
    setMessage("");
    setError("");
  }, []);

  useEffect(() => {
    const folderInput = folderInputRef.current;

    if (folderInput) {
      folderInput.setAttribute("webkitdirectory", "");
      folderInput.setAttribute("directory", "");
    }

    const rescanInput = rescanInputRef.current;
    if (rescanInput) {
      rescanInput.setAttribute("webkitdirectory", "");
      rescanInput.setAttribute("directory", "");
    }

    try {
      const stored = window.localStorage.getItem(
        SCAN_FORMAT_STORAGE_KEY,
      );

      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return;
      }

      const valid = parsed.filter(
        (extension): extension is string =>
          typeof extension === "string" &&
          ALL_PRINT_EXTENSIONS.has(extension),
      );

      if (valid.length > 0) {
        setEnabledScanExtensions(
          new Set(valid),
        );
      }
    } catch {
      window.localStorage.removeItem(
        SCAN_FORMAT_STORAGE_KEY,
      );
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SCAN_FORMAT_STORAGE_KEY,
        JSON.stringify(
          [...enabledScanExtensions].sort(),
        ),
      );
    } catch {
      // Die Formatauswahl funktioniert auch ohne lokalen Speicher.
    }
  }, [enabledScanExtensions]);

  const loadProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const projectResult = await supabase
      .from("print_projects")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (projectResult.error) {
      if (isSetupMissing(projectResult.error)) {
        setSetupMissing(true);
        setProjects([]);
        setLoading(false);
        return;
      }

      setError(projectResult.error.message);
      setLoading(false);
      return;
    }

    let fileRows: Array<{
      project_id: string;
      size_bytes: number;
    }> = [];

    const fileResult = await supabase
      .from("print_project_files")
      .select(
        "project_id,size_bytes,relative_path,source_kind,model_width_mm,generated_preview_path,version_number",
      )
      .eq("user_id", user.id);

    if (fileResult.error) {
      if (isViewerMigrationMissing(fileResult.error)) {
        setViewerMigrationMissing(true);
        const v171Fallback = await supabase
          .from("print_project_files")
          .select("project_id,size_bytes,relative_path,source_kind")
          .eq("user_id", user.id);

        if (v171Fallback.error) {
          if (isScannerMigrationMissing(v171Fallback.error)) {
            setMigrationMissing(true);
            const legacyFallback = await supabase
              .from("print_project_files")
              .select("project_id,size_bytes")
              .eq("user_id", user.id);

            if (legacyFallback.error) {
              setError(legacyFallback.error.message);
              setLoading(false);
              return;
            }

            fileRows = legacyFallback.data ?? [];
          } else {
            setError(v171Fallback.error.message);
            setLoading(false);
            return;
          }
        } else {
          setMigrationMissing(false);
          fileRows = v171Fallback.data ?? [];
        }
      } else if (
        isScannerMigrationMissing(
          fileResult.error,
        )
      ) {
        setMigrationMissing(true);
        const fallbackResult = await supabase
          .from("print_project_files")
          .select("project_id,size_bytes")
          .eq("user_id", user.id);

        if (fallbackResult.error) {
          setError(
            fallbackResult.error.message,
          );
          setLoading(false);
          return;
        }

        fileRows = fallbackResult.data ?? [];
      } else if (
        isSetupMissing(fileResult.error)
      ) {
        setSetupMissing(true);
        setProjects([]);
        setLoading(false);
        return;
      } else {
        setError(fileResult.error.message);
        setLoading(false);
        return;
      }
    } else {
      setMigrationMissing(false);
      setViewerMigrationMissing(false);
      fileRows = fileResult.data ?? [];
    }

    const countByProject = new Map<
      string,
      { count: number; size: number }
    >();

    for (const file of fileRows) {
      const current =
        countByProject.get(
          file.project_id,
        ) ?? {
          count: 0,
          size: 0,
        };
      current.count += 1;
      current.size +=
        Number(file.size_bytes) || 0;
      countByProject.set(
        file.project_id,
        current,
      );
    }

    const rows =
      (projectResult.data ?? []) as PrintProjectRow[];
    const coverPaths = rows
      .map((row) => row.cover_path)
      .filter(
        (value): value is string =>
          Boolean(value),
      );
    const signedByPath =
      new Map<string, string>();

    if (coverPaths.length > 0) {
      const signedResult =
        await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrls(
            coverPaths,
            60 * 60,
          );

      for (
        const signed of
        signedResult.data ?? []
      ) {
        if (
          signed.path &&
          signed.signedUrl
        ) {
          signedByPath.set(
            signed.path,
            signed.signedUrl,
          );
        }
      }
    }

    const mapped = rows.map((row) => {
      const count =
        countByProject.get(row.id);
      return {
        ...row,
        fileCount: count?.count ?? 0,
        totalSize: count?.size ?? 0,
        coverUrl: row.cover_path
          ? signedByPath.get(
              row.cover_path,
            ) ?? null
          : null,
      };
    });

    setSetupMissing(false);
    setProjects(mapped);
    setSelectedProject((current) =>
      current
        ? mapped.find(
            (project) =>
              project.id === current.id,
          ) ?? null
        : null,
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const loadProjectFiles = useCallback(
    async (project: PrintProject) => {
      if (!user) {
        return;
      }

      clearFeedback();
      setSelectedProject(project);
      setViewerFile(null);
      setViewerUrl("");
      const result = await supabase
        .from("print_project_files")
        .select("*")
        .eq("user_id", user.id)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (result.error) {
        setError(result.error.message);
        setProjectFiles([]);
        return;
      }

      setProjectFiles((result.data ?? []) as PrintProjectFileRow[]);
    },
    [clearFeedback, user],
  );

  const storeModelAnalysis = useCallback(
    async (
      file: PrintProjectFileRow,
      metadata: ModelMetadata,
      preview: Blob | null,
    ): Promise<string | null> => {
      if (!user) {
        return null;
      }

      if (viewerMigrationMissing) {
        throw new Error(
          "Bitte zuerst supabase/print_library_v17_2.sql ausführen.",
        );
      }

      let previewPath = file.generated_preview_path ?? null;
      let createdPreviewPath = false;

      if (preview) {
        previewPath =
          file.generated_preview_path ||
          `${user.id}/${file.project_id}/generated/${file.id}-preview.png`;
        createdPreviewPath = !file.generated_preview_path;
        const previewUpload = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(previewPath, preview, {
            cacheControl: "3600",
            contentType: "image/png",
            upsert: true,
          });

        if (previewUpload.error) {
          throw previewUpload.error;
        }
      }

      const updateResult = await supabase
        .from("print_project_files")
        .update({
          generated_preview_path: previewPath,
          model_width_mm: metadata.widthMm,
          model_depth_mm: metadata.depthMm,
          model_height_mm: metadata.heightMm,
          model_volume_mm3: metadata.volumeMm3,
          triangle_count: metadata.triangleCount,
          metadata_extracted_at: new Date().toISOString(),
        })
        .eq("id", file.id)
        .eq("user_id", user.id);

      if (updateResult.error) {
        if (createdPreviewPath && previewPath) {
          await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([previewPath]);
        }
        throw updateResult.error;
      }

      setProjectFiles((current) =>
        current.map((entry) =>
          entry.id === file.id
            ? {
                ...entry,
                generated_preview_path: previewPath,
                model_width_mm: metadata.widthMm,
                model_depth_mm: metadata.depthMm,
                model_height_mm: metadata.heightMm,
                model_volume_mm3: metadata.volumeMm3,
                triangle_count: metadata.triangleCount,
                metadata_extracted_at: new Date().toISOString(),
              }
            : entry,
        ),
      );

      return previewPath;
    },
    [user, viewerMigrationMissing],
  );

  const saveViewerAnalysis = useCallback(
    async (metadata: ModelMetadata, preview: Blob | null) => {
      if (!user || !selectedProject || !viewerFile) {
        return;
      }

      setViewerSaving(true);
      try {
        const previewPath = await storeModelAnalysis(
          viewerFile,
          metadata,
          preview,
        );

        if (!selectedProject.cover_path && previewPath) {
          const coverResult = await supabase
            .from("print_projects")
            .update({ cover_path: previewPath })
            .eq("id", selectedProject.id)
            .eq("user_id", user.id);

          if (coverResult.error) {
            throw coverResult.error;
          }
        }

        setMessage("3D-Metadaten und Vorschau wurden gespeichert.");
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Die 3D-Metadaten konnten nicht gespeichert werden.",
        );
      } finally {
        setViewerSaving(false);
      }
    },
    [selectedProject, storeModelAnalysis, user, viewerFile],
  );

  async function openModelViewer(file: PrintProjectFileRow) {
    if (!isViewableModelExtension(file.file_type)) {
      return;
    }

    clearFeedback();
    const result = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(file.storage_path, 60 * 60);

    if (result.error || !result.data?.signedUrl) {
      setError(
        result.error?.message ??
          "Die 3D-Vorschau konnte nicht vorbereitet werden.",
      );
      return;
    }

    setViewerFile(file);
    setViewerUrl(result.data.signedUrl);
  }

  async function analyzeLocalModel(
    sourceFile: File,
    fileRow: PrintProjectFileRow,
  ): Promise<string | null> {
    if (
      viewerMigrationMissing ||
      sourceFile.size > MAX_AUTOMATIC_MODEL_ANALYSIS_SIZE ||
      !isViewableModelExtension(fileRow.file_type)
    ) {
      return null;
    }

    const analysis = await analyzeModelFile(
      sourceFile,
      fileRow.file_type,
      true,
    );
    return storeModelAnalysis(
      fileRow,
      analysis.metadata,
      analysis.preview,
    );
  }

  const folders = useMemo(
    () =>
      Array.from(
        new Set(projects.map((project) => project.folder.trim()).filter(Boolean)),
      ).sort((first, second) => first.localeCompare(second, "de")),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("de");

    return projects.filter((project) => {
      if (favoriteOnly && !project.favorite) {
        return false;
      }

      if (folderFilter !== "all" && project.folder !== folderFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        project.name,
        project.folder,
        project.description,
        ...project.tags,
      ]
        .join(" ")
        .toLocaleLowerCase("de")
        .includes(needle);
    });
  }, [favoriteOnly, folderFilter, projects, search]);

  const filteredScannedFiles = useMemo(() => {
    if (!scanResult) {
      return [];
    }

    const needle = scanSearch
      .trim()
      .toLocaleLowerCase("de");

    return scanResult.files.filter((file) => {
      if (
        !enabledScanExtensions.has(
          file.extension,
        )
      ) {
        return false;
      }

      if (
        scanFormatFilter !== "all" &&
        file.extension !== scanFormatFilter
      ) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return file.relativePath
        .toLocaleLowerCase("de")
        .includes(needle);
    });
  }, [
    enabledScanExtensions,
    scanFormatFilter,
    scanResult,
    scanSearch,
  ]);

  const scanTotalPages = Math.max(
    1,
    Math.ceil(
      filteredScannedFiles.length /
        SCAN_RESULTS_PER_PAGE,
    ),
  );

  const visibleScannedFiles = useMemo(() => {
    const safePage = Math.min(
      scanPage,
      scanTotalPages,
    );
    const startIndex =
      (safePage - 1) *
      SCAN_RESULTS_PER_PAGE;

    return filteredScannedFiles.slice(
      startIndex,
      startIndex + SCAN_RESULTS_PER_PAGE,
    );
  }, [
    filteredScannedFiles,
    scanPage,
    scanTotalPages,
  ]);

  useEffect(() => {
    setScanPage(1);
  }, [
    enabledScanExtensions,
    scanFormatFilter,
    scanResult,
    scanSearch,
  ]);

  const selectedScannedFiles = useMemo(
    () =>
      scanResult?.files.filter(
        (file) =>
          scanSelectedIds.has(file.id) &&
          file.status === "ready",
      ) ?? [],
    [scanResult, scanSelectedIds],
  );

  const selectedScannedSize =
    selectedScannedFiles.reduce(
      (sum, file) => sum + file.size,
      0,
    );

  const scanFormatOptions = useMemo(
    () =>
      Array.from(
        new Set(
          scanResult?.files.map(
            (file) => file.extension,
          ) ?? [],
        ),
      ).sort((first, second) =>
        first.localeCompare(second, "de"),
      ),
    [scanResult],
  );

  const totalFiles = projects.reduce(
    (sum, project) => sum + project.fileCount,
    0,
  );
  const totalSize = projects.reduce(
    (sum, project) => sum + project.totalSize,
    0,
  );

  function setField<K extends keyof ProjectForm>(
    key: K,
    value: ProjectForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    clearFeedback();
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function startEdit(project: PrintProject) {
    clearFeedback();
    setEditingId(project.id);
    setForm({
      name: project.name,
      folder: project.folder,
      description: project.description,
      tags: project.tags.join(", "),
      favorite: project.favorite,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(false);
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    if (!user || !form.name.trim()) {
      setError("Bitte einen Projektnamen angeben.");
      return;
    }

    setBusy(true);
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      folder: form.folder.trim(),
      description: form.description.trim(),
      tags: parseTags(form.tags),
      favorite: form.favorite,
    };

    const result = editingId
      ? await supabase
          .from("print_projects")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", user.id)
      : await supabase.from("print_projects").insert(payload);

    setBusy(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage(editingId ? "Projekt wurde aktualisiert." : "Projekt wurde angelegt.");
    closeForm();
    await loadProjects();
  }

  async function toggleFavorite(project: PrintProject) {
    if (!user) {
      return;
    }

    const result = await supabase
      .from("print_projects")
      .update({ favorite: !project.favorite })
      .eq("id", project.id)
      .eq("user_id", user.id);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await loadProjects();
  }

  function openScanner(
    targetProjectId = "",
  ) {
    clearFeedback();
    setScannerOpen(true);
    setScanResult(null);
    setScanSearch("");
    setScanFormatFilter("all");
    setScanPage(1);
    setScanSelectedIds(new Set());
    setScanProjectName("");
    setScanProgress(null);

    if (targetProjectId) {
      setScanTargetMode("existing");
      setScanTargetProjectId(
        targetProjectId,
      );
    } else {
      setScanTargetMode("new");
      setScanTargetProjectId(
        projects[0]?.id ?? "",
      );
    }
  }

  function closeScanner() {
    if (scanImporting) {
      return;
    }

    setScannerOpen(false);
    setScanResult(null);
    setScanSelectedIds(new Set());
    setScanProgress(null);
  }

  function chooseLocalFolder() {
    folderInputRef.current?.click();
  }

  function handleDirectorySelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(
      event.target.files ?? [],
    ) as DirectorySelectableFile[];
    event.target.value = "";
    clearFeedback();

    if (files.length === 0) {
      return;
    }

    try {
      const result =
        scanDirectoryFiles(files);
      const selectedIds = new Set(
        result.files
          .filter(
            (file) =>
              file.status === "ready" &&
              enabledScanExtensions.has(
                file.extension,
              ),
          )
          .map((file) => file.id),
      );

      setScanResult(result);
      setScanProjectName(
        result.rootName ===
          "Lokaler Ordner"
          ? "Importierter Ordner"
          : result.rootName,
      );
      setScanSelectedIds(selectedIds);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Der Ordner konnte nicht durchsucht werden.",
      );
    }
  }

  function toggleScanExtension(
    extension: string,
  ) {
    setEnabledScanExtensions((current) => {
      const next = new Set(current);
      const enable = !next.has(extension);

      if (enable) {
        next.add(extension);
      } else {
        next.delete(extension);
      }

      setScanSelectedIds((selected) => {
        const nextSelected =
          new Set(selected);

        for (
          const file of
          scanResult?.files ?? []
        ) {
          if (
            file.extension !== extension ||
            file.status !== "ready"
          ) {
            continue;
          }

          if (enable) {
            nextSelected.add(file.id);
          } else {
            nextSelected.delete(file.id);
          }
        }

        return nextSelected;
      });

      return next;
    });
  }

  function toggleScannedFile(
    file: ScannedPrintFile,
  ) {
    if (file.status !== "ready") {
      return;
    }

    setScanSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(file.id)) {
        next.delete(file.id);
      } else {
        next.add(file.id);
      }

      return next;
    });
  }

  function selectVisibleScannedFiles() {
    setScanSelectedIds((current) => {
      const next = new Set(current);

      for (const file of visibleScannedFiles) {
        if (file.status === "ready") {
          next.add(file.id);
        }
      }

      return next;
    });
  }

  function clearScannedSelection() {
    setScanSelectedIds(new Set());
  }

  async function importScannedFiles() {
    if (
      !user ||
      !scanResult ||
      selectedScannedFiles.length === 0
    ) {
      setError(
        "Bitte mindestens eine gültige Datei auswählen.",
      );
      return;
    }

    if (migrationMissing) {
      setError(
        "Bitte zuerst supabase/print_library_v17_1.sql ausführen.",
      );
      return;
    }

    if (
      selectedScannedFiles.length >
      MAX_SCAN_IMPORT_FILES
    ) {
      setError(
        `Pro Import sind maximal ${MAX_SCAN_IMPORT_FILES} Dateien erlaubt.`,
      );
      return;
    }

    if (
      selectedScannedSize >
      MAX_SCAN_IMPORT_SIZE
    ) {
      setError(
        "Die ausgewählten Dateien sind zusammen größer als 1 GB.",
      );
      return;
    }

    if (
      scanTargetMode === "new" &&
      !scanProjectName.trim()
    ) {
      setError(
        "Bitte einen Projektnamen für den Import angeben.",
      );
      return;
    }

    if (
      scanTargetMode === "existing" &&
      !scanTargetProjectId
    ) {
      setError(
        "Bitte ein vorhandenes Zielprojekt auswählen.",
      );
      return;
    }

    const uniqueByRelativePath = new Map<
      string,
      ScannedPrintFile
    >();
    let duplicateInputPaths = 0;

    for (const file of selectedScannedFiles) {
      const key = file.relativePath
        .toLocaleLowerCase("de");

      if (uniqueByRelativePath.has(key)) {
        duplicateInputPaths += 1;
        continue;
      }

      uniqueByRelativePath.set(key, file);
    }

    const importCandidates =
      [...uniqueByRelativePath.values()];

    clearFeedback();
    setScanImporting(true);
    setScanProgress({
      current: 0,
      total: importCandidates.length,
      fileName: "Import wird vorbereitet …",
    });

    const uploadedPaths: string[] = [];
    let createdProjectId: string | null =
      null;
    let targetProjectIdForRollback: string | null = null;
    let originalCoverPathForRollback: string | null = null;
    let coverChanged = false;

    try {
      let targetProject:
        | PrintProjectRow
        | PrintProject;

      if (scanTargetMode === "new") {
        const createResult = await supabase
          .from("print_projects")
          .insert({
            user_id: user.id,
            name: scanProjectName.trim(),
            folder: "Ordnerscan",
            description:
              `Lokal aus „${scanResult.rootName}“ importiert.`,
            tags: ["Ordnerscan"],
            favorite: false,
          })
          .select("*")
          .single();

        if (createResult.error) {
          throw createResult.error;
        }

        targetProject =
          createResult.data as PrintProjectRow;
        createdProjectId = targetProject.id;
      } else {
        const found = projects.find(
          (project) =>
            project.id ===
            scanTargetProjectId,
        );

        if (!found) {
          throw new Error(
            "Das ausgewählte Zielprojekt wurde nicht gefunden.",
          );
        }

        targetProject = found;
      }

      targetProjectIdForRollback = targetProject.id;
      originalCoverPathForRollback = targetProject.cover_path;

      const existingResult = viewerMigrationMissing
        ? await supabase
            .from("print_project_files")
            .select(
              "id,storage_path,file_name,size_bytes,relative_path,source_modified_at",
            )
            .eq("user_id", user.id)
            .eq("project_id", targetProject.id)
        : await supabase
            .from("print_project_files")
            .select(
              "id,storage_path,file_name,size_bytes,relative_path,source_modified_at,generated_preview_path",
            )
            .eq("user_id", user.id)
            .eq("project_id", targetProject.id);

      if (existingResult.error) {
        throw existingResult.error;
      }

      const existingByPath = new Map<
        string,
        {
          id: string;
          storage_path: string;
          file_name: string;
          size_bytes: number;
          relative_path: string;
          source_modified_at: string | null;
          generated_preview_path?: string | null;
        }
      >();

      for (
        const existing of
        existingResult.data ?? []
      ) {
        const key =
          existing.relative_path
            ?.trim()
            .toLocaleLowerCase("de");

        if (key) {
          existingByPath.set(
            key,
            existing,
          );
        }
      }

      const replacements: Array<{
        oldId: string;
        oldPaths: string[];
        newCoverPath: string | null;
      }> = [];
      let skippedDuplicates =
        duplicateInputPaths;
      let firstPreviewPath: string | null =
        null;
      let importedCount = 0;
      let analysisWarnings = 0;

      for (
        let index = 0;
        index < importCandidates.length;
        index += 1
      ) {
        const scanned =
          importCandidates[index];
        setScanProgress({
          current: index + 1,
          total:
            importCandidates.length,
          fileName:
            scanned.relativePath,
        });

        const existing =
          existingByPath.get(
            scanned.relativePath
              .toLocaleLowerCase("de"),
          );
        const existingModified =
          existing?.source_modified_at
            ? new Date(
                existing.source_modified_at,
              ).getTime()
            : 0;

        if (
          existing &&
          Number(existing.size_bytes) ===
            scanned.size &&
          existingModified ===
            scanned.lastModified
        ) {
          skippedDuplicates += 1;
          continue;
        }

        const storagePath =
          `${user.id}/${targetProject.id}/${crypto.randomUUID()}-${safeFileName(scanned.name)}`;
        const uploadResult =
          await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(
              storagePath,
              scanned.file,
              {
                cacheControl: "3600",
                contentType:
                  scanned.file.type ||
                  "application/octet-stream",
                upsert: false,
              },
            );

        if (uploadResult.error) {
          throw uploadResult.error;
        }

        uploadedPaths.push(storagePath);
        const isPreview =
          PREVIEW_IMAGE_EXTENSIONS.has(
            scanned.extension,
          );
        const metadataResult =
          await supabase
            .from("print_project_files")
            .insert({
              user_id: user.id,
              project_id:
                targetProject.id,
              storage_path: storagePath,
              file_name: scanned.name,
              file_type:
                scanned.extension,
              mime_type:
                scanned.file.type ||
                "application/octet-stream",
              size_bytes: scanned.size,
              is_preview: isPreview,
              relative_path:
                scanned.relativePath,
              source_modified_at:
                scanned.lastModified > 0
                  ? new Date(
                      scanned.lastModified,
                    ).toISOString()
                  : null,
              source_kind:
                "folder_scan",
            })
            .select("*")
            .single();

        if (metadataResult.error) {
          throw metadataResult.error;
        }

        const fileRow = metadataResult.data as PrintProjectFileRow;
        let generatedPreviewPath: string | null = null;

        if (isViewableModelExtension(scanned.extension)) {
          try {
            generatedPreviewPath = await analyzeLocalModel(
              scanned.file,
              fileRow,
            );
            if (generatedPreviewPath) {
              uploadedPaths.push(generatedPreviewPath);
            }
          } catch {
            analysisWarnings += 1;
          }
        }

        importedCount += 1;

        if (!firstPreviewPath) {
          firstPreviewPath = isPreview
            ? storagePath
            : generatedPreviewPath;
        }

        if (existing) {
          replacements.push({
            oldId: existing.id,
            oldPaths: [
              existing.storage_path,
              existing.generated_preview_path,
            ].filter((path): path is string => Boolean(path)),
            newCoverPath: isPreview
              ? storagePath
              : generatedPreviewPath,
          });
        }
      }

      if (
        !targetProject.cover_path &&
        firstPreviewPath
      ) {
        const coverResult = await supabase
          .from("print_projects")
          .update({
            cover_path: firstPreviewPath,
          })
          .eq("id", targetProject.id)
          .eq("user_id", user.id);

        if (coverResult.error) {
          throw coverResult.error;
        }

        coverChanged = true;
      }

      let cleanupWarning = false;

      if (replacements.length > 0) {
        const oldIds = replacements.map(
          (replacement) =>
            replacement.oldId,
        );
        const oldCoverReplacement =
          replacements.find(
            (replacement) =>
              replacement.oldPaths.includes(
                targetProject.cover_path ?? "",
              ),
          );

        const deleteOldResult =
          await supabase
            .from("print_project_files")
            .delete()
            .eq("user_id", user.id)
            .in("id", oldIds);

        if (deleteOldResult.error) {
          throw deleteOldResult.error;
        }

        let keepOldCoverPath = false;
        if (oldCoverReplacement?.newCoverPath) {
          const coverResult = await supabase
            .from("print_projects")
            .update({
              cover_path:
                oldCoverReplacement.newCoverPath,
            })
            .eq("id", targetProject.id)
            .eq("user_id", user.id);

          if (coverResult.error) {
            keepOldCoverPath = true;
            cleanupWarning = true;
          } else {
            coverChanged = true;
          }
        } else if (oldCoverReplacement) {
          keepOldCoverPath = true;
          cleanupWarning = true;
        }

        const removableOldPaths =
          replacements
            .flatMap((replacement) => replacement.oldPaths)
            .filter(
              (oldPath) =>
                !keepOldCoverPath ||
                oldPath !==
                  targetProject.cover_path,
            );

        if (removableOldPaths.length > 0) {
          const removeOldResult =
            await supabase.storage
              .from(STORAGE_BUCKET)
              .remove(removableOldPaths);

          if (removeOldResult.error) {
            cleanupWarning = true;
          }
        }
      }

      setMessage(
        `${importedCount} Datei${importedCount === 1 ? "" : "en"} importiert${skippedDuplicates > 0 ? `, ${skippedDuplicates} unveränderte Duplikate übersprungen` : ""}${analysisWarnings > 0 ? `; ${analysisWarnings} Modell${analysisWarnings === 1 ? "" : "e"} nicht automatisch analysiert` : ""}${cleanupWarning ? "; ältere Storage-Dateien konnten teilweise nicht automatisch bereinigt werden" : ""}.`,
      );
      setScannerOpen(false);
      setScanResult(null);
      setScanSelectedIds(new Set());
      setScanProgress(null);
      await loadProjects();
    } catch (caughtError) {
      if (
        coverChanged &&
        targetProjectIdForRollback &&
        !createdProjectId
      ) {
        await supabase
          .from("print_projects")
          .update({ cover_path: originalCoverPathForRollback })
          .eq("id", targetProjectIdForRollback)
          .eq("user_id", user.id);
      }

      if (uploadedPaths.length > 0) {
        await supabase
          .from("print_project_files")
          .delete()
          .eq("user_id", user.id)
          .in(
            "storage_path",
            uploadedPaths,
          );
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove(uploadedPaths);
      }

      if (createdProjectId) {
        await supabase
          .from("print_projects")
          .delete()
          .eq("id", createdProjectId)
          .eq("user_id", user.id);
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Der Ordnerimport ist fehlgeschlagen.",
      );
    } finally {
      setScanImporting(false);
      setScanProgress(null);
    }
  }

  function startRescan(project: PrintProject) {
    clearFeedback();

    if (migrationMissing || viewerMigrationMissing) {
      setError(
        "Für den Rescan müssen zuerst die V17.1- und V17.2-Migrationen installiert sein.",
      );
      return;
    }

    setRescanProject(project);
    setRescanComparison(null);
    setRescanProgress(null);
    window.setTimeout(() => rescanInputRef.current?.click(), 0);
  }

  function closeRescan() {
    if (rescanChecking || rescanApplying) {
      return;
    }

    setRescanComparison(null);
    setRescanProject(null);
    setRescanProgress(null);
  }

  async function handleRescanDirectorySelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(
      event.target.files ?? [],
    ) as DirectorySelectableFile[];
    event.target.value = "";

    if (!user || !rescanProject || files.length === 0) {
      return;
    }

    clearFeedback();
    setRescanChecking(true);
    setRescanComparison(null);

    try {
      const scan = scanDirectoryFiles(files);
      const existingResult = await supabase
        .from("print_project_files")
        .select(
          "id,user_id,project_id,storage_path,file_name,file_type,mime_type,size_bytes,is_preview,relative_path,source_modified_at,source_kind,source_missing,source_last_seen_at,generated_preview_path,model_width_mm,model_depth_mm,model_height_mm,model_volume_mm3,triangle_count,metadata_extracted_at,version_group_id,version_number,version_note,created_at",
        )
        .eq("user_id", user.id)
        .eq("project_id", rescanProject.id)
        .eq("source_kind", "folder_scan")
        .order("version_number", { ascending: false })
        .order("created_at", { ascending: false });

      if (existingResult.error) {
        if (isRescanMigrationMissing(existingResult.error)) {
          setRescanMigrationMissing(true);
          throw new Error(
            "Bitte zuerst supabase/print_library_v17_2_9.sql im Supabase SQL Editor ausführen.",
          );
        }
        throw existingResult.error;
      }

      setRescanMigrationMissing(false);
      const existingRows = (existingResult.data ?? []) as PrintProjectFileRow[];
      const latestByGroup = new Map<string, PrintProjectFileRow>();
      const latestByPath = new Map<string, PrintProjectFileRow>();
      const maxVersionByGroup = new Map<string, number>();

      for (const row of existingRows) {
        const groupId = row.version_group_id ?? row.id;
        maxVersionByGroup.set(
          groupId,
          Math.max(maxVersionByGroup.get(groupId) ?? 0, Number(row.version_number) || 1),
        );

        if (!latestByGroup.has(groupId)) {
          latestByGroup.set(groupId, row);
        }
      }

      for (const row of latestByGroup.values()) {
        const key = row.relative_path.trim().toLocaleLowerCase("de");
        if (key && !latestByPath.has(key)) {
          latestByPath.set(key, row);
        }
      }

      const scannedByPath = new Map<string, ScannedPrintFile>();
      const allRecognizedPaths = new Set<string>();
      for (const scanned of scan.files) {
        const key = scanned.relativePath.trim().toLocaleLowerCase("de");
        if (key) {
          allRecognizedPaths.add(key);
        }
        if (scanned.status !== "ready") {
          continue;
        }
        if (key && !scannedByPath.has(key)) {
          scannedByPath.set(key, scanned);
        }
      }

      const rawNew: RescanCandidate[] = [];
      const changedFiles: RescanCandidate[] = [];
      const unchangedFiles: PrintProjectFileRow[] = [];

      for (const [key, scanned] of scannedByPath) {
        const existing = latestByPath.get(key);
        if (!existing) {
          rawNew.push({ scanned });
          continue;
        }

        const unchanged =
          Number(existing.size_bytes) === scanned.size &&
          sourceModifiedMs(existing.source_modified_at) === scanned.lastModified;

        if (unchanged) {
          unchangedFiles.push(existing);
          continue;
        }

        const groupId = existing.version_group_id ?? "";
        changedFiles.push({
          scanned,
          existing,
          nextVersion: groupId
            ? (maxVersionByGroup.get(groupId) ?? (Number(existing.version_number) || 1)) + 1
            : (Number(existing.version_number) || 1) + 1,
        });
      }

      const rawMissing = [...latestByPath.entries()]
        .filter(([key]) => !allRecognizedPaths.has(key))
        .map(([, row]) => row);

      const newFingerprintGroups = new Map<string, RescanCandidate[]>();
      for (const candidate of rawNew) {
        const scanned = candidate.scanned;
        const fingerprint = `${scanned.extension}|${scanned.size}|${scanned.lastModified}`;
        const group = newFingerprintGroups.get(fingerprint) ?? [];
        group.push(candidate);
        newFingerprintGroups.set(fingerprint, group);
      }

      const missingFingerprintGroups = new Map<string, PrintProjectFileRow[]>();
      for (const existing of rawMissing) {
        const fingerprint = `${existing.file_type}|${Number(existing.size_bytes)}|${sourceModifiedMs(existing.source_modified_at)}`;
        const group = missingFingerprintGroups.get(fingerprint) ?? [];
        group.push(existing);
        missingFingerprintGroups.set(fingerprint, group);
      }

      const movedNewIds = new Set<string>();
      const movedMissingIds = new Set<string>();
      const movedFiles: RescanMove[] = [];

      for (const [fingerprint, newGroup] of newFingerprintGroups) {
        const missingGroup = missingFingerprintGroups.get(fingerprint) ?? [];
        if (newGroup.length !== 1 || missingGroup.length !== 1) {
          continue;
        }

        movedFiles.push({
          scanned: newGroup[0].scanned,
          existing: missingGroup[0],
        });
        movedNewIds.add(newGroup[0].scanned.id);
        movedMissingIds.add(missingGroup[0].id);
      }

      const remainingNew = rawNew.filter(
        (candidate) => !movedNewIds.has(candidate.scanned.id),
      );
      const newFiles = remainingNew.filter((candidate) =>
        enabledScanExtensions.has(candidate.scanned.extension),
      );
      const disabledNewEntries = remainingNew.length - newFiles.length;
      const missingFiles = rawMissing.filter(
        (existing) => !movedMissingIds.has(existing.id),
      );

      setRescanComparison({
        projectId: rescanProject.id,
        rootName: scan.rootName,
        rootMismatch: Boolean(
          rescanProject.scan_root_name &&
            rescanProject.scan_root_name !== scan.rootName,
        ),
        scannedAt: new Date().toISOString(),
        newFiles,
        changedFiles,
        movedFiles,
        unchangedFiles,
        missingFiles,
        ignoredEntries: scan.unsupportedEntries,
        invalidEntries: scan.tooLargeEntries + scan.pathTooLongEntries,
        disabledNewEntries,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Der Ordner konnte nicht erneut geprüft werden.",
      );
    } finally {
      setRescanChecking(false);
    }
  }

  async function applyRescan() {
    if (!user || !rescanProject || !rescanComparison) {
      return;
    }

    if (rescanMigrationMissing) {
      setError(
        "Bitte zuerst supabase/print_library_v17_2_9.sql im Supabase SQL Editor ausführen.",
      );
      return;
    }

    const uploadCandidates = [
      ...rescanComparison.newFiles,
      ...rescanComparison.changedFiles,
    ];
    const uploadSize = uploadCandidates.reduce(
      (sum, candidate) => sum + candidate.scanned.size,
      0,
    );

    if (uploadCandidates.length > MAX_SCAN_IMPORT_FILES) {
      setError(
        `Pro Rescan können maximal ${MAX_SCAN_IMPORT_FILES} neue oder geänderte Dateien übernommen werden.`,
      );
      return;
    }

    if (uploadSize > MAX_SCAN_IMPORT_SIZE) {
      setError(
        "Die neuen und geänderten Dateien sind zusammen größer als 1 GB.",
      );
      return;
    }

    clearFeedback();
    setRescanApplying(true);
    const totalSteps = Math.max(
      1,
      uploadCandidates.length +
        rescanComparison.movedFiles.length +
        (rescanComparison.unchangedFiles.length > 0 ? 1 : 0) +
        (rescanComparison.missingFiles.length > 0 ? 1 : 0),
    );
    let currentStep = 0;
    setRescanProgress({
      current: 0,
      total: totalSteps,
      fileName: "Rescan wird vorbereitet …",
    });

    const uploadedPaths: string[] = [];
    const insertedIds: string[] = [];
    let nextCoverPath = rescanProject.cover_path;
    let analysisWarnings = 0;
    const nowIso = new Date().toISOString();

    const advance = (fileName: string) => {
      currentStep += 1;
      setRescanProgress({ current: currentStep, total: totalSteps, fileName });
    };

    try {
      for (const candidate of uploadCandidates) {
        const scanned = candidate.scanned;
        advance(scanned.relativePath);
        const storagePath = `${user.id}/${rescanProject.id}/${crypto.randomUUID()}-${safeFileName(scanned.name)}`;
        const uploadResult = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, scanned.file, {
            cacheControl: "3600",
            contentType: scanned.file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadResult.error) {
          throw uploadResult.error;
        }
        uploadedPaths.push(storagePath);

        const isPreview = PREVIEW_IMAGE_EXTENSIONS.has(scanned.extension);
        const isChanged = Boolean(candidate.existing);
        const versionNumber = isChanged
          ? candidate.nextVersion ?? ((Number(candidate.existing?.version_number) || 1) + 1)
          : 1;
        const insertPayload = {
          user_id: user.id,
          project_id: rescanProject.id,
          storage_path: storagePath,
          file_name: scanned.name,
          file_type: scanned.extension,
          mime_type: scanned.file.type || "application/octet-stream",
          size_bytes: scanned.size,
          is_preview: isPreview,
          relative_path: scanned.relativePath,
          source_modified_at:
            scanned.lastModified > 0
              ? new Date(scanned.lastModified).toISOString()
              : null,
          source_kind: "folder_scan" as const,
          source_missing: false,
          source_last_seen_at: nowIso,
          ...(isChanged && candidate.existing?.version_group_id
            ? {
                version_group_id: candidate.existing.version_group_id,
                version_number: versionNumber,
                version_note: `Rescan · Version ${versionNumber}`,
              }
            : {
                version_number: 1,
                version_note: "Rescan-Import",
              }),
        };

        const insertResult = await supabase
          .from("print_project_files")
          .insert(insertPayload)
          .select("*")
          .single();

        if (insertResult.error) {
          throw insertResult.error;
        }

        const newRow = insertResult.data as PrintProjectFileRow;
        insertedIds.push(newRow.id);
        let generatedPreviewPath: string | null = null;

        if (isViewableModelExtension(scanned.extension)) {
          try {
            generatedPreviewPath = await analyzeLocalModel(scanned.file, newRow);
            if (generatedPreviewPath) {
              uploadedPaths.push(generatedPreviewPath);
            }
          } catch {
            analysisWarnings += 1;
          }
        }

        const coverCandidate = isPreview ? storagePath : generatedPreviewPath;
        if (
          coverCandidate &&
          (!nextCoverPath ||
            nextCoverPath === candidate.existing?.storage_path ||
            nextCoverPath === candidate.existing?.generated_preview_path)
        ) {
          nextCoverPath = coverCandidate;
        }
      }

      for (const move of rescanComparison.movedFiles) {
        advance(`${move.existing.relative_path} → ${move.scanned.relativePath}`);
        const updateResult = await supabase
          .from("print_project_files")
          .update({
            file_name: move.scanned.name,
            relative_path: move.scanned.relativePath,
            source_modified_at:
              move.scanned.lastModified > 0
                ? new Date(move.scanned.lastModified).toISOString()
                : null,
            source_missing: false,
            source_last_seen_at: nowIso,
          })
          .eq("id", move.existing.id)
          .eq("user_id", user.id);

        if (updateResult.error) {
          throw updateResult.error;
        }
      }

      if (rescanComparison.unchangedFiles.length > 0) {
        advance("Unveränderte Dateien bestätigen");
        const unchangedResult = await supabase
          .from("print_project_files")
          .update({
            source_missing: false,
            source_last_seen_at: nowIso,
          })
          .eq("user_id", user.id)
          .in(
            "id",
            rescanComparison.unchangedFiles.map((file) => file.id),
          );

        if (unchangedResult.error) {
          throw unchangedResult.error;
        }
      }

      if (rescanComparison.missingFiles.length > 0) {
        advance("Fehlende Dateien markieren");
        const missingResult = await supabase
          .from("print_project_files")
          .update({ source_missing: true })
          .eq("user_id", user.id)
          .in(
            "id",
            rescanComparison.missingFiles.map((file) => file.id),
          );

        if (missingResult.error) {
          throw missingResult.error;
        }
      }

      if (currentStep === 0) {
        advance("Scanstatus speichern");
      }

      const projectUpdate = await supabase
        .from("print_projects")
        .update({
          scan_root_name: rescanComparison.rootName,
          last_scanned_at: nowIso,
          cover_path: nextCoverPath,
        })
        .eq("id", rescanProject.id)
        .eq("user_id", user.id);

      if (projectUpdate.error) {
        throw projectUpdate.error;
      }

      const summary = [
        `${rescanComparison.newFiles.length} neu`,
        `${rescanComparison.changedFiles.length} geändert`,
        `${rescanComparison.movedFiles.length} verschoben`,
        `${rescanComparison.missingFiles.length} nicht gefunden`,
        `${rescanComparison.unchangedFiles.length} unverändert`,
      ].join(" · ");

      setMessage(
        `Rescan abgeschlossen: ${summary}${analysisWarnings > 0 ? ` · ${analysisWarnings} Modell${analysisWarnings === 1 ? "" : "e"} nicht automatisch analysiert` : ""}.`,
      );
      const projectToReload: PrintProject = {
        ...rescanProject,
        scan_root_name: rescanComparison.rootName,
        last_scanned_at: nowIso,
        cover_path: nextCoverPath,
      };
      setRescanComparison(null);
      setRescanProject(null);
      setRescanProgress(null);
      await loadProjects();
      if (selectedProject?.id === projectToReload.id) {
        await loadProjectFiles(projectToReload);
      }
    } catch (caughtError) {
      if (insertedIds.length > 0) {
        await supabase
          .from("print_project_files")
          .delete()
          .eq("user_id", user.id)
          .in("id", insertedIds);
      }
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Die Rescan-Änderungen konnten nicht übernommen werden.",
      );
    } finally {
      setRescanApplying(false);
      setRescanProgress(null);
    }
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!user || !selectedProject || files.length === 0) {
      return;
    }

    clearFeedback();
    const invalidFile = files.find((file) => {
      const extension = extensionOf(file.name);
      return !ALL_PRINT_EXTENSIONS.has(extension) || file.size > MAX_PRINT_FILE_SIZE;
    });

    if (invalidFile) {
      const extension = extensionOf(invalidFile.name);
      setError(
        invalidFile.size > MAX_PRINT_FILE_SIZE
          ? `„${invalidFile.name}“ ist größer als 100 MB.`
          : `Der Dateityp .${extension || "?"} wird noch nicht unterstützt.`,
      );
      return;
    }

    setUploading(true);
    const uploadedPaths: string[] = [];
    let analysisWarnings = 0;
    const originalCoverPath = selectedProject.cover_path;
    let projectHasCover = Boolean(originalCoverPath);
    let coverChanged = false;

    try {
      for (const file of files) {
        const extension = extensionOf(file.name);
        const storagePath = `${user.id}/${selectedProject.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const uploadResult = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file, {
            cacheControl: "3600",
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadResult.error) {
          throw uploadResult.error;
        }
        uploadedPaths.push(storagePath);

        const isImage = PREVIEW_IMAGE_EXTENSIONS.has(extension);
        const metadataResult = await supabase
          .from("print_project_files")
          .insert({
            user_id: user.id,
            project_id: selectedProject.id,
            storage_path: storagePath,
            file_name: file.name,
            file_type: extension,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            is_preview: isImage,
            relative_path: file.name,
            source_modified_at:
              file.lastModified > 0
                ? new Date(file.lastModified).toISOString()
                : null,
            source_kind: "upload",
          })
          .select("*")
          .single();

        if (metadataResult.error) {
          throw metadataResult.error;
        }

        const fileRow = metadataResult.data as PrintProjectFileRow;
        let generatedPreviewPath: string | null = null;

        if (isViewableModelExtension(extension)) {
          try {
            generatedPreviewPath = await analyzeLocalModel(file, fileRow);
            if (generatedPreviewPath) {
              uploadedPaths.push(generatedPreviewPath);
            }
          } catch {
            analysisWarnings += 1;
          }
        }

        const coverCandidate = isImage
          ? storagePath
          : generatedPreviewPath;

        if (coverCandidate && !projectHasCover) {
          const coverResult = await supabase
            .from("print_projects")
            .update({ cover_path: coverCandidate })
            .eq("id", selectedProject.id)
            .eq("user_id", user.id);

          if (coverResult.error) {
            throw coverResult.error;
          }
          projectHasCover = true;
          coverChanged = true;
        }
      }

      setMessage(
        `${files.length} Datei${files.length === 1 ? "" : "en"} hochgeladen${analysisWarnings > 0 ? `; ${analysisWarnings} Modell${analysisWarnings === 1 ? "" : "e"} konnte${analysisWarnings === 1 ? "" : "n"} nicht automatisch analysiert werden` : ""}.`,
      );
      await loadProjects();
      await loadProjectFiles(selectedProject);
    } catch (caughtError) {
      if (coverChanged) {
        await supabase
          .from("print_projects")
          .update({ cover_path: originalCoverPath })
          .eq("id", selectedProject.id)
          .eq("user_id", user.id);
      }

      if (uploadedPaths.length > 0) {
        await supabase
          .from("print_project_files")
          .delete()
          .eq("user_id", user.id)
          .in("storage_path", uploadedPaths);
        await supabase.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
      }
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Dateien konnten nicht hochgeladen werden.",
      );
    } finally {
      setUploading(false);
    }
  }

  function startNewVersion(file: PrintProjectFileRow) {
    clearFeedback();

    if (viewerMigrationMissing) {
      setError("Bitte zuerst supabase/print_library_v17_2.sql ausführen.");
      return;
    }

    setVersionTarget(file);
    versionInputRef.current?.click();
  }

  async function uploadNewVersion(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file || !user || !selectedProject || !versionTarget) {
      return;
    }

    const extension = extensionOf(file.name);
    if (extension !== versionTarget.file_type) {
      setError(
        `Die neue Version muss ebenfalls eine .${versionTarget.file_type}-Datei sein.`,
      );
      setVersionTarget(null);
      return;
    }

    if (file.size > MAX_PRINT_FILE_SIZE) {
      setError("Die neue Version ist größer als 100 MB.");
      setVersionTarget(null);
      return;
    }

    if (!versionTarget.version_group_id) {
      setError("Für diese Datei fehlt die Versionsgruppe. Bitte die V17.2-Migration erneut ausführen.");
      setVersionTarget(null);
      return;
    }

    const nextVersion =
      Math.max(
        0,
        ...projectFiles
          .filter(
            (entry) =>
              entry.version_group_id === versionTarget.version_group_id,
          )
          .map((entry) => Number(entry.version_number) || 1),
      ) + 1;
    const storagePath = `${user.id}/${selectedProject.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

    setUploading(true);
    try {
      const uploadResult = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadResult.error) {
        throw uploadResult.error;
      }

      const insertResult = await supabase
        .from("print_project_files")
        .insert({
          user_id: user.id,
          project_id: selectedProject.id,
          storage_path: storagePath,
          file_name: file.name,
          file_type: extension,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          is_preview: false,
          relative_path: file.name,
          source_modified_at:
            file.lastModified > 0
              ? new Date(file.lastModified).toISOString()
              : null,
          source_kind: "upload",
          version_group_id: versionTarget.version_group_id,
          version_number: nextVersion,
          version_note: `Version ${nextVersion}`,
        })
        .select("*")
        .single();

      if (insertResult.error) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        throw insertResult.error;
      }

      const newRow = insertResult.data as PrintProjectFileRow;
      let previewPath: string | null = null;

      try {
        previewPath = await analyzeLocalModel(file, newRow);
      } catch {
        // Die Version bleibt nutzbar und kann später im Viewer analysiert werden.
      }

      if (
        previewPath &&
        (selectedProject.cover_path === versionTarget.generated_preview_path ||
          !selectedProject.cover_path)
      ) {
        await supabase
          .from("print_projects")
          .update({ cover_path: previewPath })
          .eq("id", selectedProject.id)
          .eq("user_id", user.id);
      }

      setMessage(`Version V${nextVersion} wurde hochgeladen.`);
      await loadProjectFiles(selectedProject);
      await loadProjects();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Die neue Version konnte nicht hochgeladen werden.",
      );
    } finally {
      setUploading(false);
      setVersionTarget(null);
    }
  }

  async function downloadFile(file: PrintProjectFileRow) {
    const result = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(file.storage_path, 60, {
        download: file.file_name,
      });

    if (result.error || !result.data?.signedUrl) {
      setError(result.error?.message ?? "Download konnte nicht vorbereitet werden.");
      return;
    }

    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function setCover(file: PrintProjectFileRow) {
    if (!user || !selectedProject) {
      return;
    }

    const coverPath = PREVIEW_IMAGE_EXTENSIONS.has(file.file_type)
      ? file.storage_path
      : file.generated_preview_path;

    if (!coverPath) {
      return;
    }

    const result = await supabase
      .from("print_projects")
      .update({ cover_path: coverPath })
      .eq("id", selectedProject.id)
      .eq("user_id", user.id);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage("Vorschaubild wurde geändert.");
    await loadProjects();
  }

  async function deleteFile(file: PrintProjectFileRow) {
    if (!user || !selectedProject) {
      return;
    }

    if (!window.confirm(`„${file.file_name}“ wirklich löschen?`)) {
      return;
    }

    clearFeedback();
    setBusy(true);

    const storagePaths = [
      file.storage_path,
      file.generated_preview_path,
    ].filter((path): path is string => Boolean(path));
    const storageResult = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(storagePaths);

    if (storageResult.error) {
      setError(storageResult.error.message);
      setBusy(false);
      return;
    }

    const databaseResult = await supabase
      .from("print_project_files")
      .delete()
      .eq("id", file.id)
      .eq("user_id", user.id);

    if (databaseResult.error) {
      setError(databaseResult.error.message);
      setBusy(false);
      return;
    }

    if (
      selectedProject.cover_path === file.storage_path ||
      selectedProject.cover_path === file.generated_preview_path
    ) {
      const nextCover = projectFiles.find(
        (entry) =>
          entry.id !== file.id &&
          (PREVIEW_IMAGE_EXTENSIONS.has(entry.file_type) ||
            Boolean(entry.generated_preview_path)),
      );
      const nextCoverPath = nextCover
        ? PREVIEW_IMAGE_EXTENSIONS.has(nextCover.file_type)
          ? nextCover.storage_path
          : nextCover.generated_preview_path
        : null;
      await supabase
        .from("print_projects")
        .update({ cover_path: nextCoverPath })
        .eq("id", selectedProject.id)
        .eq("user_id", user.id);
    }

    if (viewerFile?.id === file.id) {
      setViewerFile(null);
      setViewerUrl("");
    }

    setMessage("Datei wurde gelöscht.");
    setBusy(false);
    await loadProjects();
    await loadProjectFiles(selectedProject);
  }

  async function deleteProject(project: PrintProject) {
    if (!user) {
      return;
    }

    if (
      !window.confirm(
        `Projekt „${project.name}“ und alle zugehörigen Dateien dauerhaft löschen?`,
      )
    ) {
      return;
    }

    clearFeedback();
    setBusy(true);
    const filesResult = viewerMigrationMissing
      ? await supabase
          .from("print_project_files")
          .select("storage_path")
          .eq("project_id", project.id)
          .eq("user_id", user.id)
      : await supabase
          .from("print_project_files")
          .select("storage_path,generated_preview_path")
          .eq("project_id", project.id)
          .eq("user_id", user.id);

    if (filesResult.error) {
      setError(filesResult.error.message);
      setBusy(false);
      return;
    }

    const projectStorageRows = (filesResult.data ?? []) as Array<{
      storage_path: string;
      generated_preview_path?: string | null;
    }>;
    const paths = projectStorageRows.flatMap((file) =>
      [file.storage_path, file.generated_preview_path].filter(
        (path): path is string => Boolean(path),
      ),
    );
    if (paths.length > 0) {
      const removeResult = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
      if (removeResult.error) {
        setError(removeResult.error.message);
        setBusy(false);
        return;
      }
    }

    const result = await supabase
      .from("print_projects")
      .delete()
      .eq("id", project.id)
      .eq("user_id", user.id);

    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (selectedProject?.id === project.id) {
      setSelectedProject(null);
      setProjectFiles([]);
    }
    setMessage("Projekt wurde gelöscht.");
    await loadProjects();
  }

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <span className="welcome-label">PRINT VAULT</span>
          <h1>Druckbibliothek</h1>
          <p>Modelle, Druckdateien, Bilder und Notizen an einem Ort verwalten</p>
        </div>
        <div className={styles.headerActions}>
          <input
            ref={folderInputRef}
            className={styles.hiddenInput}
            type="file"
            multiple
            onChange={handleDirectorySelection}
          />
          <input
            ref={rescanInputRef}
            className={styles.hiddenInput}
            type="file"
            multiple
            onChange={(event) => void handleRescanDirectorySelection(event)}
          />
          <button
            className="secondary-button"
            type="button"
            disabled={
              loading ||
              busy ||
              setupMissing ||
              migrationMissing
            }
            onClick={() => openScanner()}
          >
            Ordner scannen
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={loading || busy}
            onClick={() => void loadProjects()}
          >
            Aktualisieren
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={setupMissing || busy}
            onClick={startCreate}
          >
            + Neues Projekt
          </button>
        </div>
      </header>

      {(message || error) && (
        <div
          className={`${styles.feedback} ${
            error ? styles.feedbackError : styles.feedbackSuccess
          }`}
        >
          {error || message}
        </div>
      )}

      {setupMissing ? (
        <section className={styles.setupState}>
          <strong>Einmalige Einrichtung nötig</strong>
          <p>
            Führe den vollständigen Inhalt von <code>supabase/print_library.sql</code>{" "}
            im Supabase SQL Editor aus. Danach diese Seite aktualisieren.
          </p>
        </section>
      ) : (
        <>
          {migrationMissing && (
            <section className={styles.migrationState}>
              <strong>V17.1-Migration erforderlich</strong>
              <p>
                Führe einmal <code>supabase/print_library_v17_1.sql</code> im
                Supabase SQL Editor aus. Die vorhandene Druckbibliothek bleibt
                dabei erhalten.
              </p>
            </section>
          )}

          {viewerMigrationMissing && (
            <section className={styles.migrationState}>
              <strong>V17.2-Migration erforderlich</strong>
              <p>
                Führe einmal <code>supabase/print_library_v17_2.sql</code> im
                Supabase SQL Editor aus. Danach stehen 3D-Metadaten, automatische
                Vorschaubilder und Versionierung zur Verfügung.
              </p>
            </section>
          )}

          {formOpen && (
            <section className={styles.formPanel}>
              <div className={styles.formHeader}>
                <div>
                  <span>{editingId ? "Projekt bearbeiten" : "Neues Projekt"}</span>
                  <h2>{editingId ? form.name || "Projekt" : "Projektdaten"}</h2>
                </div>
                <button type="button" onClick={closeForm}>
                  Schließen
                </button>
              </div>
              <form className={styles.form} onSubmit={(event) => void saveProject(event)}>
                <label className={styles.fieldWide}>
                  <span>Projektname *</span>
                  <input
                    required
                    maxLength={200}
                    value={form.name}
                    placeholder="z. B. Ersatzteil Maschinenabdeckung"
                    onChange={(event) => setField("name", event.target.value)}
                  />
                </label>
                <label>
                  <span>Ordner</span>
                  <input
                    maxLength={120}
                    list="print-library-folders"
                    value={form.folder}
                    placeholder="z. B. Ersatzteile"
                    onChange={(event) => setField("folder", event.target.value)}
                  />
                  <datalist id="print-library-folders">
                    {folders.map((folder) => (
                      <option value={folder} key={folder} />
                    ))}
                  </datalist>
                </label>
                <label>
                  <span>Tags, mit Komma getrennt</span>
                  <input
                    value={form.tags}
                    placeholder="PLA, Bambu A1, Kunde Müller"
                    onChange={(event) => setField("tags", event.target.value)}
                  />
                </label>
                <label className={styles.fieldFull}>
                  <span>Beschreibung / Druckhinweise</span>
                  <textarea
                    rows={4}
                    maxLength={5000}
                    value={form.description}
                    placeholder="Optionale Hinweise, Einstellungen oder Änderungsnotizen"
                    onChange={(event) => setField("description", event.target.value)}
                  />
                </label>
                <label className={styles.favoriteField}>
                  <input
                    type="checkbox"
                    checked={form.favorite}
                    onChange={(event) => setField("favorite", event.target.checked)}
                  />
                  <span>Als Favorit markieren</span>
                </label>
                <div className={styles.formActions}>
                  <button className="secondary-button" type="button" onClick={closeForm}>
                    Abbrechen
                  </button>
                  <button className="primary-button" type="submit" disabled={busy}>
                    {busy ? "Wird gespeichert …" : "Projekt speichern"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className={styles.summaryGrid}>
            <article>
              <span>Projekte</span>
              <strong>{projects.length}</strong>
              <small>{projects.filter((project) => project.favorite).length} Favoriten</small>
            </article>
            <article>
              <span>Dateien</span>
              <strong>{totalFiles}</strong>
              <small>Modelle, Bilder und Druckdateien</small>
            </article>
            <article>
              <span>Speicher</span>
              <strong>{formatBytes(totalSize)}</strong>
              <small>Privat in Supabase Storage</small>
            </article>
            <article>
              <span>Ordner</span>
              <strong>{folders.length}</strong>
              <small>Frei benennbare Sammlungen</small>
            </article>
          </section>

          <section className={styles.toolbar}>
            <input
              type="search"
              placeholder="Projekte, Ordner, Tags oder Notizen durchsuchen …"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              value={folderFilter}
              onChange={(event) => setFolderFilter(event.target.value)}
            >
              <option value="all">Alle Ordner</option>
              {folders.map((folder) => (
                <option value={folder} key={folder}>
                  {folder}
                </option>
              ))}
            </select>
            <button
              className={favoriteOnly ? styles.filterActive : ""}
              type="button"
              onClick={() => setFavoriteOnly((current) => !current)}
            >
              ★ Nur Favoriten
            </button>
          </section>

          {loading ? (
            <div className={styles.emptyState}>Druckbibliothek wird geladen …</div>
          ) : filteredProjects.length === 0 ? (
            <div className={styles.emptyState}>
              {projects.length === 0
                ? "Noch keine Druckprojekte vorhanden."
                : "Keine passenden Projekte gefunden."}
            </div>
          ) : (
            <section className={styles.projectGrid}>
              {filteredProjects.map((project) => (
                <article className={styles.projectCard} key={project.id}>
                  <button
                    className={styles.coverButton}
                    type="button"
                    onClick={() => void loadProjectFiles(project)}
                  >
                    {project.coverUrl ? (
                      // Signed URLs stammen aus dem privaten Benutzer-Bucket.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={project.coverUrl} alt="" />
                    ) : (
                      <div className={styles.filePlaceholder}>
                        <span>◇</span>
                        <small>Keine Vorschau</small>
                      </div>
                    )}
                  </button>
                  <div className={styles.projectBody}>
                    <div className={styles.projectTitleRow}>
                      <div>
                        <span>{project.folder || "Ohne Ordner"}</span>
                        <h2>{project.name}</h2>
                      </div>
                      <button
                        className={`${styles.favoriteButton} ${
                          project.favorite ? styles.favoriteButtonActive : ""
                        }`}
                        type="button"
                        aria-label={
                          project.favorite
                            ? "Aus Favoriten entfernen"
                            : "Zu Favoriten hinzufügen"
                        }
                        onClick={() => void toggleFavorite(project)}
                      >
                        ★
                      </button>
                    </div>
                    <p>{project.description || "Noch keine Beschreibung hinterlegt."}</p>
                    <div className={styles.tags}>
                      {project.tags.length > 0 ? (
                        project.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)
                      ) : (
                        <span>Keine Tags</span>
                      )}
                    </div>
                    <dl className={styles.projectMeta}>
                      <div>
                        <dt>Dateien</dt>
                        <dd>{project.fileCount}</dd>
                      </div>
                      <div>
                        <dt>Größe</dt>
                        <dd>{formatBytes(project.totalSize)}</dd>
                      </div>
                      <div>
                        <dt>Geändert</dt>
                        <dd>{formatDate(project.updated_at)}</dd>
                      </div>
                    </dl>
                    <div className={styles.projectActions}>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => void loadProjectFiles(project)}
                      >
                        Öffnen
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={rescanChecking || rescanApplying || migrationMissing || viewerMigrationMissing}
                        onClick={() => startRescan(project)}
                      >
                        ↻ Rescan
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => startEdit(project)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="delete-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void deleteProject(project)}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}

      {scannerOpen && (
        <div
          className={styles.scannerBackdrop}
          role="presentation"
        >
          <section
            className={styles.scannerPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Lokalen Druckordner scannen"
          >
            <header className={styles.scannerHeader}>
              <div>
                <span>LOKALER ORDNER-SCAN</span>
                <h2>Druckdateien finden</h2>
                <p>
                  Philamentix prüft die ausgewählten Dateien zuerst nur lokal.
                  Erst beim Import werden markierte Dateien hochgeladen.
                </p>
              </div>
              <button
                type="button"
                aria-label="Scanner schließen"
                disabled={scanImporting}
                onClick={closeScanner}
              >
                ×
              </button>
            </header>

            <div className={styles.scannerBody}>
              <section className={styles.scanSourcePanel}>
                <div>
                  <strong>
                    {scanResult
                      ? scanResult.rootName
                      : "Noch kein Ordner ausgewählt"}
                  </strong>
                  <p>
                    Der Browser benötigt eine bewusste Ordnerauswahl. Ein
                    automatischer Zugriff auf andere Computerordner findet
                    nicht statt.
                  </p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  disabled={scanImporting}
                  onClick={chooseLocalFolder}
                >
                  {scanResult
                    ? "Anderen Ordner wählen"
                    : "Ordner auswählen"}
                </button>
              </section>

              <section className={styles.formatPanel}>
                <div className={styles.scanSectionHeading}>
                  <div>
                    <span>Formate</span>
                    <h3>Wonach soll gesucht werden?</h3>
                  </div>
                  <small>
                    Die Auswahl wird nur in diesem Browser gespeichert.
                  </small>
                </div>

                <div className={styles.formatGroups}>
                  {PRINT_FORMAT_GROUPS.map((group) => (
                    <article className={styles.formatGroup} key={group.id}>
                      <div>
                        <strong>{group.label}</strong>
                        <p>{group.description}</p>
                      </div>
                      <div className={styles.formatChips}>
                        {group.formats.map((format) => {
                          const active = enabledScanExtensions.has(
                            format.extension,
                          );
                          const resultCount =
                            scanResult?.files.filter(
                              (file) =>
                                file.extension === format.extension,
                            ).length ?? 0;

                          return (
                            <button
                              className={active ? styles.formatChipActive : ""}
                              type="button"
                              aria-pressed={active}
                              key={format.extension}
                              onClick={() =>
                                toggleScanExtension(format.extension)
                              }
                            >
                              {format.label}
                              {scanResult && <small>{resultCount}</small>}
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {scanResult && (
                <>
                  <section className={styles.scanStats}>
                    <article>
                      <span>Ordnerinhalt</span>
                      <strong>{scanResult.totalEntries}</strong>
                      <small>alle gefundenen Dateien</small>
                    </article>
                    <article>
                      <span>Bekannte Formate</span>
                      <strong>{scanResult.files.length}</strong>
                      <small>{formatBytes(scanResult.recognizedSize)}</small>
                    </article>
                    <article>
                      <span>Nicht unterstützt</span>
                      <strong>{scanResult.unsupportedEntries}</strong>
                      <small>werden nicht hochgeladen</small>
                    </article>
                    <article>
                      <span>Nicht importierbar</span>
                      <strong>
                        {scanResult.tooLargeEntries +
                          scanResult.pathTooLongEntries}
                      </strong>
                      <small>zu groß oder Pfad zu lang</small>
                    </article>
                  </section>

                  {scanResult.ignoredFiles.length > 0 && (
                    <details className={styles.ignoredPanel}>
                      <summary>
                        <span>Ignorierte Dateien anzeigen</span>
                        <strong>{scanResult.ignoredFiles.length}</strong>
                      </summary>
                      <div className={styles.ignoredList}>
                        {scanResult.ignoredFiles.slice(0, 500).map((file) => (
                          <div className={styles.ignoredRow} key={file.id}>
                            <span className={styles.ignoredType}>
                              {file.extension
                                ? `.${file.extension}`
                                : "ohne Endung"}
                            </span>
                            <span className={styles.ignoredPath}>
                              <strong>{file.name}</strong>
                              <small>{file.relativePath}</small>
                            </span>
                            <span>{formatBytes(file.size)}</span>
                            <span>Nicht unterstützt</span>
                          </div>
                        ))}
                        {scanResult.ignoredFiles.length > 500 && (
                          <p className={styles.ignoredLimit}>
                            Weitere {scanResult.ignoredFiles.length - 500} ignorierte
                            Dateien werden aus Leistungsgründen nicht einzeln
                            dargestellt.
                          </p>
                        )}
                      </div>
                    </details>
                  )}

                  <section className={styles.scanToolbar}>
                    <input
                      type="search"
                      value={scanSearch}
                      placeholder="Dateiname oder Pfad durchsuchen …"
                      onChange={(event) => setScanSearch(event.target.value)}
                    />
                    <select
                      value={scanFormatFilter}
                      onChange={(event) =>
                        setScanFormatFilter(event.target.value)
                      }
                    >
                      <option value="all">Alle aktivierten Formate</option>
                      {scanFormatOptions.map((extension) => (
                        <option value={extension} key={extension}>
                          {formatLabelForExtension(extension)}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={selectVisibleScannedFiles}>
                      Sichtbare auswählen
                    </button>
                    <button type="button" onClick={clearScannedSelection}>
                      Auswahl leeren
                    </button>
                  </section>

                  <section className={styles.scanFileList}>
                    {visibleScannedFiles.length === 0 ? (
                      <div className={styles.emptyState}>
                        Für die aktuelle Format- und Suchauswahl wurden keine
                        Dateien gefunden.
                      </div>
                    ) : (
                      visibleScannedFiles.map((file) => (
                        <label
                          className={`${styles.scanFileRow} ${
                            file.status !== "ready"
                              ? styles.scanFileRowInvalid
                              : ""
                          }`}
                          key={file.id}
                        >
                          <input
                            type="checkbox"
                            disabled={file.status !== "ready"}
                            checked={scanSelectedIds.has(file.id)}
                            onChange={() => toggleScannedFile(file)}
                          />
                          <span className={styles.scanFormatMark}>
                            {formatLabelForExtension(file.extension)}
                          </span>
                          <span className={styles.scanFilePath}>
                            <strong>{file.name}</strong>
                            <small>{file.relativePath}</small>
                          </span>
                          <span className={styles.scanFileSize}>
                            {formatBytes(file.size)}
                          </span>
                          <span className={styles.scanFileStatus}>
                            {file.status === "ready"
                              ? "Bereit"
                              : file.status === "too_large"
                                ? "Über 100 MB"
                                : "Pfad zu lang"}
                          </span>
                        </label>
                      ))
                    )}
                  </section>

                  {filteredScannedFiles.length > SCAN_RESULTS_PER_PAGE && (
                    <nav
                      className={styles.scanPagination}
                      aria-label="Scanergebnisse"
                    >
                      <button
                        type="button"
                        disabled={scanPage <= 1}
                        onClick={() =>
                          setScanPage((current) => Math.max(1, current - 1))
                        }
                      >
                        ← Zurück
                      </button>
                      <span>
                        Seite {Math.min(scanPage, scanTotalPages)} von{" "}
                        {scanTotalPages} · {filteredScannedFiles.length} Treffer
                      </span>
                      <button
                        type="button"
                        disabled={scanPage >= scanTotalPages}
                        onClick={() =>
                          setScanPage((current) =>
                            Math.min(scanTotalPages, current + 1),
                          )
                        }
                      >
                        Weiter →
                      </button>
                    </nav>
                  )}

                  <section className={styles.scanImportPanel}>
                    <div className={styles.scanSectionHeading}>
                      <div>
                        <span>Import</span>
                        <h3>Ziel in der Druckbibliothek</h3>
                      </div>
                      <small>
                        {selectedScannedFiles.length} Dateien · {formatBytes(
                          selectedScannedSize,
                        )}
                      </small>
                    </div>

                    <div className={styles.scanTargetChoice}>
                      <label>
                        <input
                          type="radio"
                          name="scan-target"
                          value="new"
                          checked={scanTargetMode === "new"}
                          onChange={() => setScanTargetMode("new")}
                        />
                        Neues Projekt anlegen
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="scan-target"
                          value="existing"
                          checked={scanTargetMode === "existing"}
                          disabled={projects.length === 0}
                          onChange={() => setScanTargetMode("existing")}
                        />
                        Vorhandenes Projekt verwenden
                      </label>
                    </div>

                    {scanTargetMode === "new" ? (
                      <label className={styles.scanTargetField}>
                        <span>Projektname</span>
                        <input
                          maxLength={200}
                          value={scanProjectName}
                          onChange={(event) =>
                            setScanProjectName(event.target.value)
                          }
                        />
                      </label>
                    ) : (
                      <label className={styles.scanTargetField}>
                        <span>Zielprojekt</span>
                        <select
                          value={scanTargetProjectId}
                          onChange={(event) =>
                            setScanTargetProjectId(event.target.value)
                          }
                        >
                          <option value="">Projekt auswählen</option>
                          {projects.map((project) => (
                            <option value={project.id} key={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {scanProgress && (
                      <div className={styles.scanProgress}>
                        <div>
                          <span>
                            Datei {scanProgress.current} von {scanProgress.total}
                          </span>
                          <strong>{scanProgress.fileName}</strong>
                        </div>
                        <progress
                          max={scanProgress.total}
                          value={scanProgress.current}
                        />
                      </div>
                    )}

                    <div className={styles.scanImportActions}>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={scanImporting}
                        onClick={closeScanner}
                      >
                        Abbrechen
                      </button>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={
                          scanImporting || selectedScannedFiles.length === 0
                        }
                        onClick={() => void importScannedFiles()}
                      >
                        {scanImporting
                          ? "Import läuft …"
                          : "Auswahl importieren"}
                      </button>
                    </div>
                  </section>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {rescanProject && rescanComparison && (
        <div className={styles.scannerBackdrop} role="presentation">
          <section
            className={`${styles.scannerPanel} ${styles.rescanPanel}`}
            role="dialog"
            aria-modal="true"
            aria-label="Druckordner erneut scannen"
          >
            <header className={styles.scannerHeader}>
              <div>
                <span>RESCAN · {rescanProject.name}</span>
                <h2>Änderungen gefunden</h2>
                <p>
                  Der lokale Ordner wurde mit dem letzten Stand der Druckbibliothek
                  verglichen. Fehlende Dateien werden nur markiert und niemals
                  automatisch gelöscht.
                </p>
              </div>
              <button
                type="button"
                aria-label="Rescan schließen"
                disabled={rescanApplying}
                onClick={closeRescan}
              >
                ×
              </button>
            </header>

            <div className={styles.scannerBody}>
              <section className={styles.rescanSourceLine}>
                <div>
                  <span>Ausgewählter Ordner</span>
                  <strong>{rescanComparison.rootName}</strong>
                  <small>
                    Letzter gespeicherter Scan: {formatDateTime(rescanProject.last_scanned_at)}
                  </small>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={rescanApplying}
                  onClick={() => rescanInputRef.current?.click()}
                >
                  Anderen Ordner wählen
                </button>
              </section>

              {rescanComparison.rootMismatch && (
                <div className={styles.rescanWarning}>
                  <strong>Ordnername weicht ab</strong>
                  <span>
                    Bisher war „{rescanProject.scan_root_name}“ hinterlegt. Prüfe kurz,
                    ob du wirklich den richtigen Projektordner ausgewählt hast.
                  </span>
                </div>
              )}

              <section className={styles.rescanStats}>
                <article className={styles.rescanNew}>
                  <span>Neu</span>
                  <strong>{rescanComparison.newFiles.length}</strong>
                  <small>werden hinzugefügt</small>
                </article>
                <article className={styles.rescanChanged}>
                  <span>Geändert</span>
                  <strong>{rescanComparison.changedFiles.length}</strong>
                  <small>werden neue Versionen</small>
                </article>
                <article className={styles.rescanMoved}>
                  <span>Verschoben</span>
                  <strong>{rescanComparison.movedFiles.length}</strong>
                  <small>Pfad wird aktualisiert</small>
                </article>
                <article className={styles.rescanMissing}>
                  <span>Nicht gefunden</span>
                  <strong>{rescanComparison.missingFiles.length}</strong>
                  <small>nur markieren</small>
                </article>
                <article className={styles.rescanUnchanged}>
                  <span>Unverändert</span>
                  <strong>{rescanComparison.unchangedFiles.length}</strong>
                  <small>keine Aktion nötig</small>
                </article>
              </section>

              {(rescanComparison.ignoredEntries > 0 ||
                rescanComparison.invalidEntries > 0 ||
                rescanComparison.disabledNewEntries > 0) && (
                <div className={styles.rescanNotice}>
                  {rescanComparison.ignoredEntries > 0 && (
                    <span>{rescanComparison.ignoredEntries} nicht unterstützte Dateien ignoriert</span>
                  )}
                  {rescanComparison.invalidEntries > 0 && (
                    <span>{rescanComparison.invalidEntries} Dateien zu groß oder mit zu langem Pfad</span>
                  )}
                  {rescanComparison.disabledNewEntries > 0 && (
                    <span>{rescanComparison.disabledNewEntries} neue Dateien durch deine Format-Auswahl übersprungen</span>
                  )}
                </div>
              )}

              <section className={styles.rescanDetails}>
                <div className={styles.scanSectionHeading}>
                  <div>
                    <span>Vorschau</span>
                    <h3>Was wird geändert?</h3>
                  </div>
                  <small>Es werden höchstens 24 Einträge je Kategorie angezeigt.</small>
                </div>

                {rescanComparison.newFiles.length > 0 && (
                  <div className={styles.rescanGroup}>
                    <strong>+ Neue Dateien</strong>
                    {rescanComparison.newFiles.slice(0, 24).map(({ scanned }) => (
                      <span key={`new:${scanned.id}`}>{scanned.relativePath}</span>
                    ))}
                  </div>
                )}
                {rescanComparison.changedFiles.length > 0 && (
                  <div className={styles.rescanGroup}>
                    <strong>↻ Geänderte Dateien</strong>
                    {rescanComparison.changedFiles.slice(0, 24).map(({ scanned, nextVersion }) => (
                      <span key={`changed:${scanned.id}`}>
                        {scanned.relativePath} → V{nextVersion}
                      </span>
                    ))}
                  </div>
                )}
                {rescanComparison.movedFiles.length > 0 && (
                  <div className={styles.rescanGroup}>
                    <strong>⇄ Verschobene Dateien</strong>
                    {rescanComparison.movedFiles.slice(0, 24).map(({ scanned, existing }) => (
                      <span key={`moved:${existing.id}`}>
                        {existing.relative_path} → {scanned.relativePath}
                      </span>
                    ))}
                  </div>
                )}
                {rescanComparison.missingFiles.length > 0 && (
                  <div className={`${styles.rescanGroup} ${styles.rescanGroupMissing}`}>
                    <strong>⚠ Lokal nicht gefunden</strong>
                    {rescanComparison.missingFiles.slice(0, 24).map((file) => (
                      <span key={`missing:${file.id}`}>{file.relative_path}</span>
                    ))}
                  </div>
                )}
                {rescanComparison.newFiles.length === 0 &&
                  rescanComparison.changedFiles.length === 0 &&
                  rescanComparison.movedFiles.length === 0 &&
                  rescanComparison.missingFiles.length === 0 && (
                    <div className={styles.rescanAllGood}>
                      ✓ Der Ordner ist bereits vollständig synchron.
                    </div>
                  )}
              </section>

              {rescanProgress && (
                <div className={styles.scanProgress}>
                  <div>
                    <span>
                      Schritt {rescanProgress.current} von {rescanProgress.total}
                    </span>
                    <strong>{rescanProgress.fileName}</strong>
                  </div>
                  <progress max={rescanProgress.total} value={rescanProgress.current} />
                </div>
              )}

              <div className={styles.rescanActions}>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={rescanApplying}
                  onClick={closeRescan}
                >
                  Abbrechen
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={rescanApplying}
                  onClick={() => void applyRescan()}
                >
                  {rescanApplying ? "Rescan wird übernommen …" : "Änderungen übernehmen"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {selectedProject && (
        <div className={styles.detailBackdrop} role="presentation">
          <section className={styles.detailPanel} role="dialog" aria-modal="true">
            <header className={styles.detailHeader}>
              <div>
                <span>{selectedProject.folder || "Druckprojekt"}</span>
                <h2>{selectedProject.name}</h2>
                <p>{selectedProject.description || "Keine Beschreibung vorhanden."}</p>
              </div>
              <button
                type="button"
                aria-label="Projekt schließen"
                onClick={() => {
                  setSelectedProject(null);
                  setProjectFiles([]);
                  setViewerFile(null);
                  setViewerUrl("");
                }}
              >
                ×
              </button>
            </header>

            <div className={styles.detailToolbar}>
              <input
                ref={uploadInputRef}
                className={styles.hiddenInput}
                type="file"
                multiple
                accept={PRINT_LIBRARY_ACCEPT}
                onChange={(event) => void uploadFiles(event)}
              />
              <input
                ref={versionInputRef}
                className={styles.hiddenInput}
                type="file"
                accept={versionTarget ? `.${versionTarget.file_type}` : PRINT_LIBRARY_ACCEPT}
                onChange={(event) => void uploadNewVersion(event)}
              />
              <button
                className="primary-button"
                type="button"
                disabled={uploading || migrationMissing}
                onClick={() => uploadInputRef.current?.click()}
              >
                {uploading ? "Upload läuft …" : "+ Dateien hochladen"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={uploading || migrationMissing}
                onClick={() => openScanner(selectedProject.id)}
              >
                Ordner in dieses Projekt scannen
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={
                  uploading ||
                  rescanChecking ||
                  rescanApplying ||
                  migrationMissing ||
                  viewerMigrationMissing
                }
                onClick={() => startRescan(selectedProject)}
              >
                {rescanChecking ? "Prüfe Ordner …" : "↻ Rescan"}
              </button>
              <span className={styles.lastScanLabel}>
                Zuletzt gescannt: {formatDateTime(selectedProject.last_scanned_at)}
              </span>
            </div>

            {viewerFile && viewerUrl && (
              <section className={styles.viewerSection}>
                <header className={styles.viewerHeader}>
                  <div>
                    <span>3D-VORSCHAU · V{viewerFile.version_number || 1}</span>
                    <h3>{viewerFile.file_name}</h3>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setViewerFile(null);
                      setViewerUrl("");
                      void loadProjects();
                    }}
                  >
                    Viewer schließen
                  </button>
                </header>
                <ModelViewer
                  sourceUrl={viewerUrl}
                  extension={viewerFile.file_type}
                  fileName={viewerFile.file_name}
                  initialMetadata={metadataFromFile(viewerFile)}
                  analyzeOnLoad={
                    !metadataFromFile(viewerFile) ||
                    !viewerFile.generated_preview_path
                  }
                  onAnalyzed={viewerMigrationMissing ? undefined : saveViewerAnalysis}
                />
                {viewerSaving && (
                  <p className={styles.viewerSaving}>Metadaten werden gespeichert …</p>
                )}
              </section>
            )}

            <div className={styles.fileList}>
              {projectFiles.length === 0 ? (
                <div className={styles.emptyState}>
                  Dieses Projekt enthält noch keine Dateien.
                </div>
              ) : (
                projectFiles.map((file) => {
                  const modelMetadata = metadataFromFile(file);
                  const canSetCover =
                    PREVIEW_IMAGE_EXTENSIONS.has(file.file_type) ||
                    Boolean(file.generated_preview_path);

                  return (
                    <article className={styles.fileRow} key={file.id}>
                      <div className={styles.fileIcon}>{file.file_type.toUpperCase()}</div>
                      <div className={styles.fileInfo}>
                        <div className={styles.fileTitleLine}>
                          <strong>{file.file_name}</strong>
                          <span className={styles.versionBadge}>V{file.version_number || 1}</span>
                        </div>
                        <span>
                          {fileKind(file)} · {formatBytes(file.size_bytes)} ·{" "}
                          {formatDate(file.created_at)}
                        </span>
                        {modelMetadata && (
                          <small>
                            {modelMetadata.widthMm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ×{" "}
                            {modelMetadata.depthMm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ×{" "}
                            {modelMetadata.heightMm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} mm ·{" "}
                            {modelMetadata.triangleCount.toLocaleString("de-DE")} Dreiecke
                          </small>
                        )}
                        {file.relative_path && file.relative_path !== file.file_name && (
                          <small title={file.relative_path}>
                            {file.relative_path}
                          </small>
                        )}
                        {file.source_missing && (
                          <small className={styles.missingFileBadge}>
                            ⚠ Beim letzten Rescan lokal nicht gefunden
                          </small>
                        )}
                      </div>
                      <div className={styles.fileActions}>
                        {isViewableModelExtension(file.file_type) && (
                          <>
                            <button
                              className="primary-button"
                              type="button"
                              onClick={() => void openModelViewer(file)}
                            >
                              3D öffnen
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              disabled={viewerMigrationMissing || uploading}
                              onClick={() => startNewVersion(file)}
                            >
                              Neue Version
                            </button>
                          </>
                        )}
                        {canSetCover && (
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => void setCover(file)}
                          >
                            Als Vorschau
                          </button>
                        )}
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => void downloadFile(file)}
                        >
                          Download
                        </button>
                        <button
                          className="delete-button"
                          type="button"
                          disabled={busy}
                          onClick={() => void deleteFile(file)}
                        >
                          Löschen
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
