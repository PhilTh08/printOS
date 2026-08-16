"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

type InternalChannel = "production" | "beta" | "public";
type ReleaseChannel = "development" | "beta" | "production";
type ReleaseTab = "overview" | "updates" | "promotions" | "history";
type HealthLevel = "ok" | "warning" | "down";

type ReleaseState = {
  production_channel?: string;
  production_version?: string;
  production_release_enabled?: boolean;
  beta_channel: string;
  beta_version: string;
  beta_release_enabled: boolean;
  public_channel: string;
  public_version: string;
};

type Build = {
  id: string;
  version: string;
  channel: InternalChannel;
  changelog: string;
  source_filename: string;
  file_count: number;
  commit_sha: string | null;
  git_branch: string | null;
  status: "uploaded" | "pushing" | "pushed" | "failed";
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

type HealthCheck = { id: string; label: string; ok: boolean; detail: string };
type ReleaseHealth = { level: HealthLevel; summary: string; checks: HealthCheck[]; checkedAt: string };

type ChannelDefinition = {
  id: ReleaseChannel;
  internal: InternalChannel;
  label: string;
  eyebrow: string;
  description: string;
  style: "development" | "beta" | "stable";
};

const CHANNELS: ChannelDefinition[] = [
  {
    id: "development",
    internal: "production",
    label: "Development",
    eyebrow: "STUFE 1",
    description: "Interner Entwicklungsstand. Nur für Admins und interne Tests, noch nicht für Beta-Tester.",
    style: "development",
  },
  {
    id: "beta",
    internal: "beta",
    label: "Beta",
    eyebrow: "STUFE 2",
    description: "Freigabe für Beta-Tester. Hier wird der neue Stand im echten Workflow getestet.",
    style: "beta",
  },
  {
    id: "production",
    internal: "public",
    label: "Production",
    eyebrow: "STUFE 3",
    description: "Stabile Live-Version für alle normalen Nutzer.",
    style: "stable",
  },
];

const TABS: Array<{ id: ReleaseTab; label: string }> = [
  { id: "overview", label: "Übersicht" },
  { id: "updates", label: "Updates" },
  { id: "promotions", label: "Freigaben" },
  { id: "history", label: "Historie" },
];

function formatDate(value: string | null) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function healthLabel(level: HealthLevel) {
  if (level === "ok") return "SYSTEM OK";
  if (level === "warning") return "FEHLER / WARNUNG";
  return "SYSTEM NICHT BEREIT";
}

function labelForInternalChannel(channel: InternalChannel) {
  return CHANNELS.find((item) => item.internal === channel)?.label ?? channel;
}

function styleForInternalChannel(channel: InternalChannel) {
  return CHANNELS.find((item) => item.internal === channel)?.style ?? "development";
}

export default function ReleasePage() {
  const { isAdmin, adminRoleReady, refreshReleaseInfo } = useHub();
  const [release, setRelease] = useState<ReleaseState | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [health, setHealth] = useState<ReleaseHealth | null>(null);
  const [tab, setTab] = useState<ReleaseTab>("overview");
  const [channel, setChannel] = useState<ReleaseChannel>("development");
  const [version, setVersion] = useState("18.5");
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const adminFetch = useCallback(async <T,>(path: string, options?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sitzung abgelaufen. Bitte neu anmelden.");
    const response = await fetch(path, {
      ...options,
      cache: "no-store",
      headers: { Authorization: `Bearer ${session.access_token}`, ...(options?.headers ?? {}) },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || "Anfrage fehlgeschlagen.");
    return result as T;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminFetch<{ release: ReleaseState; builds: Build[]; health: ReleaseHealth }>("/api/admin/release-center");
      setRelease(result.release);
      setBuilds(result.builds);
      setHealth(result.health);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Release-Bereich nicht erreichbar.";
      setHealth({
        level: "down",
        summary: "Release-Bereich konnte nicht vollständig geladen werden.",
        checkedAt: new Date().toISOString(),
        checks: [{ id: "backend", label: "Release Backend", ok: false, detail }],
      });
      throw caught;
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    if (!adminRoleReady || !isAdmin) return;
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Laden fehlgeschlagen."));
  }, [adminRoleReady, isAdmin, load]);

  useEffect(() => {
    if (!adminRoleReady || !isAdmin) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [adminRoleReady, isAdmin, load]);

  const latestByInternalChannel = useMemo(() => {
    const map = new Map<InternalChannel, Build>();
    for (const build of builds) if (!map.has(build.channel)) map.set(build.channel, build);
    return map;
  }, [builds]);

  function activeVersion(item: ChannelDefinition) {
    if (item.id === "development") return release?.production_version;
    if (item.id === "beta") return release?.beta_version;
    return release?.public_version;
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Bitte zuerst ein ZIP-Updatepaket auswählen.");
      return;
    }

    const definition = CHANNELS.find((item) => item.id === channel)!;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("version", version.trim());
      data.set("channel", definition.internal);
      data.set("changelog", changelog.trim());
      const result = await adminFetch<{ branch: string; commitSha: string; fileCount: number }>("/api/admin/release-center", { method: "POST", body: data });
      setMessage(`${version} wurde als ${definition.label} hochgeladen · ${result.fileCount} Dateien · ${result.branch}`);
      setFile(null);
      setChangelog("");
      await Promise.all([load(), refreshReleaseInfo()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function promote(action: "productionToBeta" | "betaToPublic") {
    const developmentToBeta = action === "productionToBeta";
    const text = developmentToBeta
      ? "Development-Version wirklich für deine Beta-Tester freigeben?"
      : "Beta-Version wirklich als Production für alle Nutzer freigeben?";
    if (!window.confirm(text)) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await adminFetch("/api/admin/release-center", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setMessage(developmentToBeta ? "Development wurde für Beta freigegeben." : "Beta wurde als Production veröffentlicht.");
      await Promise.all([load(), refreshReleaseInfo()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Freigabe fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  if (!adminRoleReady) return <div className={styles.state}>Adminberechtigung wird geprüft …</div>;
  if (!isAdmin) return <div className={styles.state}>Kein Adminzugriff.</div>;

  const healthLevel = health?.level ?? "warning";

  return (
    <div className={styles.page}>
      <section className={`${styles.systemStatus} ${styles[`systemStatus_${healthLevel}`]}`}>
        <div className={styles.statusPulseWrap}><span className={styles.statusPulse} /><span className={styles.statusPulseRing} /></div>
        <div className={styles.statusMain}>
          <div className={styles.statusTopline}><strong>{healthLabel(healthLevel)}</strong><span>{health ? `Geprüft ${formatDate(health.checkedAt)}` : "Prüfung läuft …"}</span></div>
          <p>{health?.summary ?? "Systemstatus wird geprüft …"}</p>
          {health && <div className={styles.statusChecks}>{health.checks.map((check) => <span key={check.id} data-ok={check.ok ? "true" : "false"} title={check.detail}><i />{check.label}</span>)}</div>}
        </div>
        <button type="button" className={styles.statusRefresh} onClick={() => void load()} disabled={loading}>{loading ? "Prüfe …" : "Neu prüfen"}</button>
      </section>

      <header className={styles.header}>
        <div>
          <span>V18.5 · RELEASE</span>
          <h1>Release-Verwaltung</h1>
          <p>Versionen einspielen, testen und kontrolliert von Development über Beta bis Production freigeben.</p>
        </div>
        <div className={styles.flow}>DEVELOPMENT <b>→</b> BETA <b>→</b> PRODUCTION</div>
      </header>

      <nav className={styles.releaseTabs} aria-label="Release Bereiche">
        {TABS.map((item) => <button key={item.id} type="button" className={tab === item.id ? styles.releaseTabActive : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </nav>

      {(message || error) && <div className={error ? styles.error : styles.success}>{error || message}</div>}

      {tab === "overview" && (
        <section className={styles.channelGrid}>
          {CHANNELS.map((item) => {
            const latest = latestByInternalChannel.get(item.internal);
            return <article key={item.id} className={`${styles.channelCard} ${styles[item.style]}`}>
              <span>{item.eyebrow}</span><h2>{item.label}</h2><strong>{activeVersion(item) || "Noch keine Version"}</strong><p>{item.description}</p>
              {latest && <small>Letzter Upload {formatDate(latest.created_at)} · {latest.status}</small>}
            </article>;
          })}
        </section>
      )}

      {tab === "updates" && (
        <section className={styles.uploadSection}>
          <div className={styles.sectionIntro}><span>UPDATE HOCHLADEN</span><h2>Neue Version einspielen</h2><p>Wähle die Zielstufe. Die bestehende Datenstruktur bleibt kompatibel, der sichtbare Workflow ist Development → Beta → Production.</p></div>
          <form className={styles.uploadForm} onSubmit={upload}>
            <div className={styles.channelChoice}>
              {CHANNELS.map((item) => <button type="button" key={item.id} className={channel === item.id ? styles.channelChoiceActive : ""} onClick={() => setChannel(item.id)}><span>{item.eyebrow}</span><strong>{item.label}</strong></button>)}
            </div>
            <div className={styles.formGrid}>
              <label>Version<input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="18.5.1" /></label>
              <label className={styles.fileField}>ZIP-Updatepaket<input type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><span>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Noch keine Datei ausgewählt"}</span></label>
              <label className={styles.fullField}>Changelog<textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="Was ist neu, was soll getestet werden?" /></label>
            </div>
            <button className={styles.uploadButton} type="submit" disabled={saving}>{saving ? "Update wird verarbeitet …" : `Als ${CHANNELS.find((item) => item.id === channel)?.label} hochladen`}</button>
          </form>
        </section>
      )}

      {tab === "promotions" && (
        <section className={styles.promoteSection}>
          <div><span>FREIGABEN</span><h2>Version weitergeben</h2><p>Eine Version wird ohne erneuten Upload in die nächste Stufe übernommen.</p></div>
          <div className={styles.promoteActions}>
            <button disabled={saving || !release?.production_version} onClick={() => void promote("productionToBeta")}>Development → Beta</button>
            <button disabled={saving || !release?.beta_version} onClick={() => void promote("betaToPublic")}>Beta → Production</button>
          </div>
        </section>
      )}

      {tab === "history" && (
        <section className={styles.historySection}>
          <div className={styles.sectionIntro}><span>HISTORIE</span><h2>Release-Verlauf</h2><p>Alle bisherigen Uploads bleiben erhalten und werden mit den neuen Kanalnamen dargestellt.</p></div>
          {loading ? <div className={styles.state}>Releases werden geladen …</div> : builds.length === 0 ? <div className={styles.state}>Noch keine Uploads.</div> : (
            <div className={styles.buildList}>{builds.map((build) => {
              const styleKey = styleForInternalChannel(build.channel);
              return <article key={build.id}>
                <div className={styles.buildMain}><span className={`${styles.channelBadge} ${styles[styleKey]}`}>{labelForInternalChannel(build.channel)}</span><div><strong>{build.version}</strong><small>{build.source_filename} · {build.file_count} Dateien · {formatDate(build.created_at)}</small></div></div>
                <div className={styles.buildMeta}><span data-status={build.status}>{build.status}</span><code>{build.commit_sha ? build.commit_sha.slice(0, 8) : "—"}</code></div>
                {build.changelog && <p>{build.changelog}</p>}{build.error_message && <p className={styles.buildError}>{build.error_message}</p>}
              </article>;
            })}</div>
          )}
        </section>
      )}
    </div>
  );
}
