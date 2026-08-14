import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  adminErrorResponse,
  AdminApiError,
  beginAdminAction,
  finishAdminAction,
  requireAdmin,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReleaseBody = {
  action?: unknown;
  publicChannel?: unknown;
  publicVersion?: unknown;
  publicMessage?: unknown;
  publicMessageEnabled?: unknown;
  betaChannel?: unknown;
  betaVersion?: unknown;
  betaMessage?: unknown;
  betaMessageEnabled?: unknown;
  betaReleaseEnabled?: unknown;
};

function cleanText(
  value: unknown,
  field: string,
  maxLength: number,
  required = false,
): string {
  const text = typeof value === "string" ? value.trim() : "";

  if (required && !text) {
    throw new AdminApiError(400, `${field} darf nicht leer sein.`);
  }

  if (text.length > maxLength) {
    throw new AdminApiError(
      400,
      `${field} darf höchstens ${maxLength} Zeichen enthalten.`,
    );
  }

  return text;
}

function cleanBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new AdminApiError(400, `${field} ist ungültig.`);
  }

  return value;
}

async function loadReleaseState(
  context: Awaited<ReturnType<typeof requireAdmin>>,
) {
  const { data, error } = await context.adminClient
    .from("app_release_state")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    const code = error.code ?? "";

    if (
      code === "42P01" ||
      code === "PGRST204" ||
      code === "PGRST205"
    ) {
      throw new AdminApiError(
        503,
        "Release-System ist noch nicht eingerichtet. Bitte supabase/release_channels_v17_2_2.sql ausführen.",
      );
    }

    throw new Error(error.message);
  }

  if (!data) {
    throw new AdminApiError(500, "Release-Konfiguration fehlt.");
  }

  return data;
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdmin(request);
    const release = await loadReleaseState(context);

    return NextResponse.json({ release });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requireAdmin(request);
    const body = (await request.json()) as ReleaseBody;
    const action = body.action === "publishBeta" ? "publishBeta" : "save";
    const before = await loadReleaseState(context);

    let update: Record<string, unknown>;
    let auditAction: string;
    let reason: string;

    if (action === "publishBeta") {
      const betaVersion = String(before.beta_version ?? "").trim();

      if (!betaVersion) {
        throw new AdminApiError(
          400,
          "Es ist keine Beta-Version eingetragen, die veröffentlicht werden kann.",
        );
      }

      update = {
        public_version: betaVersion,
        public_message: String(before.beta_message ?? ""),
        public_message_enabled: Boolean(before.beta_message_enabled),
        beta_release_enabled: false,
        updated_at: new Date().toISOString(),
        updated_by: context.adminUser.id,
      };
      auditAction = "release.beta.publish";
      reason = `Beta ${betaVersion} als Public-Version veröffentlicht`;
    } else {
      update = {
        public_channel: cleanText(
          body.publicChannel,
          "Public-Kanal",
          24,
          true,
        ),
        public_version: cleanText(
          body.publicVersion,
          "Public-Version",
          40,
          true,
        ),
        public_message: cleanText(
          body.publicMessage,
          "Public Roll-Message",
          500,
        ),
        public_message_enabled: cleanBoolean(
          body.publicMessageEnabled,
          "Public Roll-Message Status",
        ),
        beta_channel: cleanText(
          body.betaChannel,
          "Beta-Kanal",
          24,
          true,
        ),
        beta_version: cleanText(
          body.betaVersion,
          "Beta-Version",
          40,
        ),
        beta_message: cleanText(
          body.betaMessage,
          "Beta Roll-Message",
          500,
        ),
        beta_message_enabled: cleanBoolean(
          body.betaMessageEnabled,
          "Beta Roll-Message Status",
        ),
        beta_release_enabled: cleanBoolean(
          body.betaReleaseEnabled,
          "Beta-Release Status",
        ),
        updated_at: new Date().toISOString(),
        updated_by: context.adminUser.id,
      };
      auditAction = "release.settings.update";
      reason = "Release-Konfiguration im Adminbereich geändert";
    }

    const auditId = await beginAdminAction(context, {
      action: auditAction,
      entityType: "release",
      entityId: "global",
      reason,
      beforeData: before,
    });

    try {
      const { data, error } = await context.adminClient
        .from("app_release_state")
        .update(update)
        .eq("id", 1)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      await finishAdminAction(context, auditId, {
        status: "success",
        afterData: data,
      });

      return NextResponse.json({ release: data });
    } catch (error) {
      await finishAdminAction(context, auditId, {
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unbekannter Fehler",
      });
      throw error;
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}
