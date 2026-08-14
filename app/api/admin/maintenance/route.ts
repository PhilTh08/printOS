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
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  isMaintenanceArea,
  type MaintenanceArea,
  type MaintenanceMode,
  type MaintenanceScope,
} from "@/components/philamentix/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MaintenanceBody = {
  action?: unknown;
  targetType?: unknown;
  userId?: unknown;
  area?: unknown;
  mode?: unknown;
  message?: unknown;
};

function cleanTarget(
  body: MaintenanceBody,
): {
  scope: MaintenanceScope;
  userId: string | null;
} {
  if (body.targetType === "global") {
    return { scope: "global", userId: null };
  }

  if (body.targetType !== "user") {
    throw new AdminApiError(
      400,
      "Wartungsziel ist ungültig.",
    );
  }

  const userId =
    typeof body.userId === "string"
      ? body.userId.trim()
      : "";

  if (!userId) {
    throw new AdminApiError(
      400,
      "Für den Account-Wartungsmodus fehlt der Benutzer.",
    );
  }

  return { scope: "user", userId };
}

function cleanMessage(value: unknown): string {
  const message =
    typeof value === "string" ? value.trim() : "";

  if (message.length > 500) {
    throw new AdminApiError(
      400,
      "Der Wartungshinweis darf höchstens 500 Zeichen enthalten.",
    );
  }

  return message || DEFAULT_MAINTENANCE_MESSAGE;
}

function cleanMode(value: unknown): MaintenanceMode {
  if (
    value !== "maintenance" &&
    value !== "available" &&
    value !== "hidden"
  ) {
    throw new AdminApiError(
      400,
      "Wartungsstatus ist ungültig.",
    );
  }

  return value;
}

async function ensureTargetUser(
  context: Awaited<ReturnType<typeof requireAdmin>>,
  userId: string | null,
) {
  if (!userId) {
    return;
  }

  const {
    data: { user },
    error,
  } = await context.adminClient.auth.admin.getUserById(
    userId,
  );

  if (error || !user) {
    throw new AdminApiError(
      404,
      "Der ausgewählte Benutzer wurde nicht gefunden.",
    );
  }
}

