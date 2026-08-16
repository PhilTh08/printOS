"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

type Level = "ok" | "warning" | "error";

type HealthItem = {
  id: string;
  label: string;
  level: Level;
  message: string;
  latencyMs: number | null;
  critical: boolean;
};

type Deployment = {
  uid: string;
  name: string;
  url: string | null;
  state: string;
  target: string | null;
  createdAt: number | null;
  readyAt: number | null;
  source: string | null;
  branch: string | null;
  commitMessage: string | null;
};

type StatusPayload = {
  overall: Level;
  checkedAt: string;
  durationMs: number;
  items: HealthItem[];
  problems: Array<{
    id: string;
    label: string;
    level: Level;
    message: string;
  }>;
  deployments: Deployment[];
  config: {
    vercelLive: boolean;
    githubLive: boolean;
  };
};

const REFRESH_MS = 10000;

function formatTime(value: string | null) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatDeploymentTime(value: number | null) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function deploymentLevel(state: string): Level {
  if (["READY"].includes(state)) return "ok";
  if (["ERROR", "CANCELED", "CANCELLED"].includes(state)) return "error";
  return "warning";
}

function overallCopy(level: Level) {
  if (level === "ok") {
    return {
      title: "Alle Systeme laufen",
      text: "Alle kritischen Dienste antworten aktuell ohne erkannten Fehler.",
    };
  }
  if (level === "warning") {
    return {
      title: "Eingeschränkter Betrieb",
      text: "Der Hub läuft, aber mindestens ein Dienst meldet eine Warnung oder einen Fehler.",
    };
  }
  return {
    title: "Störung erkannt",
    text: "Mindestens ein kritischer Dienst ist aktuell nicht verfügbar.",
  };
}

