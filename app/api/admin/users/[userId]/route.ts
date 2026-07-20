import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  adminErrorResponse,
  AdminApiError,
  isMissingOrdersTable,
  recordAdminRead,
  requireAdmin,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  routeContext: RouteContext,
) {
  try {
    const context = await requireAdmin(request);
    const { userId } = await routeContext.params;

    const {
      data: { user: targetUser },
      error: userError,
    } = await context.adminClient.auth.admin.getUserById(
      userId,
    );

    if (userError || !targetUser) {
      throw new AdminApiError(
        404,
        "Benutzer wurde nicht gefunden.",
      );
    }

    const [filamentResult, logResult, roleResult] =
      await Promise.all([
        context.adminClient
          .from("filaments")
          .select("*")
          .eq("user_id", userId)
          .order("material")
          .order("color"),
        context.adminClient
          .from("filament_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", {
            ascending: false,
          })
          .limit(300),
        context.adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId),
      ]);

    if (filamentResult.error) {
      throw new Error(filamentResult.error.message);
    }

    if (logResult.error) {
      throw new Error(logResult.error.message);
    }

    if (roleResult.error) {
      throw new Error(roleResult.error.message);
    }

    let ordersAvailable = true;
    let orders: Record<string, unknown>[] = [];
    const orderResult = await context.adminClient
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .limit(200);

    if (orderResult.error) {
      if (isMissingOrdersTable(orderResult.error)) {
        ordersAvailable = false;
      } else {
        throw new Error(orderResult.error.message);
      }
    } else {
      orders = (orderResult.data ?? []) as Record<
        string,
        unknown
      >[];
    }

    const bannedUntil =
      targetUser.banned_until ?? null;
    const locked = Boolean(
      bannedUntil &&
        new Date(bannedUntil).getTime() > Date.now(),
    );
    const isAdmin = (roleResult.data ?? []).some(
      (row) => row.role === "admin",
    );

    await recordAdminRead(context, {
      action: "user.support_data.view",
      targetUserId: userId,
      entityType: "user",
      entityId: userId,
      reason: "Supportdaten eines Benutzers geöffnet",
      details: {
        filamentCount:
          filamentResult.data?.length ?? 0,
        logCount: logResult.data?.length ?? 0,
        orderCount: orders.length,
        ordersAvailable,
      },
    });

    return NextResponse.json({
      user: {
        id: targetUser.id,
        email: targetUser.email ?? "",
        createdAt: targetUser.created_at,
        lastSignInAt:
          targetUser.last_sign_in_at ?? null,
        emailConfirmedAt:
          targetUser.email_confirmed_at ?? null,
        bannedUntil,
        locked,
        isAdmin,
        isCurrentAdmin:
          targetUser.id === context.adminUser.id,
        userMetadata: targetUser.user_metadata,
      },
      filaments: filamentResult.data ?? [],
      logs: logResult.data ?? [],
      orders,
      ordersAvailable,
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
