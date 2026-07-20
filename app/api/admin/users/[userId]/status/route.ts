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
  }>;
};

type StatusBody = {
  locked?: unknown;
  reason?: unknown;
};

export async function PATCH(
  request: NextRequest,
  routeContext: RouteContext,
) {
  try {
    const context = await requireAdmin(request);
    const { userId } = await routeContext.params;
    const body = (await request.json()) as StatusBody;
    const reason = requireReason(body.reason);

    if (typeof body.locked !== "boolean") {
      throw new AdminApiError(
        400,
        "Der gewünschte Kontostatus fehlt.",
      );
    }

    if (
      body.locked &&
      userId === context.adminUser.id
    ) {
      throw new AdminApiError(
        400,
        "Du kannst deinen eigenen Adminaccount nicht sperren.",
      );
    }

    const {
      data: { user: targetUser },
      error: targetError,
    } = await context.adminClient.auth.admin.getUserById(
      userId,
    );

    if (targetError || !targetUser) {
      throw new AdminApiError(
        404,
        "Benutzer wurde nicht gefunden.",
      );
    }

    const { data: targetRole, error: roleError } =
      await context.adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

    if (roleError) {
      throw new Error(roleError.message);
    }

    if (body.locked && targetRole) {
      throw new AdminApiError(
        400,
        "Ein Adminaccount kann erst gesperrt werden, nachdem seine Adminrolle in Supabase entfernt wurde.",
      );
    }

    const beforeLocked = Boolean(
      targetUser.banned_until &&
        new Date(targetUser.banned_until).getTime() >
          Date.now(),
    );
    const auditId = await beginAdminAction(context, {
      action: body.locked
        ? "user.account.lock"
        : "user.account.unlock",
      targetUserId: userId,
      entityType: "user",
      entityId: userId,
      reason,
      beforeData: {
        locked: beforeLocked,
        bannedUntil:
          targetUser.banned_until ?? null,
      },
    });

    try {
      const { data, error: updateError } =
        await context.adminClient.auth.admin.updateUserById(
          userId,
          {
            ban_duration: body.locked
              ? "876000h"
              : "none",
          },
        );

      if (updateError) {
        throw new Error(updateError.message);
      }

      const updatedBannedUntil =
        data.user?.banned_until ?? null;
      const updatedLocked = Boolean(
        updatedBannedUntil &&
          new Date(updatedBannedUntil).getTime() >
            Date.now(),
      );

      await finishAdminAction(
        context,
        auditId,
        {
          status: "success",
          afterData: {
            locked: updatedLocked,
            bannedUntil: updatedBannedUntil,
          },
        },
      );

      return NextResponse.json({
        userId,
        locked: updatedLocked,
        bannedUntil: updatedBannedUntil,
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
