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
import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

const STORAGE_BUCKET = "print-library";
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  "stl",
  "3mf",
  "obj",
  "gcode",
  "bgcode",
  "step",
  "stp",
  "zip",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "pdf",
  "txt",
  "md",
]);
const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
]);

type PrintProjectRow = {
  id: string;
  user_id: string;
  name: string;
  folder: string;
  description: string;
  tags: string[];
  favorite: boolean;
  cover_path: string | null;
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
  return ["42P01", "PGRST204", "PGRST205"].includes(
    errorCode(error),
  );
}

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) ?? "" : "";
}

function safeFileName(fileName: string): string {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return normalized.slice(0, 180) || "datei";
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
  const type = file.file_type.toUpperCase();

  if (IMAGE_EXTENSIONS.has(file.file_type)) {
    return "Bild";
  }

  if (["stl", "3mf", "obj", "step", "stp"].includes(file.file_type)) {
    return "3D-Modell";
  }

  if (["gcode", "bgcode"].includes(file.file_type)) {
    return "Druckdatei";
  }

  if (file.file_type === "zip") {
    return "Archiv";
  }

  return type || "Datei";
}

export default function PrintLibraryPage() {
  const { user } = useHub();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const clearFeedback = useCallback(() => {
    setMessage("");
    setError("");
  }, []);

  const loadProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const [projectResult, fileResult] = await Promise.all([
      supabase
        .from("print_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("print_project_files")
        .select("project_id,size_bytes")
        .eq("user_id", user.id),
    ]);

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

    if (fileResult.error && !isSetupMissing(fileResult.error)) {
      setError(fileResult.error.message);
      setLoading(false);
      return;
    }

    const countByProject = new Map<string, { count: number; size: number }>();
    for (const file of fileResult.data ?? []) {
      const current = countByProject.get(file.project_id) ?? {
        count: 0,
        size: 0,
      };
      current.count += 1;
      current.size += Number(file.size_bytes) || 0;
      countByProject.set(file.project_id, current);
    }

    const rows = (projectResult.data ?? []) as PrintProjectRow[];
    const coverPaths = rows
      .map((row) => row.cover_path)
      .filter((value): value is string => Boolean(value));
    const signedByPath = new Map<string, string>();

    if (coverPaths.length > 0) {
      const signedResult = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrls(coverPaths, 60 * 60);

      for (const signed of signedResult.data ?? []) {
        if (signed.path && signed.signedUrl) {
          signedByPath.set(signed.path, signed.signedUrl);
        }
      }
    }

    const mapped = rows.map((row) => {
      const count = countByProject.get(row.id);
      return {
        ...row,
        fileCount: count?.count ?? 0,
        totalSize: count?.size ?? 0,
        coverUrl: row.cover_path
          ? signedByPath.get(row.cover_path) ?? null
          : null,
      };
    });

    setSetupMissing(false);
    setProjects(mapped);
    setSelectedProject((current) =>
      current
        ? mapped.find((project) => project.id === current.id) ?? null
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

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!user || !selectedProject || files.length === 0) {
      return;
    }

    clearFeedback();
    const invalidFile = files.find((file) => {
      const extension = extensionOf(file.name);
      return !ALLOWED_EXTENSIONS.has(extension) || file.size > MAX_FILE_SIZE;
    });

    if (invalidFile) {
      const extension = extensionOf(invalidFile.name);
      setError(
        invalidFile.size > MAX_FILE_SIZE
          ? `„${invalidFile.name}“ ist größer als 100 MB.`
          : `Der Dateityp .${extension || "?"} wird noch nicht unterstützt.`,
      );
      return;
    }

    setUploading(true);
    const uploadedPaths: string[] = [];

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

        const isImage = IMAGE_EXTENSIONS.has(extension);
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
          });

        if (metadataResult.error) {
          throw metadataResult.error;
        }

        if (isImage && !selectedProject.cover_path) {
          const coverResult = await supabase
            .from("print_projects")
            .update({ cover_path: storagePath })
            .eq("id", selectedProject.id)
            .eq("user_id", user.id);

          if (coverResult.error) {
            throw coverResult.error;
          }
          selectedProject.cover_path = storagePath;
        }
      }

      setMessage(`${files.length} Datei${files.length === 1 ? "" : "en"} hochgeladen.`);
      await loadProjects();
      await loadProjectFiles(selectedProject);
    } catch (caughtError) {
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
    if (!user || !selectedProject || !IMAGE_EXTENSIONS.has(file.file_type)) {
      return;
    }

    const result = await supabase
      .from("print_projects")
      .update({ cover_path: file.storage_path })
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

    const storageResult = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([file.storage_path]);

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

    if (selectedProject.cover_path === file.storage_path) {
      const nextCover = projectFiles.find(
        (entry) => entry.id !== file.id && IMAGE_EXTENSIONS.has(entry.file_type),
      );
      await supabase
        .from("print_projects")
        .update({ cover_path: nextCover?.storage_path ?? null })
        .eq("id", selectedProject.id)
        .eq("user_id", user.id);
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
    const filesResult = await supabase
      .from("print_project_files")
      .select("storage_path")
      .eq("project_id", project.id)
      .eq("user_id", user.id);

    if (filesResult.error) {
      setError(filesResult.error.message);
      setBusy(false);
      return;
    }

    const paths = (filesResult.data ?? []).map((file) => file.storage_path);
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
                accept=".stl,.3mf,.obj,.gcode,.bgcode,.step,.stp,.zip,.png,.jpg,.jpeg,.webp,.pdf,.txt,.md"
                onChange={(event) => void uploadFiles(event)}
              />
              <button
                className="primary-button"
                type="button"
                disabled={uploading}
                onClick={() => uploadInputRef.current?.click()}
              >
                {uploading ? "Upload läuft …" : "+ Dateien hochladen"}
              </button>
              <span>Maximal 100 MB pro Datei</span>
            </div>

            <div className={styles.fileList}>
              {projectFiles.length === 0 ? (
                <div className={styles.emptyState}>
                  Dieses Projekt enthält noch keine Dateien.
                </div>
              ) : (
                projectFiles.map((file) => (
                  <article className={styles.fileRow} key={file.id}>
                    <div className={styles.fileIcon}>{file.file_type.toUpperCase()}</div>
                    <div className={styles.fileInfo}>
                      <strong>{file.file_name}</strong>
                      <span>
                        {fileKind(file)} · {formatBytes(file.size_bytes)} ·{" "}
                        {formatDate(file.created_at)}
                      </span>
                    </div>
                    <div className={styles.fileActions}>
                      {IMAGE_EXTENSIONS.has(file.file_type) && (
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
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
