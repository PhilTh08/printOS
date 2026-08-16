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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
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

  const categories = useMemo(() => {
    const values = new Set(logs.map((entry) => entry.category).filter(Boolean));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "de"));
  }, [logs]);

  const counts = useMemo(() => ({
    all: logs.length,
    failed: logs.filter((entry) => entry.status === "failed").length,
    pending: logs.filter((entry) => entry.status === "pending").length,
    admin: logs.filter((entry) => entry.source === "admin").length,
  }), [logs]);

  if (!adminRoleReady) return <div className={styles.state}>Adminberechtigung wird geprüft …</div>;
  if (!isAdmin) return <div className={styles.state}>Kein Adminzugriff.</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>V18.5 · SYSTEM LOG</span>
          <h1>Alles an einem Ort.</h1>
          <p>Adminaktionen, Releases, Wartung, Nutzeraktionen und Systemereignisse zentral nachvollziehen.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>↻ Aktualisieren</button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.stats}>
        <article><span>Geladen</span><strong>{counts.all}</strong><small>letzte Ereignisse</small></article>
        <article><span>Fehler</span><strong>{counts.failed}</strong><small>fehlgeschlagene Aktionen</small></article>
        <article><span>Offen</span><strong>{counts.pending}</strong><small>noch nicht abgeschlossen</small></article>
        <article><span>Admin</span><strong>{counts.admin}</strong><small>Adminaktionen</small></article>
      </section>

      <section className={styles.filters}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Aktion, Nutzer, Ziel oder Text suchen …" />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">Alle Kategorien</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Alle Status</option>
          <option value="success">Erfolgreich</option>
          <option value="failed">Fehlgeschlagen</option>
          <option value="pending">Offen</option>
        </select>
      </section>

      <section className={styles.logSection}>
        {loading ? (
          <div className={styles.state}>System-Log wird geladen …</div>
        ) : logs.length === 0 ? (
          <div className={styles.state}>Keine passenden Einträge.</div>
        ) : (
          <div className={styles.logList}>
            {logs.map((entry) => {
              const isOpen = expanded === entry.id;
              return (
                <article key={entry.id} className={styles.logRow}>
                  <button type="button" className={styles.logMain} onClick={() => setExpanded(isOpen ? null : entry.id)}>
                    <div className={styles.statusCol}>
                      <i data-status={entry.status} />
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                    <div className={styles.textCol}>
                      <div>
                        <span className={styles.category}>{entry.category}</span>
                        <code>{entry.action}</code>
                      </div>
                      <strong>{entry.message || entry.action}</strong>
                      <small>{entry.actor}{entry.target ? ` → ${entry.target}` : ""}</small>
                    </div>
                    <span className={styles.source}>{entry.source}</span>
                    <span className={styles.chevron}>{isOpen ? "⌃" : "⌄"}</span>
                  </button>

                  {isOpen && (
                    <div className={styles.details}>
                      <div><span>Status</span><strong>{entry.status}</strong></div>
                      <div><span>Quelle</span><strong>{entry.source}</strong></div>
                      <div><span>Akteur</span><strong>{entry.actor}</strong></div>
                      <div><span>Ziel</span><strong>{entry.target || "–"}</strong></div>
                      {entry.errorMessage && <div className={styles.errorDetail}><span>Fehler</span><strong>{entry.errorMessage}</strong></div>}
                      <pre>{JSON.stringify(entry.details ?? {}, null, 2)}</pre>
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
