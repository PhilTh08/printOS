"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

type LogEntry = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  category: string;
  source: "admin" | "app";
  action: string;
  message: string;
  status: "pending" | "success" | "failed";
  actor: string;
  target: string | null;
  details: Record<string, unknown>;
  errorMessage: string | null;
};

type DetailChange = { label: string; before: string; after: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function humanize(value: string) {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function findObject(details: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = details[name];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return null;
}

function extractChanges(details: Record<string, unknown>): DetailChange[] {
  const before = findObject(details, ["before", "old", "previous", "from"]);
  const after = findObject(details, ["after", "new", "next", "to"]);

  if (before || after) {
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    return Array.from(keys)
      .filter((key) => displayValue(before?.[key]) !== displayValue(after?.[key]))
      .slice(0, 12)
      .map((key) => ({ label: humanize(key), before: displayValue(before?.[key]), after: displayValue(after?.[key]) }));
  }

  const pairs: Array<[string, string, string]> = [
    ["oldRole", "newRole", "Rolle"],
    ["previousRole", "role", "Rolle"],
    ["oldValue", "newValue", "Wert"],
    ["previousValue", "value", "Wert"],
    ["oldWeight", "newWeight", "Gewicht"],
    ["weightBefore", "weightAfter", "Gewicht"],
    ["oldStatus", "newStatus", "Status"],
    ["previousStatus", "status", "Status"],
    ["oldVisibility", "newVisibility", "Sichtbarkeit"],
  ];

  return pairs
    .filter(([from, to]) => from in details && to in details && displayValue(details[from]) !== displayValue(details[to]))
    .map(([from, to, label]) => ({ label, before: displayValue(details[from]), after: displayValue(details[to]) }));
}

function buildDescription(entry: LogEntry) {
  if (entry.errorMessage) return `${humanize(entry.action)} ist fehlgeschlagen: ${entry.errorMessage}`;

  const changes = extractChanges(entry.details ?? {});
  if (changes.length === 1) {
    const change = changes[0];
    return `${change.label} wurde von „${change.before}“ auf „${change.after}“ geändert${entry.target ? ` (${entry.target})` : ""}.`;
  }
  if (changes.length > 1) {
    return `${changes.length} Werte wurden geändert${entry.target ? ` bei ${entry.target}` : ""}.`;
  }

  if (entry.message?.trim()) return entry.message.trim();

  const action = entry.action.toLowerCase();
  if (action.includes("delete") || action.includes("remove")) return `${entry.target || "Eintrag"} wurde entfernt.`;
  if (action.includes("create") || action.includes("add")) return `${entry.target || "Eintrag"} wurde erstellt.`;
  if (action.includes("upload")) return `${entry.target || "Datei/Release"} wurde hochgeladen.`;
  if (action.includes("deploy")) return `Deployment${entry.target ? ` für ${entry.target}` : ""} wurde gestartet.`;
  if (action.includes("login")) return `${entry.actor} hat sich angemeldet.`;
  if (action.includes("view") || action.includes("read")) return `${entry.actor} hat ${entry.target || humanize(entry.category)} geöffnet.`;
  if (action.includes("update") || action.includes("change") || action.includes("edit")) return `${entry.target || "Eintrag"} wurde geändert.`;
  return humanize(entry.action);
}

function csvCell(value: unknown) {
  const text = displayValue(value).replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AdminLogsPage() {
  const { isAdmin, adminRoleReady } = useHub();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sitzung abgelaufen. Bitte neu anmelden.");

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "all") params.set("category", category);
    if (status !== "all") params.set("status", status);

    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/system-logs?${params.toString()}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || "Logs konnten nicht geladen werden.");
    setLogs(result.logs ?? []);
    setLoading(false);
  }, [category, query, status]);

  useEffect(() => {
    if (!adminRoleReady || !isAdmin) return;
    const timer = window.setTimeout(() => {
      void load().catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Logs konnten nicht geladen werden.");
        setLoading(false);
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [adminRoleReady, isAdmin, load]);

  const categories = useMemo(() => Array.from(new Set(logs.map((entry) => entry.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "de")), [logs]);
  const counts = useMemo(() => ({
    all: logs.length,
    failed: logs.filter((entry) => entry.status === "failed").length,
    pending: logs.filter((entry) => entry.status === "pending").length,
    admin: logs.filter((entry) => entry.source === "admin").length,
  }), [logs]);

  function exportCsv() {
    const header = ["Zeitpunkt", "Status", "Kategorie", "Aktion", "Beschreibung", "Akteur", "Ziel", "Quelle", "Fehler", "Details"];
    const rows = logs.map((entry) => [
      formatDate(entry.createdAt), entry.status, entry.category, entry.action, buildDescription(entry), entry.actor,
      entry.target ?? "", entry.source, entry.errorMessage ?? "", JSON.stringify(entry.details ?? {}),
    ]);
    const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    downloadText(`philamentix-systemlog-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
  }

  function exportJson() {
    const payload = logs.map((entry) => ({ ...entry, description: buildDescription(entry), changes: extractChanges(entry.details ?? {}) }));
    downloadText(`philamentix-systemlog-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  }

  if (!adminRoleReady) return <div className={styles.state}>Adminberechtigung wird geprüft …</div>;
  if (!isAdmin) return <div className={styles.state}>Kein Adminzugriff.</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>V18.5 · SYSTEM LOG</span>
          <h1>Alles an einem Ort.</h1>
          <p>Nachvollziehbare Änderungen, Aktionen und Fehler – verständlich aufbereitet und exportierbar.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={exportCsv} disabled={loading || logs.length === 0}>CSV Export</button>
          <button type="button" onClick={exportJson} disabled={loading || logs.length === 0}>JSON Export</button>
          <button type="button" onClick={() => void load()} disabled={loading}>↻ Aktualisieren</button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.stats}>
        <article><span>Geladen</span><strong>{counts.all}</strong><small>gefilterte Ereignisse</small></article>
        <article><span>Fehler</span><strong>{counts.failed}</strong><small>fehlgeschlagene Aktionen</small></article>
        <article><span>Offen</span><strong>{counts.pending}</strong><small>noch nicht abgeschlossen</small></article>
        <article><span>Admin</span><strong>{counts.admin}</strong><small>Adminaktionen</small></article>
      </section>

      <section className={styles.filters}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Aktion, Nutzer, Ziel oder Text suchen …" />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">Alle Kategorien</option>
          {categories.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Alle Status</option>
          <option value="success">Erfolgreich</option>
          <option value="failed">Fehlgeschlagen</option>
          <option value="pending">Offen</option>
        </select>
      </section>

      <section className={styles.logSection}>
        {loading ? <div className={styles.state}>System-Log wird geladen …</div> : logs.length === 0 ? <div className={styles.state}>Keine passenden Einträge.</div> : (
          <div className={styles.logList}>
            {logs.map((entry) => {
              const isOpen = expanded === entry.id;
              const changes = extractChanges(entry.details ?? {});
              const description = buildDescription(entry);
              return (
                <article key={entry.id} className={styles.logRow}>
                  <button type="button" className={styles.logMain} onClick={() => setExpanded(isOpen ? null : entry.id)}>
                    <div className={styles.statusCol}><i data-status={entry.status} /><span>{formatDate(entry.createdAt)}</span></div>
                    <div className={styles.textCol}>
                      <div><span className={styles.category}>{humanize(entry.category)}</span><code>{humanize(entry.action)}</code></div>
                      <strong>{description}</strong>
                      <small><b>{entry.actor}</b>{entry.target ? ` → ${entry.target}` : ""}</small>
                    </div>
                    <span className={styles.source}>{entry.source === "admin" ? "Admin" : "App"}</span>
                    <span className={styles.chevron}>{isOpen ? "⌃" : "⌄"}</span>
                  </button>

                  {isOpen && (
                    <div className={styles.details}>
                      <div><span>Status</span><strong>{entry.status === "success" ? "Erfolgreich" : entry.status === "failed" ? "Fehlgeschlagen" : "Offen"}</strong></div>
                      <div><span>Akteur</span><strong>{entry.actor}</strong></div>
                      <div><span>Ziel</span><strong>{entry.target || "–"}</strong></div>
                      <div><span>Aktion</span><strong>{humanize(entry.action)}</strong></div>

                      <div className={styles.descriptionDetail}><span>Was ist passiert?</span><strong>{description}</strong></div>

                      {changes.length > 0 && (
                        <div className={styles.changesBlock}>
                          <span>Geänderte Werte</span>
                          <div className={styles.changeList}>
                            {changes.map((change, index) => (
                              <div key={`${change.label}-${index}`}>
                                <b>{change.label}</b>
                                <del>{change.before}</del>
                                <i>→</i>
                                <ins>{change.after}</ins>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {entry.errorMessage && <div className={styles.errorDetail}><span>Fehler</span><strong>{entry.errorMessage}</strong></div>}
                      <details className={styles.rawDetails}><summary>Technische Details anzeigen</summary><pre>{JSON.stringify(entry.details ?? {}, null, 2)}</pre></details>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
