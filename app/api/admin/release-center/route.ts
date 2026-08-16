import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

import {
  adminErrorResponse,
  AdminApiError,
  beginAdminAction,
  finishAdminAction,
  requireAdmin,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO = process.env.GITHUB_RELEASE_REPO || "PhilTh08/printOS";
const API = "https://api.github.com";
const MAX_ZIP_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 200;

const CHANNEL_BRANCH: Record<string, string> = {
  production: "release/production",
  beta: "release/beta",
  public: "main",
};

function githubToken() {
  const token = process.env.GITHUB_RELEASE_TOKEN?.trim();
  if (!token) {
    throw new AdminApiError(
      503,
      "GitHub Release Token fehlt. Lege GITHUB_RELEASE_TOKEN in Vercel an.",
    );
  }
  return token;
}

async function gh(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? `GitHub: ${body.message}`
        : `GitHub HTTP ${response.status}`,
    );
  }
  return body;
}

async function ensureBranch(branch: string) {
  const encoded = encodeURIComponent(branch);
  try {
    return await gh(`/repos/${REPO}/git/ref/heads/${encoded}`);
  } catch (error) {
    if (branch === "main") throw error;

    const mainRef = await gh(`/repos/${REPO}/git/ref/heads/main`);
    await gh(`/repos/${REPO}/git/refs`, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: mainRef.object.sha,
      }),
    });
    return gh(`/repos/${REPO}/git/ref/heads/${encoded}`);
  }
}