export default function SystemStatusPage() {
  const { isAdmin, adminRoleReady } = useHub();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [nextRefresh, setNextRefresh] = useState(REFRESH_MS / 1000);

  const loadStatus = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setRequestError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sitzung abgelaufen. Bitte neu anmelden.");

      const response = await fetch("/api/admin/system-status", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Systemstatus konnte nicht geladen werden.");
      }

      setStatus(payload as StatusPayload);
      setNextRefresh(REFRESH_MS / 1000);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Systemstatus konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!adminRoleReady || !isAdmin) return;
    void loadStatus();

    const refreshTimer = window.setInterval(() => {
      void loadStatus();
    }, REFRESH_MS);

    const countdownTimer = window.setInterval(() => {
      setNextRefresh((current) => (current <= 1 ? REFRESH_MS / 1000 : current - 1));
    }, 1000);

    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(countdownTimer);
    };
  }, [adminRoleReady, isAdmin, loadStatus]);

  const summary = useMemo(() => {
    const items = status?.items ?? [];
    return {
      ok: items.filter((item) => item.level === "ok").length,
      warning: items.filter((item) => item.level === "warning").length,
      error: items.filter((item) => item.level === "error").length,
    };
  }, [status]);

  if (!adminRoleReady) {
    return <div className={styles.state}>Adminberechtigung wird geprüft …</div>;
  }

  if (!isAdmin) {
    return <div className={styles.state}>Kein Adminzugriff.</div>;
  }

  const level = status?.overall ?? "warning";
  const copy = overallCopy(level);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>V18.5 · SYSTEMSTATUS</span>
          <h1>Alles auf einen Blick.</h1>
          <p>
            Live-Überwachung für Server, Supabase, Release Center, GitHub und Vercel.
            Die Ansicht aktualisiert sich automatisch alle 10 Sekunden.
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          disabled={refreshing}
          onClick={() => void loadStatus(true)}
        >
          {refreshing ? "Prüfung läuft …" : "Jetzt prüfen"}
        </button>
      </header>

      {requestError && <div className={styles.requestError}>{requestError}</div>}

      <section className={`${styles.overallCard} ${styles[level]}`}>
        <div className={styles.pulseWrap}>
          <span className={styles.pulse} />
        </div>
        <div className={styles.overallText}>
          <span>GESAMTSTATUS</span>
          <h2>{copy.title}</h2>
          <p>{copy.text}</p>
        </div>
        <div className={styles.liveMeta}>
          <strong>LIVE</strong>
          <span>Letzter Check {formatTime(status?.checkedAt ?? null)}</span>
          <span>Nächster Check in {nextRefresh}s</span>
          {status && <small>Prüfdauer {status.durationMs} ms</small>}
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <article>
          <span>OK</span>
          <strong>{summary.ok}</strong>
          <small>Dienste ohne Fehler</small>
        </article>
        <article>
          <span>WARNUNG</span>
          <strong>{summary.warning}</strong>
          <small>Eingeschränkt / prüfen</small>
        </article>
        <article>
          <span>STÖRUNG</span>
          <strong>{summary.error}</strong>
          <small>Kritische Fehler</small>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>LIVE CHECKS</span>
            <h2>Systemverbindungen</h2>
          </div>
          <small>{loading ? "Prüfung läuft …" : `${status?.items.length ?? 0} Prüfungen`}</small>
        </div>

        <div className={styles.healthGrid}>
          {(status?.items ?? []).map((item) => (
            <article key={item.id} className={`${styles.healthCard} ${styles[item.level]}`}>
              <div className={styles.healthTop}>
                <span className={styles.healthDot} />
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.critical ? "KRITISCH" : "ZUSATZDIENST"}</small>
                </div>
                <b>{item.level === "ok" ? "OK" : item.level === "warning" ? "FEHLER" : "AUSFALL"}</b>
              </div>
              <p>{item.message}</p>
              <footer>
                <span>{item.latencyMs === null ? "keine Messung" : `${item.latencyMs} ms`}</span>
              </footer>
            </article>
          ))}
        </div>
      </section>

      {(status?.problems.length ?? 0) > 0 && (
        <section className={styles.problemPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>FEHLERZENTRALE</span>
              <h2>{status?.problems.length} Problem(e) erkannt</h2>
            </div>
          </div>
          <div className={styles.problemList}>
            {status?.problems.map((problem) => (
              <article key={problem.id} className={styles[problem.level]}>
                <span className={styles.healthDot} />
                <div>
                  <strong>{problem.label}</strong>
                  <p>{problem.message}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>VERCEL LIVE</span>
            <h2>Deployments</h2>
            <p>
              Neue Builds, laufende Deployments und fehlgeschlagene Veröffentlichungen erscheinen hier automatisch.
            </p>
          </div>
          <small>{status?.config.vercelLive ? "API verbunden" : "Token fehlt"}</small>
        </div>

        {!status?.config.vercelLive ? (
          <div className={styles.setupHint}>
            Für Live-Deployments fehlt noch <code>VERCEL_API_TOKEN</code> in Vercel.
            Optional kannst du zusätzlich <code>VERCEL_PROJECT_ID</code> und <code>VERCEL_TEAM_ID</code> setzen.
          </div>
        ) : (status?.deployments.length ?? 0) === 0 ? (
          <div className={styles.state}>Keine Deployments gefunden.</div>
        ) : (
          <div className={styles.deployList}>
            {status?.deployments.map((deployment) => {
              const depLevel = deploymentLevel(deployment.state);
              return (
                <article key={deployment.uid}>
                  <span className={`${styles.deployStatus} ${styles[depLevel]}`}>
                    <i />
                    {deployment.state}
                  </span>
                  <div className={styles.deployMain}>
                    <strong>{deployment.commitMessage || deployment.name}</strong>
                    <small>
                      {deployment.branch || deployment.target || "ohne Branch"} · {formatDeploymentTime(deployment.createdAt)}
                    </small>
                  </div>
                  <div className={styles.deployMeta}>
                    <span>{deployment.target || "preview"}</span>
                    {deployment.url && (
                      <a
                        href={`https://${deployment.url}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Öffnen ↗
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
