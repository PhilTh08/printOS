"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

type Channel = "production" | "beta" | "public";

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
  channel: Channel;
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

const CHANNELS: Array<{
  id: Channel;
  label: string;
  eyebrow: string;
  description: string;
}> = [
  {
    id: "production",
    label: "Production",
    eyebrow: "STUFE 1",
    description: "Interner erster Stand. Beta-Tester bekommen diese Version noch nicht.",
  },
  {
    id: "beta",
    label: "Beta",
    eyebrow: "STUFE 2",
    description: "Nur für freigeschaltete Beta-Tester. Ideal für echten Praxistest.",
  },
  {
    id: "public",
    label: "Public",
    eyebrow: "STUFE 3",
    description: "Freigegebener Stand für alle normalen Nutzer.",
  },
];

function formatDate(value: string | null) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ReleaseCenterPage() {
  const { isAdmin, adminRoleReady, refreshReleaseInfo } = useHub();
  const [release, setRelease] = useState<ReleaseState | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [channel, setChannel] = useState<Channel>("production");
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
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(options?.headers ?? {}),
      },
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || "Anfrage fehlgeschlagen.");
    return result as T;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminFetch<{ release: ReleaseState; builds: Build[] }>(
        "/api/admin/release-center",
      );
      setRelease(result.release);
      setBuilds(result.builds);
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    if (!adminRoleReady || !isAdmin) return;
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Laden fehlgeschlagen."));
  }, [adminRoleReady, isAdmin, load]);

  const latestByChannel = useMemo(() => {
    const map = new Map<Channel, Build>();
    for (const build of builds) {
      if (!map.has(build.channel)) map.set(build.channel, build);
    }
    return map;
  }, [builds]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Bitte zuerst ein ZIP-Updatepaket auswählen.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = new FormData();
      data.set("file", file);
      data.set("version", version.trim());
      data.set("channel", channel);
      data.set("changelog", changelog.trim());

      const result = await adminFetch<{ branch: string; commitSha: string; fileCount: number }>(
        "/api/admin/release-center",
        { method: "POST", body: data },
      );

      setMessage(
        `${version} wurde als ${channel.toUpperCase()} hochgeladen · ${result.fileCount} Dateien · ${result.branch}`,
      );
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
    const text = action === "productionToBeta"
      ? "Production wirklich für deine Beta-Tester freigeben?"
      : "Beta wirklich als Public für alle normalen Nutzer freigeben?";
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
      setMessage(action === "productionToBeta" ? "Production wurde für Beta freigegeben." : "Beta wurde als Public veröffentlicht.");
      await Promise.all([load(), refreshReleaseInfo()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Freigabe fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  if (!adminRoleReady) return <div className={styles.state}>Adminberechtigung wird geprüft …</div>;
  if (!isAdmin) return <div className={styles.state}>Kein Adminzugriff.</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>V18.5 · RELEASE CENTER</span>
          <h1>Updates ohne Entpacken.</h1>
          <p>ZIP hochladen, Zielstufe wählen und den Release kontrolliert von Production über Beta bis Public bewegen.</p>
        </div>
        <div className={styles.flow}>PRODUCTION <b>→</b> BETA <b>→</b> PUBLIC</div>
      </header>

      {(message || error) && (
        <div className={error ? styles.error : styles.success}>{error || message}</div>
      )}

      <section className={styles.channelGrid}>
        {CHANNELS.map((item) => {
          const latest = latestByChannel.get(item.id);
          const activeVersion = item.id === "production"
            ? release?.production_version
            : item.id === "beta"
              ? release?.beta_version
              : release?.public_version;
          return (
            <article key={item.id} className={`${styles.channelCard} ${styles[item.id]}`}>
              <span>{item.eyebrow}</span>
              <h2>{item.label}</h2>
              <strong>{activeVersion || "Noch keine Version"}</strong>
              <p>{item.description}</p>
              {latest && <small>Letzter Upload {formatDate(latest.created_at)} · {latest.status}</small>}
            </article>
          );
        })}
      </section>

      <section className={styles.uploadSection}>
        <div className={styles.sectionIntro}>
          <span>UPDATE HOCHLADEN</span>
          <h2>Neue Version einspielen</h2>
          <p>Das Paket wird geprüft und in den passenden GitHub-Branch committed. Vercel kann daraus automatisch Preview- oder Production-Deployments bauen.</p>
        </div>

        <form className={styles.uploadForm} onSubmit={upload}>
          <div className={styles.channelChoice}>
            {CHANNELS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={channel === item.id ? styles.channelChoiceActive : ""}
                onClick={() => setChannel(item.id)}
              >
                <span>{item.eyebrow}</span>
                <strong>{item.label}</strong>
              </button>
            ))}
          </div>

          <div className={styles.formGrid}>
            <label>
              Version
              <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="18.5.0" />
            </label>
            <label className={styles.fileField}>
              ZIP-Updatepaket
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Noch keine Datei ausgewählt"}</span>
            </label>
            <label className={styles.fullField}>
              Changelog
              <textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="Was ist neu, was soll getestet werden?" />
            </label>
          </div>

          <button className={styles.uploadButton} type="submit" disabled={saving}>
            {saving ? "Update wird verarbeitet …" : `🚀 Als ${channel.toUpperCase()} hochladen`}
          </button>
        </form>
      </section>

      <section className={styles.promoteSection}>
        <div>
          <span>FREIGABEN</span>
          <h2>Version weitergeben</h2>
          <p>Kein erneuter Upload nötig. Du entscheidest, wann die nächste Zielgruppe Zugriff bekommt.</p>
        </div>
        <div className={styles.promoteActions}>
          <button disabled={saving || !release?.production_version} onClick={() => void promote("productionToBeta")}>
            Production → Beta
          </button>
          <button disabled={saving || !release?.beta_version} onClick={() => void promote("betaToPublic")}>
            Beta → Public
          </button>
        </div>
      </section>

      <section className={styles.historySection}>
        <div className={styles.sectionIntro}>
          <span>HISTORIE</span>
          <h2>Release-Verlauf</h2>
        </div>
        {loading ? (
          <div className={styles.state}>Releases werden geladen …</div>
        ) : builds.length === 0 ? (
          <div className={styles.state}>Noch keine V18.5-Uploads.</div>
        ) : (
          <div className={styles.buildList}>
            {builds.map((build) => (
              <article key={build.id}>
                <div className={styles.buildMain}>
                  <span className={`${styles.channelBadge} ${styles[build.channel]}`}>{build.channel}</span>
                  <div>
                    <strong>{build.version}</strong>
                    <small>{build.source_filename} · {build.file_count} Dateien · {formatDate(build.created_at)}</small>
                  </div>
                </div>
                <div className={styles.buildMeta}>
                  <span data-status={build.status}>{build.status}</span>
                  <code>{build.commit_sha ? build.commit_sha.slice(0, 8) : "—"}</code>
                </div>
                {build.changelog && <p>{build.changelog}</p>}
                {build.error_message && <p className={styles.buildError}>{build.error_message}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className={styles.setupNote}>
        <strong>Einmalige Server-Einrichtung</strong>
        <p>Für den automatischen GitHub-Push braucht Vercel die Environment Variable <code>GITHUB_RELEASE_TOKEN</code>. Die Datenbank benötigt außerdem einmal <code>supabase/release_center_v18_5.sql</code>.</p>
      </aside>
    </div>
  );
}
