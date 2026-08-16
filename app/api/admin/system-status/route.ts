import { NextRequest, NextResponse } from "next/server";

import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthLevel = "ok" | "warning" | "error";

type HealthItem = {
  id: string;
  label: string;
  level: HealthLevel;
  message: string;
  latencyMs: number | null;
  critical: boolean;
};

type VercelDeployment = {
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

function elapsed(started: number) {
  return Math.max(0, Date.now() - started);
}

function cleanError(error: unknown) {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

async function checkGithub(): Promise<HealthItem> {
  const token = process.env.GITHUB_RELEASE_TOKEN?.trim();
  const repo = process.env.GITHUB_RELEASE_REPO?.trim() || "PhilTh08/printOS";

  if (!token) {
    return {
      id: "github",
      label: "GitHub Release API",
      level: "warning",
      message: "GITHUB_RELEASE_TOKEN fehlt. Uploads und Release-Push sind eingeschränkt.",
      latencyMs: null,
      critical: false,
    };
  }

  const started = Date.now();
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        typeof body?.message === "string"
          ? `GitHub ${response.status}: ${body.message}`
          : `GitHub HTTP ${response.status}`,
      );
    }

    return {
      id: "github",
      label: "GitHub Release API",
      level: "ok",
      message: `${repo} erreichbar`,
      latencyMs: elapsed(started),
      critical: false,
    };
  } catch (error) {
    return {
      id: "github",
      label: "GitHub Release API",
      level: "warning",
      message: cleanError(error),
      latencyMs: elapsed(started),
      critical: false,
    };
  }
}

