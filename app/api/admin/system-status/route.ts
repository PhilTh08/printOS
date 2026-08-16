import { NextRequest, NextResponse } from "next/server";

import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthLevel = "ok" | "warning" | "error";
type Period = "24h" | "7d" | "30d";
type SimulationTarget = "database" | "release-db" | "system-log" | "github" | "vercel" | "all";
type HealthItem = { id: string; label: string; level: HealthLevel; message: string; latencyMs: number | null; critical: boolean };
type VercelDeployment = { uid: string; name: string; url: string | null; state: string; target: string | null; createdAt: number | null; readyAt: number | null; source: string | null; branch: string | null; commitMessage: string | null };
type StabilityItem = { id: string; label: string; uptime: number | null; avgLatencyMs: number | null; problems: number; samples: number; trend: HealthLevel[] };

const PERIOD_HOURS: Record<Period, number> = { "24h": 24, "7d": 168, "30d": 720 };
const SIMULATION_TARGETS = new Set<SimulationTarget>(["database", "release-db", "system-log", "github", "vercel", "all"]);

function elapsed(started: number) { return Math.max(0, Date.now() - started); }
function cleanError(error: unknown) { return error instanceof Error ? error.message : "Unbekannter Fehler"; }
function worstLevel(levels: HealthLevel[]): HealthLevel {
  if (levels.includes("error")) return "error";
  if (levels.includes("warning")) return "warning";
  return "ok";
}

async function checkGithub(): Promise<HealthItem> {
  const token = process.env.GITHUB_RELEASE_TOKEN?.trim();
  const repo = process.env.GITHUB_RELEASE_REPO?.trim() || "PhilTh08/printOS";
  if (!token) return { id: "github", label: "GitHub Release API", level: "warning", message: "GITHUB_RELEASE_TOKEN fehlt.", latencyMs: null, critical: false };
  const started = Date.now();
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    return { id: "github", label: "GitHub Release API", level: "ok", message: `${repo} erreichbar`, latencyMs: elapsed(started), critical: false };
  } catch (error) {
    return { id: "github", label: "GitHub Release API", level: "warning", message: cleanError(error), latencyMs: elapsed(started), critical: false };
  }
}