function safePath(input: string) {
  const value = input.replace(/\\/g, "/").replace(/^\.\//, "");
  if (
    !value ||
    value.startsWith("/") ||
    value.includes("../") ||
    value.includes("/../") ||
    value.startsWith(".git/") ||
    value.startsWith("node_modules/") ||
    value.startsWith(".next/") ||
    value === ".env" ||
    value.startsWith(".env.")
  ) {
    throw new AdminApiError(400, `Unzulässiger Dateipfad im Paket: ${input}`);
  }
  return value;
}

async function commitZipToBranch(
  zipFile: File,
  branch: string,
  version: string,
) {
  const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);

  if (entries.length === 0) {
    throw new AdminApiError(400, "Das ZIP enthält keine Dateien.");
  }
  if (entries.length > MAX_FILES) {
    throw new AdminApiError(400, `Maximal ${MAX_FILES} Dateien pro Update.`);
  }

  const ref = await ensureBranch(branch);
  const parentSha = String(ref.object.sha);
  const parentCommit = await gh(`/repos/${REPO}/git/commits/${parentSha}`);

  const tree: Array<{ path: string; mode: string; type: string; sha: string }> = [];

  for (const entry of entries) {
    const path = safePath(entry.name);
    const base64 = await entry.async("base64");
    const blob = await gh(`/repos/${REPO}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: base64, encoding: "base64" }),
    });
    tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const newTree = await gh(`/repos/${REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: parentCommit.tree.sha,
      tree,
    }),
  });

  const commit = await gh(`/repos/${REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: `Release ${version} via Philamentix Admin`,
      tree: newTree.sha,
      parents: [parentSha],
    }),
  });

  await gh(`/repos/${REPO}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return { commitSha: String(commit.sha), fileCount: entries.length };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdmin(request);
    const [{ data: release, error: releaseError }, { data: builds, error: buildsError }] =
      await Promise.all([
        context.adminClient.from("app_release_state").select("*").eq("id", 1).single(),
        context.adminClient
          .from("release_builds")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    if (releaseError) throw new Error(releaseError.message);
    if (buildsError) throw new Error(buildsError.message);

    return NextResponse.json({ release, builds: builds ?? [] });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAdmin(request);
    const form = await request.formData();
    const file = form.get("file");
    const version = String(form.get("version") ?? "").trim();
    const channel = String(form.get("channel") ?? "production").trim();
    const changelog = String(form.get("changelog") ?? "").trim().slice(0, 4000);

    if (!(file instanceof File)) throw new AdminApiError(400, "ZIP-Datei fehlt.");
    if (!file.name.toLowerCase().endsWith(".zip")) {
      throw new AdminApiError(400, "Bitte ein ZIP-Updatepaket hochladen.");
    }
    if (file.size > MAX_ZIP_BYTES) {
      throw new AdminApiError(400, "Das Updatepaket darf maximal 15 MB groß sein.");
    }
    if (!/^\d+(?:\.\d+){1,3}$/.test(version)) {
      throw new AdminApiError(400, "Version muss z. B. 18.5 oder 18.5.1 sein.");
    }
    if (!(channel in CHANNEL_BRANCH)) {
      throw new AdminApiError(400, "Release-Kanal ist ungültig.");
    }

    const branch = CHANNEL_BRANCH[channel];
    const buildId = crypto.randomUUID();
    const { error: insertError } = await context.adminClient.from("release_builds").insert({
      id: buildId,
      version,
      channel,
      changelog,
      source_filename: file.name,
      status: "pushing",
      git_branch: branch,
      created_by: context.adminUser.id,
    });
    if (insertError) throw new Error(insertError.message);

    const auditId = await beginAdminAction(context, {
      action: "release.upload",
      entityType: "release_build",
      entityId: buildId,
      reason: `${channel} ${version} hochgeladen`,
      details: { filename: file.name, branch },
    });

    try {
      const result = await commitZipToBranch(file, branch, version);

      const { error: updateError } = await context.adminClient
        .from("release_builds")
        .update({
          status: "pushed",
          commit_sha: result.commitSha,
          file_count: result.fileCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", buildId);
      if (updateError) throw new Error(updateError.message);

      const releaseUpdate: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: context.adminUser.id,
      };
      if (channel === "production") {
        Object.assign(releaseUpdate, {
          production_channel: "PRODUCTION",
          production_version: version,
          production_release_enabled: true,
        });
      } else if (channel === "beta") {
        Object.assign(releaseUpdate, {
          beta_channel: "BETA",
          beta_version: version,
          beta_release_enabled: true,
        });
      } else {
        Object.assign(releaseUpdate, {
          public_channel: "PUBLIC",
          public_version: version,
        });
      }

      const { error: releaseUpdateError } = await context.adminClient
        .from("app_release_state")
        .update(releaseUpdate)
        .eq("id", 1);
      if (releaseUpdateError) throw new Error(releaseUpdateError.message);

      await finishAdminAction(context, auditId, {
        status: "success",
        afterData: { ...result, channel, version, branch },
      });

      return NextResponse.json({
        ok: true,
        buildId,
        branch,
        commitSha: result.commitSha,
        fileCount: result.fileCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      await context.adminClient
        .from("release_builds")
        .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
        .eq("id", buildId);
      await finishAdminAction(context, auditId, { status: "failed", errorMessage: message });
      throw error;
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requireAdmin(request);
    const body = (await request.json()) as { action?: string };
    const action = body.action;

    if (action !== "productionToBeta" && action !== "betaToPublic") {
      throw new AdminApiError(400, "Unbekannte Release-Aktion.");
    }

    const { data: state, error: stateError } = await context.adminClient
      .from("app_release_state")
      .select("*")
      .eq("id", 1)
      .single();
    if (stateError) throw new Error(stateError.message);

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: context.adminUser.id,
    };

    let reason = "";
    if (action === "productionToBeta") {
      const version = String(state.production_version ?? "").trim();
      if (!version) throw new AdminApiError(400, "Keine Production-Version vorhanden.");
      Object.assign(update, {
        beta_channel: "BETA",
        beta_version: version,
        beta_release_enabled: true,
      });
      reason = `Production ${version} für Beta-Tester freigegeben`;
    } else {
      const version = String(state.beta_version ?? "").trim();
      if (!version) throw new AdminApiError(400, "Keine Beta-Version vorhanden.");
      Object.assign(update, {
        public_channel: "PUBLIC",
        public_version: version,
        beta_release_enabled: false,
      });
      reason = `Beta ${version} als Public freigegeben`;
    }

    const auditId = await beginAdminAction(context, {
      action: action === "productionToBeta" ? "release.production.promote" : "release.beta.promote",
      entityType: "release",
      entityId: "global",
      reason,
      beforeData: state,
    });

    try {
      const { data, error } = await context.adminClient
        .from("app_release_state")
        .update(update)
        .eq("id", 1)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await finishAdminAction(context, auditId, { status: "success", afterData: data });
      return NextResponse.json({ release: data });
    } catch (error) {
      await finishAdminAction(context, auditId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
      throw error;
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}