async function checkVercel(): Promise<{
  health: HealthItem;
  deployments: VercelDeployment[];
}> {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const projectRef =
    process.env.VERCEL_PROJECT_ID?.trim() ||
    process.env.VERCEL_PROJECT_NAME?.trim() ||
    "print-os";
  const teamId = process.env.VERCEL_TEAM_ID?.trim();

  if (!token) {
    return {
      health: {
        id: "vercel",
        label: "Vercel Deployment API",
        level: "warning",
        message: "VERCEL_API_TOKEN fehlt. Live-Deployments können noch nicht geladen werden.",
        latencyMs: null,
        critical: false,
      },
      deployments: [],
    };
  }

  const started = Date.now();
  const teamQuery = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

  try {
    const projectResponse = await fetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectRef)}${teamQuery}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );

    const projectBody = await projectResponse.json().catch(() => ({}));
    if (!projectResponse.ok) {
      throw new Error(
        typeof projectBody?.error?.message === "string"
          ? `Vercel: ${projectBody.error.message}`
          : `Vercel HTTP ${projectResponse.status}`,
      );
    }

    const projectId = String(projectBody.id || projectRef);
    const params = new URLSearchParams({ projectId, limit: "10" });
    if (teamId) params.set("teamId", teamId);

    const deploymentResponse = await fetch(
      `https://api.vercel.com/v6/deployments?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );

    const deploymentBody = await deploymentResponse.json().catch(() => ({}));
    if (!deploymentResponse.ok) {
      throw new Error(
        typeof deploymentBody?.error?.message === "string"
          ? `Vercel: ${deploymentBody.error.message}`
          : `Vercel HTTP ${deploymentResponse.status}`,
      );
    }

    const deployments = Array.isArray(deploymentBody.deployments)
      ? deploymentBody.deployments.map((entry: Record<string, unknown>) => {
          const meta =
            entry.meta && typeof entry.meta === "object"
              ? (entry.meta as Record<string, unknown>)
              : {};
          return {
            uid: String(entry.uid ?? entry.id ?? crypto.randomUUID()),
            name: String(entry.name ?? projectBody.name ?? "Deployment"),
            url: typeof entry.url === "string" ? entry.url : null,
            state: String(entry.state ?? entry.readyState ?? "UNKNOWN").toUpperCase(),
            target: typeof entry.target === "string" ? entry.target : null,
            createdAt: typeof entry.created === "number" ? entry.created : null,
            readyAt: typeof entry.ready === "number" ? entry.ready : null,
            source: typeof entry.source === "string" ? entry.source : null,
            branch:
              typeof meta.githubCommitRef === "string"
                ? meta.githubCommitRef
                : typeof meta.gitlabCommitRef === "string"
                  ? meta.gitlabCommitRef
                  : null,
            commitMessage:
              typeof meta.githubCommitMessage === "string"
                ? meta.githubCommitMessage
                : typeof meta.gitlabCommitMessage === "string"
                  ? meta.gitlabCommitMessage
                  : null,
          } satisfies VercelDeployment;
        })
      : [];

    const failed = deployments.filter((entry: VercelDeployment) =>
      ["ERROR", "CANCELED", "CANCELLED"].includes(entry.state),
    ).length;
    const running = deployments.filter((entry: VercelDeployment) =>
      ["BUILDING", "QUEUED", "INITIALIZING"].includes(entry.state),
    ).length;

    return {
      health: {
        id: "vercel",
        label: "Vercel Deployment API",
        level: failed > 0 ? "warning" : "ok",
        message:
          failed > 0
            ? `${failed} fehlgeschlagene Deployments in den letzten ${deployments.length} Einträgen`
            : running > 0
              ? `${running} Deployment(s) laufen gerade`
              : `${projectBody.name ?? projectRef} erreichbar · ${deployments.length} Deployments geladen`,
        latencyMs: elapsed(started),
        critical: false,
      },
      deployments,
    };
  } catch (error) {
    return {
      health: {
        id: "vercel",
        label: "Vercel Deployment API",
        level: "warning",
        message: cleanError(error),
        latencyMs: elapsed(started),
        critical: false,
      },
      deployments: [],
    };
  }
}

export async function GET(request: NextRequest) {
  const requestStarted = Date.now();

  try {
    const context = await requireAdmin(request);
    const items: HealthItem[] = [
      {
        id: "server",
        label: "Philamentix Server",
        level: "ok",
        message: "Admin-API antwortet und Adminberechtigung ist gültig.",
        latencyMs: elapsed(requestStarted),
        critical: true,
      },
    ];

    const dbStarted = Date.now();
    const { error: dbError } = await context.adminClient
      .from("user_roles")
      .select("user_id", { head: true, count: "exact" })
      .limit(1);
    items.push(
      dbError
        ? {
            id: "database",
            label: "Supabase Datenbank",
            level: "error",
            message: dbError.message,
            latencyMs: elapsed(dbStarted),
            critical: true,
          }
        : {
            id: "database",
            label: "Supabase Datenbank",
            level: "ok",
            message: "Datenbankverbindung aktiv",
            latencyMs: elapsed(dbStarted),
            critical: true,
          },
    );

    const releaseStarted = Date.now();
    const { error: releaseError } = await context.adminClient
      .from("release_builds")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    items.push(
      releaseError
        ? {
            id: "release-db",
            label: "Release Center Datenbank",
            level: "error",
            message: releaseError.message,
            latencyMs: elapsed(releaseStarted),
            critical: true,
          }
        : {
            id: "release-db",
            label: "Release Center Datenbank",
            level: "ok",
            message: "Release-Historie verfügbar",
            latencyMs: elapsed(releaseStarted),
            critical: true,
          },
    );

    const logStarted = Date.now();
    const { error: logError } = await context.adminClient
      .from("app_event_logs")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    items.push(
      logError
        ? {
            id: "system-log",
            label: "System-Log Datenbank",
            level: "error",
            message: logError.message,
            latencyMs: elapsed(logStarted),
            critical: true,
          }
        : {
            id: "system-log",
            label: "System-Log Datenbank",
            level: "ok",
            message: "Zentraler Event-Log erreichbar",
            latencyMs: elapsed(logStarted),
            critical: true,
          },
    );

    const [github, vercel] = await Promise.all([checkGithub(), checkVercel()]);
    items.push(github, vercel.health);

    const criticalError = items.some((item) => item.critical && item.level === "error");
    const anyProblem = items.some((item) => item.level !== "ok");
    const overall: HealthLevel = criticalError ? "error" : anyProblem ? "warning" : "ok";

    const problems = items
      .filter((item) => item.level !== "ok")
      .map((item) => ({
        id: item.id,
        label: item.label,
        level: item.level,
        message: item.message,
      }));

    return NextResponse.json({
      overall,
      checkedAt: new Date().toISOString(),
      durationMs: elapsed(requestStarted),
      items,
      problems,
      deployments: vercel.deployments,
      config: {
        vercelLive: Boolean(process.env.VERCEL_API_TOKEN?.trim()),
        githubLive: Boolean(process.env.GITHUB_RELEASE_TOKEN?.trim()),
      },
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
