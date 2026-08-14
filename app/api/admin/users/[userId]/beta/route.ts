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

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

type BetaBody = {
  enabled?: unknown;
};

export async function PATCH(
  request: NextRequest,
  routeContext: RouteContext,
) {
  try {
    const context = await requireAdmin(request);
    const { userId } = await routeContext.params;
    const body = (await request.json()) as BetaBody;

    if (typeof body.enabled !== "boolean") {
      throw new AdminApiError(400, "Der gewünschte Beta-Status fehlt.");
    }

    const {
      data: { user: targetUser },
      error: targetError,
    } = await context.adminClient.auth.admin.getUserById(userId);

    if (targetError || !targetUser) {
      throw new AdminApiError(404, "Benutzer wurde nicht gefunden.");
    }

    const { data: current, error: currentError } = await context.adminClient
      .from("beta_testers")
      .select("enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (currentError) {
      const code = currentError.code ?? "";

      if (
        code === "42P01" ||
        code === "PGRST204" ||
        code === "PGRST205"
      ) {
        throw new AdminApiError(
          503,
          "Beta-System ist noch nicht eingerichtet. Bitte supabase/release_channels_v17_2_2.sql ausführen.",
        );
      }

      throw new Error(currentError.message);
    }

    const beforeEnabled = current?.enabled === true;
    const auditId = await beginAdminAction(context, {
      action: body.enabled ? "user.beta.enable" : "user.beta.disable",
      targetUserId: userId,
      entityType: "user",
      entityId: userId,
      reason: body.enabled
        ? "Beta-Testzugang im Adminbereich freigeschaltet"
        : "Beta-Testzugang im Adminbereich entfernt",
      beforeData: { betaTester: beforeEnabled },
    });

    try {
      const { error } = await context.adminClient
        .from("beta_testers")
        .upsert(
          {
            user_id: userId,
            enabled: body.enabled,
            updated_at: new Date().toISOString(),
            updated_by: context.adminUser.id,
            created_by: current ? undefined : context.adminUser.id,
          },
          { onConflict: "user_id" },
        );

      if (error) {
        throw new Error(error.message);
      }

      await finishAdminAction(context, auditId, {
        status: "success",
        afterData: { betaTester: body.enabled },
      });

      return NextResponse.json({
        userId,
        betaTester: body.enabled,
      });
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