async function loadRules(
  context: Awaited<ReturnType<typeof requireAdmin>>,
) {
  const { data, error } = await context.adminClient
    .from("maintenance_rules")
    .select(
      "id,scope,user_id,area,mode,message,enabled,created_at,updated_at,created_by,updated_by",
    )
    .order("scope")
    .order("area");

  if (error) {
    const code = error.code ?? "";

    if (
      code === "42P01" ||
      code === "PGRST204" ||
      code === "PGRST205"
    ) {
      throw new AdminApiError(
        503,
        "Wartungs-Control-Center ist noch nicht eingerichtet. Bitte supabase/maintenance_control_v17_2_6.sql ausführen.",
      );
    }

    throw new Error(error.message);
  }

  return data ?? [];
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdmin(request);
    const rules = await loadRules(context);

    return NextResponse.json({ rules });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requireAdmin(request);
    const body = (await request.json()) as MaintenanceBody;
    const { scope, userId } = cleanTarget(body);
    await ensureTargetUser(context, userId);

    const action =
      body.action === "setAll"
        ? "setAll"
        : body.action === "clearTarget"
          ? "clearTarget"
          : body.action === "updateMessage"
            ? "updateMessage"
            : "setArea";
    const before = (await loadRules(context)).filter(
      (rule) =>
        String(rule.scope) === scope &&
        (scope === "global"
          ? rule.user_id === null
          : String(rule.user_id) === userId),
    );

    let auditAction = "maintenance.area.update";
    let reason = "Wartungsbereich aktualisiert";
    let details: Record<string, unknown> = {
      scope,
      userId,
    };

    if (action === "updateMessage") {
      const message = cleanMessage(body.message);
      let updateQuery = context.adminClient
        .from("maintenance_rules")
        .update({
          message,
          updated_at: new Date().toISOString(),
          updated_by: context.adminUser.id,
        })
        .eq("mode", "maintenance");
      updateQuery =
        scope === "global"
          ? updateQuery.eq("scope", "global").is("user_id", null)
          : updateQuery.eq("scope", "user").eq("user_id", userId as string);
      const { error } = await updateQuery;

      if (error) {
        throw new Error(error.message);
      }

      auditAction = "maintenance.message.update";
      reason = "Wartungshinweis aktualisiert";
      details = { ...details, messageUpdated: true };
    } else if (action === "setArea") {
      if (!isMaintenanceArea(body.area)) {
        throw new AdminApiError(
          400,
          "Wartungsbereich ist ungültig.",
        );
      }

      const area = body.area as MaintenanceArea;

      if (body.mode === "inherit") {
        let deleteQuery = context.adminClient
          .from("maintenance_rules")
          .delete()
          .eq("area", area);
        deleteQuery =
          scope === "global"
            ? deleteQuery.eq("scope", "global").is("user_id", null)
            : deleteQuery.eq("scope", "user").eq("user_id", userId as string);
        const { error } = await deleteQuery;

        if (error) {
          throw new Error(error.message);
        }

        details = { ...details, area, mode: "inherit" };
      } else {
        const mode = cleanMode(body.mode);
        const message = cleanMessage(body.message);
        const row = {
          scope,
          user_id: userId,
          area,
          mode,
          message,
          enabled: true,
          updated_at: new Date().toISOString(),
          updated_by: context.adminUser.id,
        };

        let existingQuery = context.adminClient
          .from("maintenance_rules")
          .select("id")
          .eq("scope", scope)
          .eq("area", area);
        existingQuery =
          scope === "global"
            ? existingQuery.is("user_id", null)
            : existingQuery.eq("user_id", userId as string);
        const { data: existing, error: existingError } =
          await existingQuery.maybeSingle();

        if (existingError) {
          throw new Error(existingError.message);
        }

        if (existing?.id) {
          const { error } = await context.adminClient
            .from("maintenance_rules")
            .update(row)
            .eq("id", existing.id);

          if (error) {
            throw new Error(error.message);
          }
        } else {
          const { error } = await context.adminClient
            .from("maintenance_rules")
            .insert({
              ...row,
              created_by: context.adminUser.id,
            });

          if (error) {
            throw new Error(error.message);
          }
        }

        details = { ...details, area, mode };
      }
    } else if (action === "setAll") {
      const mode = cleanMode(body.mode);
      const message = cleanMessage(body.message);
      let deleteQuery = context.adminClient
        .from("maintenance_rules")
        .delete();
      deleteQuery =
        scope === "global"
          ? deleteQuery.eq("scope", "global").is("user_id", null)
          : deleteQuery.eq("scope", "user").eq("user_id", userId as string);
      const { error: deleteError } = await deleteQuery;

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      const { error: insertError } = await context.adminClient
        .from("maintenance_rules")
        .insert({
          scope,
          user_id: userId,
          area: "all",
          mode,
          message,
          enabled: true,
          created_by: context.adminUser.id,
          updated_by: context.adminUser.id,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      auditAction =
        mode === "maintenance"
          ? "maintenance.target.lock_all"
          : mode === "hidden"
            ? "maintenance.target.hide_all"
            : "maintenance.target.open_all";
      reason =
        mode === "maintenance"
          ? "Gesamten Hub für Wartung gesperrt"
          : mode === "hidden"
            ? "Gesamten Hub für Ziel ausgeblendet"
            : "Gesamten Hub für Ziel explizit freigegeben";
      details = { ...details, area: "all", mode };
    } else {
      let deleteQuery = context.adminClient
        .from("maintenance_rules")
        .delete();
      deleteQuery =
        scope === "global"
          ? deleteQuery.eq("scope", "global").is("user_id", null)
          : deleteQuery.eq("scope", "user").eq("user_id", userId as string);
      const { error } = await deleteQuery;

      if (error) {
        throw new Error(error.message);
      }

      auditAction = "maintenance.target.clear";
      reason = "Alle Wartungs-Overrides für Ziel entfernt";
    }

    const after = (await loadRules(context)).filter(
      (rule) =>
        String(rule.scope) === scope &&
        (scope === "global"
          ? rule.user_id === null
          : String(rule.user_id) === userId),
    );

    const auditId = await beginAdminAction(context, {
      action: auditAction,
      targetUserId: userId,
      entityType: "maintenance",
      entityId: scope === "global" ? "all-users" : userId,
      reason,
      beforeData: before,
      details,
    });

    await finishAdminAction(context, auditId, {
      status: "success",
      afterData: after,
      details,
    });

    return NextResponse.json({
      rules: await loadRules(context),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
