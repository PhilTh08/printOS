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
  requireReason,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    userId: string;
    logId: string;
  }>;
};

export async function DELETE(
  request: NextRequest,
  routeContext: RouteContext,
) {
  try {
    const context = await requireAdmin(request);
    const { userId, logId } =
      await routeContext.params;
    const body = (await request.json()) as {
      reason?: unknown;
    };
    const reason = requireReason(body.reason);

    const { data: before, error: loadError } =
      await context.adminClient
        .from("filament_logs")
        .select("*")
        .eq("id", logId)
        .eq("user_id", userId)
        .maybeSingle();

    if (loadError) {
      throw new Error(loadError.message);
    }

    if (!before) {
      throw new AdminApiError(
        404,
        "Protokolleintrag wurde nicht gefunden.",
      );
    }

    const auditId = await beginAdminAction(context, {
      action: "filament_log.support_delete",
      targetUserId: userId,
      entityType: "filament_log",
      entityId: logId,
      reason,
      beforeData: before,
    });

    try {
      const { error: deleteError } =
        await context.adminClient
          .from("filament_logs")
          .delete()
          .eq("id", logId)
          .eq("user_id", userId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      await finishAdminAction(
        context,
        auditId,
        {
          status: "success",
          afterData: null,
        },
      );

      return NextResponse.json({
        deleted: true,
        logId,
      });
    } catch (error) {
      await finishAdminAction(
        context,
        auditId,
        {
          status: "failed",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unbekannter Fehler",
        },
      );
      throw error;
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}