async function checkVercel(): Promise<{ health: HealthItem; deployments: VercelDeployment[] }> {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const projectRef = process.env.VERCEL_PROJECT_ID?.trim() || process.env.VERCEL_PROJECT_NAME?.trim() || "print-os";
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token) return { health: { id: "vercel", label: "Vercel Deployment API", level: "warning", message: "VERCEL_API_TOKEN fehlt.", latencyMs: null, critical: false }, deployments: [] };

  const started = Date.now();
  const teamQuery = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  try {
    const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectRef)}${teamQuery}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    const projectBody = await projectResponse.json().catch(() => ({}));
    if (!projectResponse.ok) throw new Error(projectBody?.error?.message || `Vercel HTTP ${projectResponse.status}`);
    const params = new URLSearchParams({ projectId: String(projectBody.id || projectRef), limit: "10" });
    if (teamId) params.set("teamId", teamId);
    const deploymentResponse = await fetch(`https://api.vercel.com/v6/deployments?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    const deploymentBody = await deploymentResponse.json().catch(() => ({}));
    if (!deploymentResponse.ok) throw new Error(deploymentBody?.error?.message || `Vercel HTTP ${deploymentResponse.status}`);

    const deployments: VercelDeployment[] = Array.isArray(deploymentBody.deployments) ? deploymentBody.deployments.map((entry: Record<string, unknown>) => {
      const meta = entry.meta && typeof entry.meta === "object" ? entry.meta as Record<string, unknown> : {};
      return {
        uid: String(entry.uid ?? entry.id ?? crypto.randomUUID()), name: String(entry.name ?? projectBody.name ?? "Deployment"), url: typeof entry.url === "string" ? entry.url : null,
        state: String(entry.state ?? entry.readyState ?? "UNKNOWN").toUpperCase(), target: typeof entry.target === "string" ? entry.target : null,
        createdAt: typeof entry.created === "number" ? entry.created : null, readyAt: typeof entry.ready === "number" ? entry.ready : null, source: typeof entry.source === "string" ? entry.source : null,
        branch: typeof meta.githubCommitRef === "string" ? meta.githubCommitRef : null, commitMessage: typeof meta.githubCommitMessage === "string" ? meta.githubCommitMessage : null,
      };
    }) : [];

    const latest = deployments[0] ?? null;
    const latestFailed = Boolean(latest && ["ERROR", "CANCELED", "CANCELLED"].includes(latest.state));
    const latestRunning = Boolean(latest && ["BUILDING", "QUEUED", "INITIALIZING"].includes(latest.state));

    return {
      health: {
        id: "vercel",
        label: "Vercel Deployment API",
        level: latestFailed ? "error" : "ok",
        message: latestFailed
          ? `Letztes Deployment fehlgeschlagen: ${latest?.commitMessage || latest?.branch || latest?.name || "unbekannt"}`
          : latestRunning
            ? `Deployment läuft gerade · wird nicht als Störung gewertet: ${latest?.commitMessage || latest?.branch || latest?.name || "unbekannt"}`
            : latest
              ? `Letztes Deployment ${latest.state} · ${latest.commitMessage || latest.branch || latest.name}`
              : `${projectBody.name ?? projectRef} erreichbar · keine Deployments gefunden`,
        latencyMs: elapsed(started),
        critical: false,
      },
      deployments,
    };
  } catch (error) {
    return { health: { id: "vercel", label: "Vercel Deployment API", level: "warning", message: cleanError(error), latencyMs: elapsed(started), critical: false }, deployments: [] };
  }
}

function applySimulation(items: HealthItem[], target: SimulationTarget | null) {
  if (!target) return items;
  return items.map((item) => {
    const selected = target === "all" ? true : item.id === target;
    if (!selected) return item;
    return {
      ...item,
      level: "error" as HealthLevel,
      message: `TESTMODUS: Ausfall von ${item.label} wurde serverseitig simuliert. Der echte Dienst wurde nicht abgeschaltet.`,
    };
  });
}

async function persistSamples(adminClient: any, items: HealthItem[]) {
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const keepSince = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const recent = await adminClient.from("system_health_samples").select("id").gte("checked_at", fifteenMinutesAgo).limit(1);
  if (recent.error) return false;
  if ((recent.data ?? []).length === 0) {
    const inserted = await adminClient.from("system_health_samples").insert(items.map((item) => ({ service_id: item.id, level: item.level, latency_ms: item.latencyMs, message: item.message.slice(0, 500), checked_at: now.toISOString() })));
    if (inserted.error) return false;
    void adminClient.from("system_health_samples").delete().lt("checked_at", keepSince);
  }
  return true;
}

async function loadStability(adminClient: any, items: HealthItem[], period: Period): Promise<{ available: boolean; period: Period; items: StabilityItem[] }> {
  const now = Date.now();
  const since = new Date(now - PERIOD_HOURS[period] * 60 * 60 * 1000).toISOString();
  const result: StabilityItem[] = [];

  for (const service of items) {
    const query = await adminClient.from("system_health_samples").select("level,latency_ms,checked_at").eq("service_id", service.id).gte("checked_at", since).order("checked_at", { ascending: true }).limit(3000);
    if (query.error) return { available: false, period, items: [] };
    const rows = query.data ?? [];
    const okCount = rows.filter((row: any) => row.level === "ok").length;
    const latencies: number[] = rows.map((row: any) => row.latency_ms).filter((value: unknown): value is number => typeof value === "number");
    const buckets: HealthLevel[][] = Array.from({ length: 18 }, () => []);
    const periodMs = PERIOD_HOURS[period] * 60 * 60 * 1000;
    for (const row of rows) {
      const position = Math.max(0, Math.min(17, Math.floor(((new Date(row.checked_at).getTime() - (now - periodMs)) / periodMs) * 18)));
      buckets[position].push(row.level as HealthLevel);
    }
    result.push({
      id: service.id,
      label: service.label,
      uptime: rows.length ? Math.round((okCount / rows.length) * 10000) / 100 : null,
      avgLatencyMs: latencies.length ? Math.round(latencies.reduce((sum: number, value: number) => sum + value, 0) / latencies.length) : null,
      problems: rows.filter((row: any) => row.level !== "ok").length,
      samples: rows.length,
      trend: buckets.map((levels) => levels.length ? worstLevel(levels) : "warning"),
    });
  }
  return { available: true, period, items: result };
}

export async function GET(request: NextRequest) {
  const requestStarted = Date.now();
  try {
    const context = await requireAdmin(request);
    const requestedPeriod = request.nextUrl.searchParams.get("period");
    const period: Period = requestedPeriod === "7d" || requestedPeriod === "30d" ? requestedPeriod : "24h";
    const includeHistory = request.nextUrl.searchParams.get("history") !== "0";
    const requestedSimulation = request.nextUrl.searchParams.get("simulate") as SimulationTarget | null;
    const simulation = requestedSimulation && SIMULATION_TARGETS.has(requestedSimulation) ? requestedSimulation : null;
    const items: HealthItem[] = [{ id: "server", label: "Philamentix Server", level: "ok", message: "Admin-API antwortet und Adminberechtigung ist gültig.", latencyMs: elapsed(requestStarted), critical: true }];

    const dbStarted = Date.now();
    const { error: dbError } = await context.adminClient.from("user_roles").select("user_id", { head: true, count: "exact" }).limit(1);
    items.push(dbError ? { id: "database", label: "Supabase Datenbank", level: "error", message: dbError.message, latencyMs: elapsed(dbStarted), critical: true } : { id: "database", label: "Supabase Datenbank", level: "ok", message: "Datenbankverbindung aktiv", latencyMs: elapsed(dbStarted), critical: true });

    const releaseStarted = Date.now();
    const { error: releaseError } = await context.adminClient.from("release_builds").select("id", { head: true, count: "exact" }).limit(1);
    items.push(releaseError ? { id: "release-db", label: "Release Center Datenbank", level: "error", message: releaseError.message, latencyMs: elapsed(releaseStarted), critical: true } : { id: "release-db", label: "Release Center Datenbank", level: "ok", message: "Release-Historie verfügbar", latencyMs: elapsed(releaseStarted), critical: true });

    const logStarted = Date.now();
    const { error: logError } = await context.adminClient.from("app_event_logs").select("id", { head: true, count: "exact" }).limit(1);
    items.push(logError ? { id: "system-log", label: "System-Log Datenbank", level: "error", message: logError.message, latencyMs: elapsed(logStarted), critical: true } : { id: "system-log", label: "System-Log Datenbank", level: "ok", message: "Zentraler Event-Log erreichbar", latencyMs: elapsed(logStarted), critical: true });

    const [github, vercel] = await Promise.all([checkGithub(), checkVercel()]);
    items.push(github, vercel.health);

    const realItems = items.map((item) => ({ ...item }));
    const displayItems = applySimulation(items, simulation);

    const historyAvailable = await persistSamples(context.adminClient, realItems);
    const stability = includeHistory && historyAvailable ? await loadStability(context.adminClient, realItems, period) : { available: historyAvailable, period, items: [] as StabilityItem[] };

    const criticalError = displayItems.some((item) => item.critical && item.level === "error");
    const anyProblem = displayItems.some((item) => item.level !== "ok");
    const overall: HealthLevel = criticalError ? "error" : anyProblem ? "warning" : "ok";
    const problems = displayItems.filter((item) => item.level !== "ok").map((item) => ({ id: item.id, label: item.label, level: item.level, message: item.message }));

    return NextResponse.json({
      overall,
      checkedAt: new Date().toISOString(),
      durationMs: elapsed(requestStarted),
      items: displayItems,
      problems,
      deployments: vercel.deployments,
      stability,
      simulation,
      config: { vercelLive: Boolean(process.env.VERCEL_API_TOKEN?.trim()), githubLive: Boolean(process.env.GITHUB_RELEASE_TOKEN?.trim()) },
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
